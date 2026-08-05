import { serverConfig } from '@/config/env';
import { isAcceptedMimeType } from '@/config/public';
import {
  estimateCondition,
  isDedicatedPhotoRegion,
  qualityWarningsFor,
  reconcileSourceMetrics,
} from '@/features/analysis/quality';
import {
  MAX_MATCH_CANDIDATES,
  rankCandidates,
  type MatchInput,
} from '@/features/card-catalog/matching';
import { inspectImage } from '@/lib/images/inspect';
import {
  AnalysisNotFoundError,
  UploadValidationError,
} from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';
import { getProviders } from '@/providers/registry';
import { getRepository } from '@/repositories';
import { buildStorageKey, getFileStorage } from '@/repositories/storage';
import { trackEvent } from '@/services/analytics';
import {
  assertCanAccess,
  loadAuthorisedSession,
  type Requester,
} from '@/services/analysis-access';
import { startAnalysisInBackground } from '@/services/analysis-pipeline';
import { assertTransition } from '@/services/analysis-state';
import {
  assertWithinRateLimit,
  checkAnalysisRateLimit,
  hashOwner,
  maxImagesFor,
} from '@/services/rate-limit';
import type {
  AnalysisImage,
  AnalysisSession,
  CardMatchCandidate,
  CatalogCard,
  DetectedCard,
  DetectedCardView,
  StoredPriceEstimate,
} from '@/types/domain';

/**
 * Application service for the analysis flow. All business rules live here;
 * server actions and route handlers are thin wrappers around these functions.
 */

export async function createAnalysisSession(input: {
  userId: string | null;
  guestToken: string;
  ipAddress: string | null;
}): Promise<AnalysisSession> {
  const repository = getRepository();
  const ownerHash = hashOwner({
    userId: input.userId,
    guestToken: input.userId ? null : input.guestToken,
    ip: input.ipAddress,
  });

  const decision = await checkAnalysisRateLimit({
    userId: input.userId,
    ownerHash,
  });
  assertWithinRateLimit(decision, input.userId === null);

  const expiresAt =
    input.userId === null
      ? new Date(
          Date.now() + serverConfig.limits.guestTtlHours * 3600_000,
        ).toISOString()
      : null;

  const session = await repository.createSession({
    userId: input.userId,
    guestToken: input.userId ? null : input.guestToken,
    ownerHash,
    expiresAt,
  });

  await repository.recordEvent({
    userId: input.userId,
    analysisSessionId: session.id,
    eventType: 'analysis_started',
    metadata: { guest: input.userId === null },
  });
  trackEvent('analysis_started', { guest: input.userId === null });

  return session;
}

export type UploadCandidate = {
  filename: string;
  declaredMimeType: string;
  bytes: Uint8Array;
  /**
   * Measurements of the photo before the browser downscaled it, when it did.
   * Used for quality scoring only, and validated before it is trusted.
   */
  source?: { width: number; height: number; byteSize: number } | null;
};

/**
 * Server-side upload validation and storage.
 *
 * Validates the real file header, not the declared type, generates the storage
 * key itself, and enforces the per-session image limit for the owner tier.
 */
