import { serverConfig } from '@/config/env';
import {
  AUTO_SELECT_THRESHOLD,
  MAX_MATCH_CANDIDATES,
  rankCandidates,
  type MatchInput,
} from '@/features/card-catalog/matching';
import {
  computeImageQualityScore,
  estimateCondition,
  isDedicatedPhotoRegion,
} from '@/features/analysis/quality';
import { mapWithConcurrency } from '@/lib/async/concurrency';
import { isAppError } from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';
import { getProviders } from '@/providers/registry';
import type { CardRecognitionResult } from '@/providers/types';
import { getRepository } from '@/repositories';
import type {
  NewDetectedCard,
  NewMatchCandidate,
} from '@/repositories/pokora-repository';
import { getFileStorage } from '@/repositories/storage';
import { trackEvent } from '@/services/analytics';
import { PIPELINE_STEPS, type PipelineStep } from '@/services/analysis-state';
import type {
  AnalysisImage,
  CardRegion,
  CatalogCard,
  DetectedCard,
} from '@/types/domain';

/**
 * The analysis pipeline.
 *
 * Runs asynchronously inside the application process. Each completed step is
 * persisted on the session before the next one starts, so the processing
 * screen reflects real backend progress rather than an animation.
 *
 * Known MVP limitation: with more than one server instance a run is not
 * resumable. `docs/mvp-limitations.md` describes the queue this would become.
 */

/**
 * Catalog lookups running at once.
 *
 * Four keeps a full binder page overlapping nicely while staying far below the
 * public API's rate limit. Higher turns into 429s, and the adapter's backoff
 * then makes the whole step slower than it was serially.
 */
export const CATALOG_LOOKUP_CONCURRENCY = 4;

/**
 * Runs currently executing, keyed by session.
 *
 * The promise itself is stored rather than a flag, so a second caller can join
 * the run that is already going instead of starting a competing one. Two
 * pipelines over the same session used to interleave and tear each other's
 * detected cards out from under themselves.
 */
const inFlight = new Map<string, Promise<void>>();

export function isAnalysisRunning(sessionId: string): boolean {
  return inFlight.has(sessionId);
}

async function setStep(sessionId: string, step: PipelineStep): Promise<void> {
  await getRepository().updateSession(sessionId, {
    status: 'processing',
    statusDetail: step,
  });
}

/** Start the pipeline without blocking the caller. Safe to call twice. */
export function startAnalysisInBackground(sessionId: string): void {
  void runAnalysis(sessionId).catch((error) => {
    logger.error('Analysis pipeline crashed', error, { sessionId });
  });
}

/**
 * Run the pipeline to completion, or join the run already under way for this
 * session. Used directly by tests, and by anything that needs to wait for the
 * result rather than fire and forget.
 */
export function runAnalysis(sessionId: string): Promise<void> {
  const existing = inFlight.get(sessionId);
  if (existing) return existing;

  const run = executeAnalysis(sessionId).finally(() => {
    inFlight.delete(sessionId);
  });
  inFlight.set(sessionId, run);
  return run;
}

async function executeAnalysis(sessionId: string): Promise<void> {
  const repository = getRepository();

  try {
    await setStep(sessionId, 'preparing_images');
    const images = await repository.listImages(sessionId);
    if (images.length === 0) {
      throw new Error('Analysis started without images');
    }

    for (const image of images) {
      const qualityScore = computeImageQualityScore({
        width: image.width,
        height: image.height,
        warnings: image.qualityWarnings,
      });
      await repository.updateImage(image.id, {
        processingStatus: 'processing',
        qualityScore,
      });
      image.qualityScore = qualityScore;
    }

    await setStep(sessionId, 'locating_cards');
    const recognised = await recogniseAllImages(images);

    await setStep(sessionId, 'recognising_cards');
    const detectedCards = buildDetectedCards(sessionId, recognised);
    const storedCards = await repository.replaceDetectedCards(
      sessionId,
      detectedCards,
    );

    await setStep(sessionId, 'matching_catalog');
    const catalogById = await matchCards(storedCards, recognised);

    await setStep(sessionId, 'fetching_market_data');
    await fetchPrices(storedCards, catalogById);

    await setStep(sessionId, 'building_report');
    const refreshed = await repository.listDetectedCards(sessionId);
    const unknownCount = refreshed.filter(
      (card) => card.reviewStatus === 'unknown',
    ).length;

    await repository.updateSession(sessionId, {
      status: 'needs_review',
      statusDetail: null,
      detectedCardsCount: refreshed.length,
      unknownCardsCount: unknownCount,
      confirmedCardsCount: 0,
      errorMessage: null,
    });

    for (const image of images) {
      await repository.updateImage(image.id, { processingStatus: 'processed' });
    }

    await repository.recordEvent({
      userId: null,
      analysisSessionId: sessionId,
      eventType: 'analysis_completed',
      metadata: { detected: refreshed.length, unknown: unknownCount },
    });
    trackEvent('analysis_completed', {
      detected_cards: refreshed.length,
      unknown_cards: unknownCount,
    });
  } catch (error) {
    logger.error('Analysis failed', error, { sessionId });
    const userMessage = isAppError(error)
      ? error.userMessage
      : 'De analyse is niet afgerond. Probeer het opnieuw met een scherpere foto.';

    await repository
      .updateSession(sessionId, {
        status: 'failed',
        statusDetail: null,
        errorMessage: userMessage,
      })
      .catch(() => undefined);

    const images = await repository.listImages(sessionId).catch(() => []);
    for (const image of images) {
      await repository
        .updateImage(image.id, { processingStatus: 'needs_manual_review' })
        .catch(() => undefined);
    }

    await repository
      .recordEvent({
        userId: null,
        analysisSessionId: sessionId,
        eventType: 'analysis_failed',
        metadata: { code: isAppError(error) ? error.code : 'UNKNOWN' },
      })
      .catch(() => undefined);
    trackEvent('analysis_failed', {
      code: isAppError(error) ? error.code : 'UNKNOWN',
    });
  }
}

