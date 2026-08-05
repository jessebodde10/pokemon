import { serverConfig } from '@/config/env';
import { isDedicatedPhotoRegion } from '@/features/analysis/quality';
import {
  collectAttentionReasons,
  sortAttentionCards,
} from '@/features/report/attention';
import { computeDataQuality } from '@/features/report/data-quality';
import {
  EMPTY_RANGE,
  formatEuro,
  isConfirmed,
  multiplyRange,
  topCardsByMidValue,
  totalForConfirmedCards,
} from '@/features/report/totals';
import { getRepository } from '@/repositories';
import {
  loadAuthorisedSession,
  type Requester,
} from '@/services/analysis-access';
import { trackEvent } from '@/services/analytics';
import type {
  AnalysisImage,
  CatalogCard,
  DetectedCard,
  StoredPriceEstimate,
} from '@/types/domain';
import type {
  CollectionReport,
  ReportCard,
  ReportNarrative,
  ValueRange,
} from '@/types/report';

/**
 * Builds the collection report from stored data only.
 *
 * No language model is involved in any number, count or selection here. The
 * narrative at the end is assembled from these same computed facts, so nothing
 * in the report text can contradict the table below it.
 */
export async function generateCollectionReport(
  sessionId: string,
  requester: Requester,
): Promise<CollectionReport> {
  const repository = getRepository();
  const session = await loadAuthorisedSession(sessionId, requester);

  const [cards, images, prices] = await Promise.all([
    repository.listDetectedCards(sessionId),
    repository.listImages(sessionId),
    repository.listPriceEstimates(sessionId),
  ]);

  const catalogIds = cards
    .map((card) => card.selectedCatalogCardId)
    .filter((id): id is string => id !== null);
  const catalogCards = await repository.getCatalogCards([
    ...new Set(catalogIds),
  ]);
  const catalogById = new Map(catalogCards.map((card) => [card.id, card]));
  const priceByCardId = new Map(
    prices.map((price) => [price.detectedCardId, price]),
  );
  const imageById = new Map(images.map((image) => [image.id, image]));

  const now = new Date();
  const reportCards = cards.map((card) =>
    buildReportCard({
      card,
      catalogCard: card.selectedCatalogCardId
        ? (catalogById.get(card.selectedCatalogCardId) ?? null)
        : null,
      price: priceByCardId.get(card.id) ?? null,
      image: imageById.get(card.analysisImageId) ?? null,
      now,
    }),
  );

  const confirmed = reportCards.filter(isConfirmed);
  const unknownCards = reportCards.filter(
    (card) => card.reviewStatus === 'unknown',
  );
  const pending = reportCards.filter((card) => card.reviewStatus === 'pending');

  const dataQuality = computeDataQuality({
    cards: reportCards.map((card) => {
      const price = priceByCardId.get(card.detectedCardId) ?? null;
      const image = imageById.get(
        cards.find((c) => c.id === card.detectedCardId)?.analysisImageId ?? '',
      );
      return {
        recognitionConfidence: card.recognitionConfidence,
        userConfirmed: card.userConfirmed,
        isUnknown: card.reviewStatus === 'unknown',
        priceSampleSize: card.hasPriceData ? card.priceSampleSize : null,
        priceAgeDays: priceAgeDays(price, now),
        relativePriceSpread: relativeSpread(card.unitValue),
        imageQualityScore: image?.qualityScore ?? null,
        variantKnown: card.variant !== null && card.variant !== '',
        languageKnown: card.language !== null && card.language !== 'unknown',
      };
    }),
  });

  const withAttention = reportCards.map((card) => {
    const price = priceByCardId.get(card.detectedCardId) ?? null;
    return {
      ...card,
      attentionReasons: collectAttentionReasons({
        card,
        priceAgeDays: priceAgeDays(price, now),
        relativeSpread: relativeSpread(card.unitValue),
        valueThresholdEur: serverConfig.report.attentionValueThresholdEur,
        isDedicatedPhoto: isDedicatedPhotoRegion(card.region),
        setOrNumberConfirmed:
          card.setName !== null &&
          card.cardNumber !== null &&
          card.userConfirmed,
      }),
    };
  });

  const attentionCards = sortAttentionCards(
    withAttention.filter((card) => card.attentionReasons.length > 0),
  );

  const totalValue = totalForConfirmedCards(withAttention);
  const cardsWithoutPriceData = confirmed.filter(
    (card) => !card.hasPriceData,
  ).length;

  const summary = {
    totalDetected: reportCards.length,
    totalConfirmed: confirmed.length,
    totalUnknown: unknownCards.length,
    totalRemoved: 0,
    totalPending: pending.length,
    cardsWithoutPriceData,
    totalValue,
    lastUpdatedAt: newestPriceUpdate(prices),
    generatedAt: now.toISOString(),
  };

  const warnings = collectReportWarnings({
    pendingCount: pending.length,
    unknownCount: unknownCards.length,
    cardsWithoutPriceData,
    isMockData: prices.some((price) =>
      price.warnings.some((warning) => warning.startsWith('Demodata')),
    ),
  });

  const narrative = buildNarrative({
    totalValue,
    confirmedCount: confirmed.length,
    detectedCount: reportCards.length,
    unknownCount: unknownCards.length,
    pendingCount: pending.length,
    cardsWithoutPriceData,
    dataQualityExplanation: dataQuality.explanation,
    topCard:
      topCardsByMidValue(withAttention.filter(isConfirmed), 1)[0] ?? null,
    attentionCount: attentionCards.length,
  });

  trackEvent('report_viewed', {
    confirmed_cards: confirmed.length,
    data_quality: dataQuality.score,
  });

  return {
    sessionId,
    status: session.status,
    summary,
    dataQuality,
    topCards: topCardsByMidValue(withAttention.filter(isConfirmed), 10),
    attentionCards,
    allCards: withAttention,
    unknownCards,
    warnings,
    narrative,
  };
}