export async function registerUploadedImage(input: {
  sessionId: string;
  requester: Requester;
  file: UploadCandidate;
}): Promise<AnalysisImage> {
  const repository = getRepository();
  const session = await loadAuthorisedSession(input.sessionId, input.requester);

  if (session.status !== 'created' && session.status !== 'uploading') {
    assertTransition(session.status, 'uploading');
  }

  const existing = await repository.listImages(session.id);
  const maxImages = maxImagesFor(session.userId);
  if (existing.length >= maxImages) {
    throw new UploadValidationError(`Image limit of ${maxImages} reached`);
  }

  const { bytes, filename, declaredMimeType } = input.file;

  if (bytes.byteLength === 0) {
    throw new UploadValidationError('Empty file');
  }
  if (bytes.byteLength > serverConfig.limits.maxUploadBytes) {
    throw new UploadValidationError('File exceeds the maximum size');
  }
  if (!isAcceptedMimeType(declaredMimeType)) {
    throw new UploadValidationError('Unsupported declared MIME type');
  }

  const inspected = inspectImage(bytes);
  if (!inspected) {
    throw new UploadValidationError('File is not a readable JPG, PNG or WEBP');
  }
  if (inspected.format !== declaredMimeType) {
    // A mismatch means the extension or MIME type lied about the content.
    logger.warn('Upload MIME mismatch', {
      declared: declaredMimeType,
      actual: inspected.format,
    });
  }

  const storageKey = buildStorageKey(session.id, filename);
  const storagePath = await getFileStorage().put(
    storageKey,
    bytes,
    inspected.format,
  );

  // Quality describes the photo as taken; the stored file may be a smaller
  // copy the browser produced to keep the upload quick.
  const metrics = reconcileSourceMetrics(
    {
      width: inspected.width,
      height: inspected.height,
      byteSize: bytes.byteLength,
    },
    input.file.source ?? null,
  );
  const warnings = qualityWarningsFor(metrics);

  const image = await repository.addImage({
    analysisSessionId: session.id,
    storagePath,
    // The original filename is stored for display only and never used to build
    // a path. Strip directory components defensively.
    originalFilename: filename.replace(/^.*[\\/]/, '').slice(0, 160),
    mimeType: inspected.format,
    // The photo's own measurements, not the downscaled copy's. Every consumer
    // of these three fields feeds a quality judgement, which has to describe
    // what the user photographed.
    width: metrics.width,
    height: metrics.height,
    byteSize: metrics.byteSize,
    processingStatus: 'pending',
    qualityScore: null,
    qualityWarnings: warnings,
  });

  await repository.updateSession(session.id, {
    status: 'uploading',
    totalImages: existing.length + 1,
  });

  await repository.recordEvent({
    userId: session.userId,
    analysisSessionId: session.id,
    eventType: 'image_uploaded',
    metadata: { index: existing.length + 1 },
  });
  trackEvent('image_uploaded', { index: existing.length + 1 });

  return image;
}

export async function startAnalysis(input: {
  sessionId: string;
  requester: Requester;
}): Promise<AnalysisSession> {
  const repository = getRepository();
  const session = await loadAuthorisedSession(input.sessionId, input.requester);
  const images = await repository.listImages(session.id);

  if (images.length === 0) {
    throw new UploadValidationError('Upload at least one image first');
  }

  assertTransition(session.status, 'processing');
  const updated = await repository.updateSession(session.id, {
    status: 'processing',
    statusDetail: 'preparing_images',
    totalImages: images.length,
    errorMessage: null,
  });

  startAnalysisInBackground(session.id);
  return updated;
}

export async function retryAnalysis(input: {
  sessionId: string;
  requester: Requester;
}): Promise<AnalysisSession> {
  const repository = getRepository();
  const session = await loadAuthorisedSession(input.sessionId, input.requester);
  assertTransition(session.status, 'processing');
  const updated = await repository.updateSession(session.id, {
    status: 'processing',
    statusDetail: 'preparing_images',
    errorMessage: null,
  });
  startAnalysisInBackground(session.id);
  return updated;
}

export async function getSessionStatus(input: {
  sessionId: string;
  requester: Requester;
}): Promise<AnalysisSession> {
  return loadAuthorisedSession(input.sessionId, input.requester);
}

/** Everything the review screen needs, joined and authorised in one call. */
export async function getReviewData(input: {
  sessionId: string;
  requester: Requester;
}): Promise<{ session: AnalysisSession; cards: DetectedCardView[] }> {
  const repository = getRepository();
  const session = await loadAuthorisedSession(input.sessionId, input.requester);

  const [cards, images, candidates, prices] = await Promise.all([
    repository.listDetectedCards(session.id),
    repository.listImages(session.id),
    repository.listMatchCandidates(session.id),
    repository.listPriceEstimates(session.id),
  ]);

  const catalogIds = new Set<string>();
  for (const card of cards) {
    if (card.selectedCatalogCardId) catalogIds.add(card.selectedCatalogCardId);
  }
  for (const candidate of candidates) catalogIds.add(candidate.catalogCardId);
  const catalogCards = await repository.getCatalogCards([...catalogIds]);
  const catalogById = new Map(catalogCards.map((card) => [card.id, card]));

  return {
    session,
    cards: cards.map((card) =>
      buildCardView(card, images, candidates, prices, catalogById),
    ),
  };
}

