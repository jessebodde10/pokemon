import type { DataQuality, DataQualityFactor } from '@/types/report';

/**
 * Rule-based data quality score.
 *
 * Explicitly not produced by a language model: the score has to be
 * reproducible and explainable, so it is a weighted average of eight
 * measurable factors. Every factor keeps its own sub-score and a sentence
 * explaining what drove it.
 */

export type QualityInput = {
  /** One entry per card that is still part of the analysis. */
  cards: Array<{
    recognitionConfidence: number | null;
    userConfirmed: boolean;
    isUnknown: boolean;
    priceSampleSize: number | null;
    priceAgeDays: number | null;
    relativePriceSpread: number | null;
    imageQualityScore: number | null;
    variantKnown: boolean;
    languageKnown: boolean;
  }>;
};

const WEIGHTS = {
  recognition_confidence: 0.2,
  manual_confirmation: 0.2,
  price_sample_size: 0.15,
  price_recency: 0.12,
  source_agreement: 0.08,
  image_quality: 0.15,
  variant_known: 0.05,
  language_known: 0.05,
} as const satisfies Record<DataQualityFactor['key'], number>;

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function computeDataQuality(input: QualityInput): DataQuality {
  const { cards } = input;

  if (cards.length === 0) {
    return {
      score: 0,
      band: 'low',
      factors: [],
      explanation:
        'Er zijn nog geen kaarten in deze analyse, dus de datakwaliteit kan niet worden bepaald.',
    };
  }

  const recognised = cards.filter((card) => !card.isUnknown);

  const confidenceScore =
    average(
      recognised
        .map((card) => card.recognitionConfidence)
        .filter((value): value is number => value !== null),
    ) ?? 0;

  const confirmationScore =
    cards.filter((card) => card.userConfirmed).length / cards.length;

  const sampleScore =
    average(
      cards
        .map((card) => card.priceSampleSize)
        .filter((value): value is number => value !== null)
        .map((size) => clamp01(size / 20)),
    ) ?? 0;

  const recencyScore =
    average(
      cards
        .map((card) => card.priceAgeDays)
        .filter((value): value is number => value !== null)
        .map((ageDays) => clamp01(1 - ageDays / 90)),
    ) ?? 0;

  const agreementScore =
    average(
      cards
        .map((card) => card.relativePriceSpread)
        .filter((value): value is number => value !== null)
        .map((spread) => clamp01(1 - spread / 0.8)),
    ) ?? 0.5;

  const imageScore =
    average(
      cards
        .map((card) => card.imageQualityScore)
        .filter((value): value is number => value !== null),
    ) ?? 0;

  const variantScore = recognised.length
    ? recognised.filter((card) => card.variantKnown).length / recognised.length
    : 0;

  const languageScore = recognised.length
    ? recognised.filter((card) => card.languageKnown).length / recognised.length
    : 0;

  const unknownCount = cards.filter((card) => card.isUnknown).length;
  const unconfirmedVariants = recognised.filter(
    (card) => !card.variantKnown,
  ).length;
  const withoutPrices = cards.filter(
    (card) => card.priceSampleSize === null,
  ).length;

  const factors: DataQualityFactor[] = [
    {
      key: 'recognition_confidence',
      label: 'Herkenningszekerheid',
      score: clamp01(confidenceScore),
      weight: WEIGHTS.recognition_confidence,
      detail: `Gemiddelde herkenningszekerheid van ${Math.round(confidenceScore * 100)}% over ${recognised.length} herkende kaart(en).`,
    },
    {
      key: 'manual_confirmation',
      label: 'Handmatige bevestiging',
      score: clamp01(confirmationScore),
      weight: WEIGHTS.manual_confirmation,
      detail: `${cards.filter((card) => card.userConfirmed).length} van ${cards.length} kaarten zijn door jou beoordeeld.`,
    },
    {
      key: 'price_sample_size',
      label: 'Hoeveelheid prijsdata',
      score: clamp01(sampleScore),
      weight: WEIGHTS.price_sample_size,
      detail:
        withoutPrices > 0
          ? `Voor ${withoutPrices} kaart(en) is geen bruikbare prijsdata gevonden.`
          : 'Voor alle kaarten met een gekozen match is prijsdata gevonden.',
    },
    {
      key: 'price_recency',
      label: 'Recentheid prijsdata',
      score: clamp01(recencyScore),
      weight: WEIGHTS.price_recency,
      detail:
        'Gebaseerd op de datum van de meest recente prijswaarneming per kaart.',
    },
    {
      key: 'source_agreement',
      label: 'Overeenstemming tussen waarnemingen',
      score: clamp01(agreementScore),
      weight: WEIGHTS.source_agreement,
      detail:
        'Hoe dicht de lage en hoge schatting bij elkaar liggen ten opzichte van de middenwaarde.',
    },
    {
      key: 'image_quality',
      label: 'Kwaliteit van de afbeeldingen',
      score: clamp01(imageScore),
      weight: WEIGHTS.image_quality,
      detail: `Gemiddelde beeldkwaliteitsscore van ${Math.round(imageScore * 100)}%.`,
    },
    {
      key: 'variant_known',
      label: 'Bevestigde variant',
      score: clamp01(variantScore),
      weight: WEIGHTS.variant_known,
      detail:
        unconfirmedVariants > 0
          ? `Bij ${unconfirmedVariants} kaart(en) is de exacte variant nog onzeker.`
          : 'Van alle herkende kaarten is de variant bekend.',
    },
    {
      key: 'language_known',
      label: 'Bekende taal',
      score: clamp01(languageScore),
      weight: WEIGHTS.language_known,
      detail: 'Aandeel kaarten waarvan de taal is vastgesteld.',
    },
  ];

  const weighted = factors.reduce(
    (sum, factor) => sum + factor.score * factor.weight,
    0,
  );
  const score = Math.round(clamp01(weighted) * 100);
  const band: DataQuality['band'] =
    score >= 75 ? 'high' : score >= 45 ? 'medium' : 'low';

  return {
    score,
    band,
    factors,
    explanation: buildExplanation({
      band,
      totalCards: cards.length,
      recognisedCards: recognised.length,
      unknownCount,
      unconfirmedVariants,
      withoutPrices,
    }),
  };
}

export const DATA_QUALITY_BAND_LABELS: Record<DataQuality['band'], string> = {
  low: 'laag',
  medium: 'gemiddeld',
  high: 'hoog',
};

function buildExplanation(input: {
  band: DataQuality['band'];
  totalCards: number;
  recognisedCards: number;
  unknownCount: number;
  unconfirmedVariants: number;
  withoutPrices: number;
}): string {
  const parts: string[] = [
    `De datakwaliteit is ${DATA_QUALITY_BAND_LABELS[input.band]}.`,
  ];

  parts.push(
    input.unknownCount === 0
      ? `Alle ${input.totalCards} kaarten zijn herkend.`
      : `${input.recognisedCards} van ${input.totalCards} kaarten zijn herkend; ${input.unknownCount} kaart(en) staan als onbekend geregistreerd.`,
  );

  if (input.unconfirmedVariants > 0) {
    parts.push(
      `Bij ${input.unconfirmedVariants} kaart(en) is de exacte variant nog onzeker.`,
    );
  }
  if (input.withoutPrices > 0) {
    parts.push(
      `Voor ${input.withoutPrices} kaart(en) is onvoldoende marktdata beschikbaar.`,
    );
  }

  return parts.join(' ');
}
