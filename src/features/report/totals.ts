import type { ReportCard, ValueRange } from '@/types/report';

/**
 * Report arithmetic.
 *
 * A missing price is `null`, never `0`. Summing therefore has to distinguish
 * "no data" from "worth nothing", otherwise every total would silently
 * understate the collection while looking authoritative.
 */

export const EMPTY_RANGE: ValueRange = {
  low: null,
  mid: null,
  high: null,
  currency: 'EUR',
};

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function multiplyRange(range: ValueRange, quantity: number): ValueRange {
  const factor = Math.max(1, Math.round(quantity));
  return {
    currency: 'EUR',
    low: range.low === null ? null : roundCents(range.low * factor),
    mid: range.mid === null ? null : roundCents(range.mid * factor),
    high: range.high === null ? null : roundCents(range.high * factor),
  };
}

/**
 * Sums a list of ranges. Cards without data contribute nothing and are
 * reported separately by the caller, so the total is always "at least this",
 * never a guess about the missing entries.
 */
export function sumRanges(ranges: ValueRange[]): ValueRange {
  let low: number | null = null;
  let mid: number | null = null;
  let high: number | null = null;

  for (const range of ranges) {
    if (range.low !== null) low = (low ?? 0) + range.low;
    if (range.mid !== null) mid = (mid ?? 0) + range.mid;
    if (range.high !== null) high = (high ?? 0) + range.high;
  }

  return {
    currency: 'EUR',
    low: low === null ? null : roundCents(low),
    mid: mid === null ? null : roundCents(mid),
    high: high === null ? null : roundCents(high),
  };
}

export function isConfirmed(card: ReportCard): boolean {
  return card.reviewStatus === 'confirmed' || card.reviewStatus === 'corrected';
}

/** Only confirmed or corrected cards may contribute to the headline total. */
export function totalForConfirmedCards(cards: ReportCard[]): ValueRange {
  return sumRanges(cards.filter(isConfirmed).map((card) => card.lineValue));
}

export function topCardsByMidValue(
  cards: ReportCard[],
  limit = 10,
): ReportCard[] {
  return [...cards]
    .filter((card) => card.lineValue.mid !== null)
    .sort((a, b) => {
      const diff = (b.lineValue.mid ?? 0) - (a.lineValue.mid ?? 0);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

export function formatEuro(value: number | null): string {
  if (value === null) return 'Onvoldoende marktdata';
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

export function formatRange(range: ValueRange): string {
  if (range.mid === null) return 'Onvoldoende marktdata';
  return `${formatEuro(range.low)} – ${formatEuro(range.high)}`;
}
