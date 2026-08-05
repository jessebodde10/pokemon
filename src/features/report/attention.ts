import type { AttentionReason, ReportCard } from '@/types/report';

/**
 * Selects cards that deserve a closer look.
 *
 * Every message is descriptive, never advisory: the product does not tell
 * anyone to buy, sell, hold or grade. It only points at what is uncertain or
 * missing in the data.
 */

export const LOW_CONFIDENCE_THRESHOLD = 0.6;
export const WIDE_SPREAD_THRESHOLD = 0.6;
export const STALE_PRICE_DAYS = 60;

const RARE_VARIANT_MARKERS = [
  'alternate art',
  'special illustration',
  'illustration rare',
  'secret',
  'full art',
  'rainbow',
  'gold',
];

export type AttentionInput = {
  card: ReportCard;
  priceAgeDays: number | null;
  relativeSpread: number | null;
  valueThresholdEur: number;
  isDedicatedPhoto: boolean;
  setOrNumberConfirmed: boolean;
};

export function collectAttentionReasons(
  input: AttentionInput,
): AttentionReason[] {
  const reasons: AttentionReason[] = [];
  const { card } = input;

  const midValue = card.lineValue.mid;
  if (midValue !== null && midValue >= input.valueThresholdEur) {
    reasons.push({
      code: 'high_estimated_value',
      message: `De geschatte middenwaarde ligt boven €${input.valueThresholdEur}. Een zorgvuldige controle van deze kaart is zinvol.`,
    });
  }

  if (
    input.relativeSpread !== null &&
    input.relativeSpread > WIDE_SPREAD_THRESHOLD
  ) {
    reasons.push({
      code: 'wide_price_spread',
      message: 'De gevonden prijsdata lopen sterk uiteen.',
    });
  }

  if (!card.hasPriceData) {
    reasons.push({
      code: 'insufficient_price_data',
      message:
        'Onvoldoende marktdata voor een betrouwbare schatting. Er wordt bewust geen bedrag getoond.',
    });
  } else if (
    input.priceAgeDays !== null &&
    input.priceAgeDays > STALE_PRICE_DAYS
  ) {
    reasons.push({
      code: 'stale_price_data',
      message: `De meest recente prijswaarneming is ${Math.round(input.priceAgeDays)} dagen oud.`,
    });
  }

  if (
    card.recognitionConfidence !== null &&
    card.recognitionConfidence < LOW_CONFIDENCE_THRESHOLD
  ) {
    reasons.push({
      code: 'low_recognition_confidence',
      message:
        'De herkenning van deze kaart is onzeker. Controleer of de naam, set en het kaartnummer kloppen.',
    });
  }

  if (!input.setOrNumberConfirmed) {
    reasons.push({
      code: 'set_or_number_unconfirmed',
      message:
        'De set en het kaartnummer zijn nog niet met voldoende zekerheid vastgesteld.',
    });
  }

  const variantText = (card.variant ?? '').toLowerCase();
  if (RARE_VARIANT_MARKERS.some((marker) => variantText.includes(marker))) {
    reasons.push({
      code: 'possible_rare_variant',
      message:
        'Dit lijkt een bijzondere variant. Controleer of dit de holo- of reverse-holovariant is en of het kaartnummer klopt.',
    });
  }

  const needsBetterPhoto =
    !input.isDedicatedPhoto &&
    midValue !== null &&
    midValue >= input.valueThresholdEur;
  if (needsBetterPhoto || card.conditionEstimate === 'needs_better_photo') {
    reasons.push({
      code: 'needs_dedicated_photo',
      message:
        'Maak van deze kaart een losse voor- en achterkantfoto voor een betere beoordeling.',
    });
  }

  return reasons;
}

/** Attention cards, most severe first. */
export function sortAttentionCards(cards: ReportCard[]): ReportCard[] {
  const severity = (card: ReportCard): number => {
    let score = card.attentionReasons.length;
    if (card.lineValue.mid !== null)
      score += Math.min(5, card.lineValue.mid / 100);
    if (!card.hasPriceData) score += 1;
    return score;
  };
  return [...cards].sort((a, b) => {
    const diff = severity(b) - severity(a);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });
}
