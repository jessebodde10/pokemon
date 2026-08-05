import { describe, expect, it } from 'vitest';
import {
  EMPTY_RANGE,
  formatEuro,
  isConfirmed,
  multiplyRange,
  sumRanges,
  topCardsByMidValue,
  totalForConfirmedCards,
} from './totals';
import type { ReportCard, ValueRange } from '@/types/report';

function range(
  low: number | null,
  mid: number | null,
  high: number | null,
): ValueRange {
  return { currency: 'EUR', low, mid, high };
}

function reportCard(overrides: Partial<ReportCard> = {}): ReportCard {
  const unitValue = overrides.unitValue ?? range(10, 12, 15);
  return {
    detectedCardId: overrides.detectedCardId ?? 'card-1',
    name: 'Pikachu',
    setName: 'Demo set',
    setCode: 'MEW',
    cardNumber: '025/165',
    variant: 'normal',
    language: 'en',
    imageUrl: null,
    cropUrl: null,
    region: { x: 0, y: 0, width: 0.2, height: 0.2 },
    quantity: 1,
    reviewStatus: 'confirmed',
    userConfirmed: true,
    recognitionConfidence: 0.9,
    conditionEstimate: 'unknown',
    unitValue,
    lineValue: multiplyRange(unitValue, overrides.quantity ?? 1),
    priceSourceName: 'Demo',
    priceSourceUrl: null,
    priceUpdatedAt: '2026-08-01T00:00:00.000Z',
    priceSampleSize: 20,
    priceConfidence: 0.7,
    priceWarnings: [],
    hasPriceData: unitValue.mid !== null,
    attentionReasons: [],
    ...overrides,
  };
}

describe('multiplyRange', () => {
  it('multiplies every bound by the quantity', () => {
    expect(multiplyRange(range(10, 12, 15), 3)).toEqual(range(30, 36, 45));
  });

  it('keeps nulls null instead of turning them into zero', () => {
    expect(multiplyRange(EMPTY_RANGE, 5)).toEqual(range(null, null, null));
  });

  it('treats a quantity below one as one', () => {
    expect(multiplyRange(range(10, 12, 15), 0)).toEqual(range(10, 12, 15));
  });
});

describe('sumRanges', () => {
  it('sums each bound independently', () => {
    expect(sumRanges([range(10, 12, 15), range(5, 6, 7)])).toEqual(
      range(15, 18, 22),
    );
  });

  it('ignores missing values rather than counting them as zero', () => {
    const total = sumRanges([range(10, 12, 15), EMPTY_RANGE]);
    expect(total).toEqual(range(10, 12, 15));
  });

  it('returns all nulls when nothing has data', () => {
    expect(sumRanges([EMPTY_RANGE, EMPTY_RANGE])).toEqual(
      range(null, null, null),
    );
  });

  it('returns all nulls for an empty list', () => {
    expect(sumRanges([])).toEqual(range(null, null, null));
  });
});

describe('totalForConfirmedCards', () => {
  it('only counts confirmed and corrected cards', () => {
    const total = totalForConfirmedCards([
      reportCard({ detectedCardId: 'a', reviewStatus: 'confirmed' }),
      reportCard({ detectedCardId: 'b', reviewStatus: 'corrected' }),
      reportCard({ detectedCardId: 'c', reviewStatus: 'pending' }),
      reportCard({ detectedCardId: 'd', reviewStatus: 'unknown' }),
    ]);
    expect(total.mid).toBe(24);
  });

  it('multiplies by quantity', () => {
    const total = totalForConfirmedCards([
      reportCard({ quantity: 4, unitValue: range(10, 12, 15) }),
    ]);
    expect(total.mid).toBe(48);
  });

  it('excludes cards without price data from the sum but not from the list', () => {
    const cards = [
      reportCard({ detectedCardId: 'a' }),
      reportCard({
        detectedCardId: 'b',
        unitValue: EMPTY_RANGE,
        hasPriceData: false,
      }),
    ];
    expect(totalForConfirmedCards(cards).mid).toBe(12);
    expect(cards).toHaveLength(2);
  });

  it('returns null totals when no card is confirmed', () => {
    const total = totalForConfirmedCards([
      reportCard({ reviewStatus: 'pending' }),
    ]);
    expect(total.mid).toBeNull();
  });
});

describe('isConfirmed', () => {
  it('accepts confirmed and corrected only', () => {
    expect(isConfirmed(reportCard({ reviewStatus: 'confirmed' }))).toBe(true);
    expect(isConfirmed(reportCard({ reviewStatus: 'corrected' }))).toBe(true);
    expect(isConfirmed(reportCard({ reviewStatus: 'pending' }))).toBe(false);
    expect(isConfirmed(reportCard({ reviewStatus: 'unknown' }))).toBe(false);
  });
});

describe('topCardsByMidValue', () => {
  it('sorts descending and drops cards without a mid value', () => {
    const top = topCardsByMidValue([
      reportCard({ detectedCardId: 'low', unitValue: range(1, 2, 3) }),
      reportCard({ detectedCardId: 'high', unitValue: range(90, 100, 110) }),
      reportCard({ detectedCardId: 'none', unitValue: EMPTY_RANGE }),
    ]);
    expect(top.map((card) => card.detectedCardId)).toEqual(['high', 'low']);
  });

  it('respects the limit', () => {
    const cards = Array.from({ length: 20 }, (_, index) =>
      reportCard({
        detectedCardId: `card-${index}`,
        unitValue: range(index, index + 1, index + 2),
      }),
    );
    expect(topCardsByMidValue(cards, 10)).toHaveLength(10);
  });
});

describe('formatEuro', () => {
  it('renders an explicit message instead of a zero for missing data', () => {
    expect(formatEuro(null)).toBe('Onvoldoende marktdata');
  });

  it('formats an amount in euros', () => {
    expect(formatEuro(12.5)).toContain('12,50');
  });
});