type RecognisedImage = {
  image: AnalysisImage;
  results: Array<CardRecognitionResult & { region: CardRegion }>;
};

async function recogniseAllImages(
  images: AnalysisImage[],
): Promise<RecognisedImage[]> {
  const providers = getProviders();
  const storage = getFileStorage();
  const output: RecognisedImage[] = [];

  for (const [imageIndex, image] of images.entries()) {
    const signedUrl = await storage.createSignedUrl(image.storagePath, 900);

    if (providers.recognition.recognizeImage) {
      const results = await providers.recognition.recognizeImage(signedUrl, {
        imageId: image.id,
        imageIndex,
        // Hand the bytes over directly so a vision provider never has to be
        // able to reach our storage from the outside.
        loadImage: async () => {
          const object = await storage.read(image.storagePath);
          return { bytes: object.body, mediaType: object.contentType };
        },
      });
      output.push({ image, results });
      continue;
    }

    // Fallback path: locate first, then recognise each region separately.
    const regions = await providers.detection.detectCards(signedUrl);
    const results: Array<CardRecognitionResult & { region: CardRegion }> = [];
    for (const region of regions) {
      const result = await providers.recognition.recognizeCard({
        imageUrl: signedUrl,
        region: region.region,
      });
      results.push({
        ...result,
        region: region.region,
        imageQualityWarnings: [
          ...new Set([
            ...result.imageQualityWarnings,
            ...region.qualityWarnings,
          ]),
        ],
      });
    }
    output.push({ image, results });
  }
  return output;
}

function buildDetectedCards(
  sessionId: string,
  recognised: RecognisedImage[],
): NewDetectedCard[] {
  const cards: NewDetectedCard[] = [];
  let position = 0;
  for (const { image, results } of recognised) {
    for (const result of results) {
      const dedicated = isDedicatedPhotoRegion(result.region);
      const hasReadableIdentity =
        result.visibleName !== null || result.visibleCardNumber !== null;

      cards.push({
        analysisSessionId: sessionId,
        analysisImageId: image.id,
        position: position++,
        cropStoragePath: null,
        region: result.region,
        visibleName: result.visibleName,
        visibleCardNumber: result.visibleCardNumber,
        detectedLanguage: result.language,
        variantHints: result.variantHints,
        recognitionConfidence: result.recognitionConfidence,
        selectedCatalogCardId: null,
        // Nothing legible means the card starts life as "unknown"; anything
        // else waits for the user in `pending`.
        reviewStatus: hasReadableIdentity ? 'pending' : 'unknown',
        userConfirmed: false,
        conditionEstimate: estimateCondition({
          isDedicatedPhoto: dedicated,
          imageQualityScore: image.qualityScore,
          warnings: result.imageQualityWarnings,
        }),
        quantity: 1,
      });
    }
  }
  return cards;
}

/**
 * Attach ranked catalog candidates to every detected card and preselect the
 * best one when it clears the auto-select threshold. A preselection is never
 * treated as final: `userConfirmed` stays false until the user acts.
 */