function buildReportCard(input: {
  card: DetectedCard;
  catalogCard: CatalogCard | null;
  price: StoredPriceEstimate | null;
  image: AnalysisImage | null;
  now: Date;
}): ReportCard {
  const { card, catalogCard, price } = input;

  const unitValue: ValueRange = price
    ? { currency: 'EUR', low: price.low, mid: price.mid, high: price.high }
    : EMPTY_RANGE;

  return {
    detectedCardId: card.id,
    name: catalogCard?.name ?? card.visibleName ?? 'Onbekende kaart',
    setName: catalogCard?.setName ?? null,
    setCode: catalogCard?.setCode ?? null,
    cardNumber: catalogCard?.cardNumber ?? card.visibleCardNumber,
    variant: catalogCard?.variant ?? null,
    language: catalogCard?.language ?? card.detectedLanguage,
    imageUrl: catalogCard?.imageSmallUrl ?? null,
    cropUrl: null,
    region: card.region,
    quantity: card.quantity,
    reviewStatus: card.reviewStatus,
    userConfirmed: card.userConfirmed,
    recognitionConfidence: card.recognitionConfidence,
    conditionEstimate: card.conditionEstimate,
    unitValue,
    lineValue: multiplyRange(unitValue, card.quantity),
    priceSourceName: price?.sourceName ?? null,
    priceSourceUrl: price?.sourceUrl ?? null,
    priceUpdatedAt: price?.lastUpdatedAt ?? null,
    priceSampleSize: price?.sampleSize ?? 0,
    priceConfidence: price?.confidence ?? null,
    priceWarnings: price?.warnings ?? [],
    hasPriceData: price?.mid !== null && price?.mid !== undefined,
    attentionReasons: [],
  };
}

function priceAgeDays(
  price: StoredPriceEstimate | null,
  now: Date,
): number | null {
  if (!price?.lastUpdatedAt) return null;
  const parsed = Date.parse(price.lastUpdatedAt);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, (now.getTime() - parsed) / 86_400_000);
}

function relativeSpread(range: ValueRange): number | null {
  if (range.low === null || range.high === null || range.mid === null) {
    return null;
  }
  if (range.mid <= 0) return null;
  return (range.high - range.low) / range.mid;
}

function newestPriceUpdate(prices: StoredPriceEstimate[]): string | null {
  let newest: string | null = null;
  for (const price of prices) {
    if (!price.lastUpdatedAt) continue;
    if (newest === null || price.lastUpdatedAt > newest) {
      newest = price.lastUpdatedAt;
    }
  }
  return newest;
}