function buildCardView(
  card: DetectedCard,
  images: AnalysisImage[],
  candidates: CardMatchCandidate[],
  prices: StoredPriceEstimate[],
  catalogById: Map<string, CatalogCard>,
): DetectedCardView {
  const image = images.find((entry) => entry.id === card.analysisImageId);
  return {
    card,
    image: image
      ? {
          id: image.id,
          storagePath: image.storagePath,
          originalFilename: image.originalFilename,
        }
      : null,
    selectedCatalogCard: card.selectedCatalogCardId
      ? (catalogById.get(card.selectedCatalogCardId) ?? null)
      : null,
    candidates: candidates
      .filter((candidate) => candidate.detectedCardId === card.id)
      .sort((a, b) => a.rank - b.rank)
      .map((candidate) => ({
        candidate,
        catalogCard: catalogById.get(candidate.catalogCardId) ?? null,
      })),
    priceEstimate:
      prices.find((price) => price.detectedCardId === card.id) ?? null,
  };
}

async function loadCardForRequester(
  detectedCardId: string,
  requester: Requester,
): Promise<{ card: DetectedCard; session: AnalysisSession }> {
  const repository = getRepository();
  const card = await repository.getDetectedCard(detectedCardId);
  if (!card) throw new AnalysisNotFoundError(detectedCardId);
  const session = await repository.getSession(card.analysisSessionId);
  if (!session) throw new AnalysisNotFoundError(card.analysisSessionId);
  assertCanAccess(session, requester);
  return { card, session };
}

export async function confirmCardMatch(input: {
  detectedCardId: string;
  requester: Requester;
  quantity?: number;
}): Promise<DetectedCard> {
  const repository = getRepository();
  const { card, session } = await loadCardForRequester(
    input.detectedCardId,
    input.requester,
  );

  if (!card.selectedCatalogCardId) {
    throw new UploadValidationError('Select a catalog card before confirming');
  }

  const updated = await repository.updateDetectedCard(card.id, {
    reviewStatus: 'confirmed',
    userConfirmed: true,
    quantity: normaliseQuantity(input.quantity ?? card.quantity),
  });

  await refreshSessionCounters(session.id);
  await repository.recordEvent({
    userId: session.userId,
    analysisSessionId: session.id,
    eventType: 'card_match_confirmed',
    metadata: { catalogCardId: updated.selectedCatalogCardId },
  });
  trackEvent('card_match_confirmed');
  return updated;
}

/**
 * Confirms several cards at once.
 *
 * Written as one operation rather than a loop over `confirmCardMatch` because
 * that would re-authorise and recount the session per card: on a nine-card
 * binder page the counters would be rewritten nine times. Cards without a
 * selected match are skipped rather than failing the batch — the user asked to
 * confirm what is confirmable.
 */
export async function confirmCardMatches(input: {
  detectedCardIds: string[];
  requester: Requester;
}): Promise<{ confirmed: number; skipped: number; sessionId: string | null }> {
  const repository = getRepository();
  let sessionId: string | null = null;
  let confirmed = 0;
  let skipped = 0;

  for (const detectedCardId of input.detectedCardIds) {
    const { card, session } = await loadCardForRequester(
      detectedCardId,
      input.requester,
    );
    sessionId = session.id;

    if (!card.selectedCatalogCardId || card.reviewStatus === 'unknown') {
      skipped += 1;
      continue;
    }

    await repository.updateDetectedCard(card.id, {
      reviewStatus: 'confirmed',
      userConfirmed: true,
    });
    confirmed += 1;
  }

  if (sessionId && confirmed > 0) {
    await refreshSessionCounters(sessionId);
    await repository.recordEvent({
      userId: input.requester.userId,
      analysisSessionId: sessionId,
      eventType: 'card_match_confirmed',
      metadata: { bulk: true, confirmed },
    });
    trackEvent('card_match_confirmed', { bulk: true, count: confirmed });
  }

  return { confirmed, skipped, sessionId };
}