async function matchCards(
  cards: DetectedCard[],
  recognised: RecognisedImage[],
): Promise<Map<string, CatalogCard>> {
  const repository = getRepository();
  const providers = getProviders();
  const catalogById = new Map<string, CatalogCard>();

  // Cards were inserted in the same order they were recognised.
  const flatResults = recognised.flatMap((entry) => entry.results);

  const lookups = cards.flatMap((card, index) => {
    const result = flatResults[index];
    if (!result || card.reviewStatus === 'unknown') return [];
    return [{ card, result }];
  });

  // Every card is an independent remote query, so they overlap. Run serially a
  // full binder page meant nine round trips end to end - up to eighteen once
  // the name-only fallback kicked in - which dominated the whole analysis.
  const pools = await mapWithConcurrency(
    lookups,
    CATALOG_LOOKUP_CONCURRENCY,
    async ({ card, result }) => {
      // A catalog outage must not discard successful recognition work. One
      // card that cannot be looked up simply stays `pending` with no
      // candidates, so the user can still search for it by hand - the same
      // containment the pricing step already had.
      try {
        const searchResults = await providers.catalog.searchCards({
          name: result.visibleName ?? undefined,
          cardNumber: result.visibleCardNumber ?? undefined,
          limit: 25,
        });

        // A number-only search can miss; widen to name-only when nothing
        // landed.
        return searchResults.length > 0
          ? searchResults
          : await providers.catalog.searchCards({
              name: result.visibleName ?? undefined,
              limit: 25,
            });
      } catch (error) {
        logger.warn('Catalog lookup failed for card; leaving it for review', {
          detectedCardId: card.id,
          code: isAppError(error) ? error.code : 'UNKNOWN',
        });
        return null;
      }
    },
  );

  // Writes stay sequential. They are cheap next to the network calls, and
  // keeping them ordered means candidate ranks land in a predictable order.
  for (const [index, { card, result }] of lookups.entries()) {
    const pool = pools[index];
    if (!pool || pool.length === 0) {
      await repository.replaceMatchCandidates(card.id, []);
      continue;
    }

    const matchInput: MatchInput = {
      visibleName: result.visibleName,
      visibleCardNumber: result.visibleCardNumber,
      possibleSetCode: result.possibleSetCode,
      language: result.language,
      variantHints: result.variantHints,
    };

    const ranked = rankCandidates(matchInput, pool, MAX_MATCH_CANDIDATES);
    await repository.upsertCatalogCards(ranked.map((entry) => entry.card));
    for (const entry of ranked) catalogById.set(entry.card.id, entry.card);

    const candidates: NewMatchCandidate[] = ranked.map((entry, rank) => ({
      detectedCardId: card.id,
      catalogCardId: entry.card.id,
      matchScore: entry.score,
      matchReasons: entry.reasons,
      rank,
    }));
    await repository.replaceMatchCandidates(card.id, candidates);

    const best = ranked[0];
    if (best && best.score >= AUTO_SELECT_THRESHOLD) {
      await repository.updateDetectedCard(card.id, {
        selectedCatalogCardId: best.card.id,
      });
      card.selectedCatalogCardId = best.card.id;
    }
  }

  return catalogById;
}

async function fetchPrices(
  cards: DetectedCard[],
  catalogById: Map<string, CatalogCard>,
): Promise<void> {
  const repository = getRepository();
  const providers = getProviders();
  const priced = new Map<
    string,
    Awaited<ReturnType<typeof providers.pricing.getPriceEstimate>>
  >();

  for (const card of cards) {
    const catalogCardId = card.selectedCatalogCardId;
    if (!catalogCardId) continue;

    const catalogCard =
      catalogById.get(catalogCardId) ??
      (await repository.getCatalogCard(catalogCardId));
    if (!catalogCard) continue;

    try {
      const cached = priced.get(catalogCardId);
      const estimate =
        cached ??
        (await providers.pricing.getPriceEstimate({
          catalogCard,
          conditionBasis: 'ungraded',
        }));
      priced.set(catalogCardId, estimate);

      await repository.savePriceEstimate({
        detectedCardId: card.id,
        catalogCardId,
        ...estimate,
      });
    } catch (error) {
      // A pricing failure must not discard successful recognition work.
      logger.warn('Pricing lookup failed for card', {
        catalogCardId,
        code: isAppError(error) ? error.code : 'UNKNOWN',
      });
      await repository.savePriceEstimate({
        detectedCardId: card.id,
        catalogCardId,
        currency: 'EUR',
        low: null,
        mid: null,
        high: null,
        sampleSize: 0,
        sourceName: providers.pricing.name,
        lastUpdatedAt: new Date().toISOString(),
        conditionBasis: 'unknown',
        confidence: 0,
        warnings: ['Marktinformatie kon niet worden opgehaald'],
      });
    }
  }
}

export const PIPELINE_STEP_COUNT = PIPELINE_STEPS.length;
export const ATTENTION_THRESHOLD_EUR =
  serverConfig.report.attentionValueThresholdEur;