function collectReportWarnings(input: {
  pendingCount: number;
  unknownCount: number;
  cardsWithoutPriceData: number;
  isMockData: boolean;
}): string[] {
  const warnings: string[] = [];
  if (input.isMockData) {
    warnings.push(
      'Deze analyse gebruikt demodata. De getoonde bedragen zijn voorbeelden en geen echte marktwaarnemingen.',
    );
  }
  if (input.pendingCount > 0) {
    warnings.push(
      `${input.pendingCount} kaart(en) zijn nog niet beoordeeld en tellen niet mee in het totaal.`,
    );
  }
  if (input.unknownCount > 0) {
    warnings.push(
      `${input.unknownCount} kaart(en) zijn als onbekend gemarkeerd en tellen niet mee in het totaal.`,
    );
  }
  if (input.cardsWithoutPriceData > 0) {
    warnings.push(
      `Voor ${input.cardsWithoutPriceData} bevestigde kaart(en) is onvoldoende marktdata gevonden. Deze zijn niet als €0 meegeteld.`,
    );
  }
  return warnings;
}

/**
 * Deterministic narrative.
 *
 * Every sentence is derived from the computed report facts. A language model
 * may later rephrase this text, but it is given these facts and a strict
 * schema and is never allowed to introduce a number of its own.
 */
export function buildNarrative(input: {
  totalValue: ValueRange;
  confirmedCount: number;
  detectedCount: number;
  unknownCount: number;
  pendingCount: number;
  cardsWithoutPriceData: number;
  dataQualityExplanation: string;
  topCard: ReportCard | null;
  attentionCount: number;
}): ReportNarrative {
  const headline =
    input.totalValue.mid === null
      ? 'Nog onvoldoende marktdata voor een totaalschatting'
      : `Indicatieve waarde tussen ${formatEuro(input.totalValue.low)} en ${formatEuro(input.totalValue.high)}`;

  const summaryParts = [
    `Van de ${input.detectedCount} gevonden kaarten heb je er ${input.confirmedCount} bevestigd.`,
  ];
  if (input.totalValue.mid !== null) {
    summaryParts.push(
      `De meest waarschijnlijke schatting voor die bevestigde kaarten is ${formatEuro(input.totalValue.mid)}, op basis van de beschikbare gegevens.`,
    );
  } else {
    summaryParts.push(
      'Er is nog geen totaalschatting mogelijk omdat er te weinig bruikbare prijsdata is.',
    );
  }
  summaryParts.push(input.dataQualityExplanation);

  const highlights: string[] = [];
  if (input.topCard) {
    highlights.push(
      `Hoogst geschatte kaart: ${input.topCard.name}${input.topCard.setName ? ` (${input.topCard.setName})` : ''} met een indicatieve middenwaarde van ${formatEuro(input.topCard.lineValue.mid)}.`,
    );
  }
  if (input.confirmedCount > 0) {
    highlights.push(
      `${input.confirmedCount} kaart(en) zijn door jou gecontroleerd en tellen mee in het totaal.`,
    );
  }
  if (input.attentionCount > 0) {
    highlights.push(
      `${input.attentionCount} kaart(en) staan in "Verdient extra aandacht".`,
    );
  }

  const cautions: string[] = [];
  if (input.pendingCount > 0) {
    cautions.push(
      `${input.pendingCount} kaart(en) wachten nog op jouw controle en tellen niet mee.`,
    );
  }
  if (input.unknownCount > 0) {
    cautions.push(
      `${input.unknownCount} kaart(en) konden niet worden vastgesteld. Meer foto's nodig voor een betere beoordeling.`,
    );
  }
  if (input.cardsWithoutPriceData > 0) {
    cautions.push(
      `Voor ${input.cardsWithoutPriceData} kaart(en) is onvoldoende marktdata beschikbaar.`,
    );
  }
  cautions.push(
    'Alle bedragen zijn indicatief en gebaseerd op ongeslabde exemplaren in vergelijkbare, niet professioneel beoordeelde staat.',
  );

  return {
    headline,
    summary: summaryParts.join(' '),
    highlights,
    cautions,
  };
}