export async function changeCardMatch(input: {
  detectedCardId: string;
  catalogCardId: string;
  requester: Requester;
  quantity?: number;
}): Promise<DetectedCard> {
  const repository = getRepository();
  const providers = getProviders();
  const { card, session } = await loadCardForRequester(
    input.detectedCardId,
    input.requester,
  );

  let catalogCard = await repository.getCatalogCard(input.catalogCardId);
  if (!catalogCard) {
    catalogCard = await providers.catalog.getCardById(input.catalogCardId);
    if (!catalogCard) {
      throw new AnalysisNotFoundError(input.catalogCardId);
    }
    await repository.upsertCatalogCards([catalogCard]);
  }

  const updated = await repository.updateDetectedCard(card.id, {
    selectedCatalogCardId: catalogCard.id,
    reviewStatus: 'corrected',
    userConfirmed: true,
    quantity: normaliseQuantity(input.quantity ?? card.quantity),
  });

  await repriceCard(updated, catalogCard);
  await refreshSessionCounters(session.id);

  await repository.recordEvent({
    userId: session.userId,
    analysisSessionId: session.id,
    eventType: 'card_match_corrected',
    metadata: { catalogCardId: catalogCard.id },
  });
  trackEvent('card_match_corrected');
  return updated;
}

export async function markCardUnknown(input: {
  detectedCardId: string;
  requester: Requester;
}): Promise<DetectedCard> {
  const repository = getRepository();
  const { card, session } = await loadCardForRequester(
    input.detectedCardId,
    input.requester,
  );

  const updated = await repository.updateDetectedCard(card.id, {
    reviewStatus: 'unknown',
    userConfirmed: true,
    selectedCatalogCardId: null,
  });
  await refreshSessionCounters(session.id);
  await repository.recordEvent({
    userId: session.userId,
    analysisSessionId: session.id,
    eventType: 'card_marked_unknown',
    metadata: {},
  });
  return updated;
}

export async function removeDetectedCard(input: {
  detectedCardId: string;
  requester: Requester;
}): Promise<void> {
  const repository = getRepository();
  const { card, session } = await loadCardForRequester(
    input.detectedCardId,
    input.requester,
  );
  await repository.deleteDetectedCard(card.id);
  await refreshSessionCounters(session.id);
  await repository.recordEvent({
    userId: session.userId,
    analysisSessionId: session.id,
    eventType: 'card_removed',
    metadata: {},
  });
}

export async function setCardQuantity(input: {
  detectedCardId: string;
  quantity: number;
  requester: Requester;
}): Promise<DetectedCard> {
  const repository = getRepository();
  const { card } = await loadCardForRequester(
    input.detectedCardId,
    input.requester,
  );
  return repository.updateDetectedCard(card.id, {
    quantity: normaliseQuantity(input.quantity),
  });
}

/** Re-run catalog matching for a single card using the current recognition data. */
export async function reanalyseCard(input: {
  detectedCardId: string;
  requester: Requester;
}): Promise<DetectedCard> {
  const repository = getRepository();
  const providers = getProviders();
  const { card } = await loadCardForRequester(
    input.detectedCardId,
    input.requester,
  );

  const matchInput: MatchInput = {
    visibleName: card.visibleName,
    visibleCardNumber: card.visibleCardNumber,
    possibleSetCode: null,
    language: card.detectedLanguage,
    variantHints: card.variantHints,
  };

  const pool = await providers.catalog.searchCards({
    name: card.visibleName ?? undefined,
    cardNumber: card.visibleCardNumber ?? undefined,
    limit: 25,
  });
  const ranked = rankCandidates(matchInput, pool, MAX_MATCH_CANDIDATES);
  await repository.upsertCatalogCards(ranked.map((entry) => entry.card));
  await repository.replaceMatchCandidates(
    card.id,
    ranked.map((entry, rank) => ({
      detectedCardId: card.id,
      catalogCardId: entry.card.id,
      matchScore: entry.score,
      matchReasons: entry.reasons,
      rank,
    })),
  );

  return repository.updateDetectedCard(card.id, { reviewStatus: 'pending' });
}

export async function searchCatalog(query: {
  name?: string;
  setName?: string;
  cardNumber?: string;
  pokedexNumber?: number;
}): Promise<CatalogCard[]> {
  const hasQuery = Boolean(
    query.name?.trim() ||
      query.setName?.trim() ||
      query.cardNumber?.trim() ||
      query.pokedexNumber,
  );
  if (!hasQuery) return [];
  return getProviders().catalog.searchCards({ ...query, limit: 20 });
}

/** Refresh market data for every confirmed card in a session. */
export async function refreshSessionPrices(input: {
  sessionId: string;
  requester: Requester;
}): Promise<number> {
  const repository = getRepository();
  const session = await loadAuthorisedSession(input.sessionId, input.requester);
  const cards = await repository.listDetectedCards(session.id);

  let refreshed = 0;
  for (const card of cards) {
    if (!card.selectedCatalogCardId) continue;
    const catalogCard = await repository.getCatalogCard(
      card.selectedCatalogCardId,
    );
    if (!catalogCard) continue;
    await repriceCard(card, catalogCard);
    refreshed += 1;
  }

  await repository.recordEvent({
    userId: session.userId,
    analysisSessionId: session.id,
    eventType: 'prices_refreshed',
    metadata: { cards: refreshed },
  });
  return refreshed;
}

export async function finaliseAnalysis(input: {
  sessionId: string;
  requester: Requester;
}): Promise<AnalysisSession> {
  const repository = getRepository();
  const session = await loadAuthorisedSession(input.sessionId, input.requester);
  assertTransition(session.status, 'completed');
  await refreshSessionCounters(session.id);
  return repository.updateSession(session.id, {
    status: 'completed',
    statusDetail: null,
    completedAt: new Date().toISOString(),
  });
}

export async function deleteAnalysis(input: {
  sessionId: string;
  requester: Requester;
}): Promise<void> {
  const repository = getRepository();
  const session = await loadAuthorisedSession(input.sessionId, input.requester);
  const images = await repository.listImages(session.id);
  await getFileStorage()
    .remove(images.map((image) => image.storagePath))
    .catch((error) =>
      logger.warn('Storage cleanup failed', { error: String(error) }),
    );
  await repository.deleteSession(session.id);
  await repository.recordEvent({
    userId: session.userId,
    analysisSessionId: null,
    eventType: 'analysis_deleted',
    metadata: {},
  });
}

async function repriceCard(
  card: DetectedCard,
  catalogCard: CatalogCard,
): Promise<void> {
  const repository = getRepository();
  const providers = getProviders();
  try {
    const estimate = await providers.pricing.getPriceEstimate({
      catalogCard,
      conditionBasis:
        card.conditionEstimate === 'unknown' ? 'ungraded' : 'near_mint_assumed',
    });
    await repository.savePriceEstimate({
      detectedCardId: card.id,
      catalogCardId: catalogCard.id,
      ...estimate,
    });
  } catch (error) {
    logger.warn('Reprice failed', { error: String(error) });
    await repository.savePriceEstimate({
      detectedCardId: card.id,
      catalogCardId: catalogCard.id,
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

async function refreshSessionCounters(sessionId: string): Promise<void> {
  const repository = getRepository();
  const cards = await repository.listDetectedCards(sessionId);
  await repository.updateSession(sessionId, {
    detectedCardsCount: cards.length,
    confirmedCardsCount: cards.filter(
      (card) =>
        card.reviewStatus === 'confirmed' || card.reviewStatus === 'corrected',
    ).length,
    unknownCardsCount: cards.filter((card) => card.reviewStatus === 'unknown')
      .length,
  });
}

function normaliseQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(99, Math.max(1, Math.round(quantity)));
}

export { isDedicatedPhotoRegion, estimateCondition };
