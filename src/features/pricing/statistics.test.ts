import { describe, expect, it } from 'vitest';
import {
  computeConfidence,
  computePriceStatistics,
  filterOutliers,
  MIN_SAMPLE_SIZE,
  median,
  quantile,
  recencyWeight,
  weightedMedian,
  type PriceObservation,
} from './statistics';

const NOW = new Date('2026-08-05T12:00:00.000Z');

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

function observations(
  values: Array<[price: number, ageDays: number]>,
): PriceObservation[] {
  return values.map(([priceEur, ageDays]) => ({
    priceEur,
    observedAt: daysAgo(ageDays),
  }));
}

describe('quantile', () => {
  it('interpolates between neighbouring values', () => {
    expect(quantile([10, 20, 30, 40], 0.25)).toBeCloseTo(17.5);
    expect(quantile([10, 20, 30, 40], 0.75)).toBeCloseTo(32.5);
  });

  it('returns null for an empty list', () => {
    expect(quantile([], 0.5)).toBeNull();
  });

  it('returns the single value for a one-element list', () => {
    expect(quantile([42], 0.9)).toBe(42);
  });
});

describe('median', () => {
  it('handles odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe('filterOutliers', () => {
  it('keeps everything when there are fewer than four observations', () => {
    const input = observations([
      [10, 1],
      [1000, 2],
      [12, 3],
    ]);
    const result = filterOutliers(input);
    expect(result.kept).toHaveLength(3);
    expect(result.removed).toHaveLength(0);
  });

  it('removes values outside the 1.5 IQR fences', () => {
    const input = observations([
      [10, 1],
      [11, 2],
      [12, 3],
      [13, 4],
      [500, 5],
    ]);
    const result = filterOutliers(input);
    expect(result.removed.map((o) => o.priceEur)).toEqual([500]);
    expect(result.kept).toHaveLength(4);
  });

  it('does not remove a tight cluster', () => {
    const input = observations([
      [100, 1],
      [102, 2],
      [104, 3],
      [106, 4],
      [108, 5],
    ]);
    expect(filterOutliers(input).removed).toHaveLength(0);
  });
});

describe('recencyWeight', () => {
  it('halves every half-life', () => {
    expect(recencyWeight(0)).toBeCloseTo(1);
    expect(recencyWeight(45)).toBeCloseTo(0.5);
    expect(recencyWeight(90)).toBeCloseTo(0.25);
  });

  it('is zero for a non-finite age', () => {
    expect(recencyWeight(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('weightedMedian', () => {
  it('follows the weight, not the count', () => {
    const result = weightedMedian([
      { value: 10, weight: 0.05 },
      { value: 10, weight: 0.05 },
      { value: 100, weight: 5 },
    ]);
    expect(result).toBe(100);
  });

  it('returns null when every weight is zero', () => {
    expect(weightedMedian([{ value: 10, weight: 0 }])).toBeNull();
  });
});

describe('computePriceStatistics', () => {
  it('returns nulls instead of a guess below the minimum sample size', () => {
    const stats = computePriceStatistics(
      observations([
        [10, 1],
        [12, 2],
      ]),
      NOW,
    );

    expect(stats.low).toBeNull();
    expect(stats.mid).toBeNull();
    expect(stats.high).toBeNull();
    expect(stats.sampleSize).toBeLessThan(MIN_SAMPLE_SIZE);
    expect(stats.confidence).toBe(0);
    expect(stats.warnings.join(' ')).toContain('Onvoldoende marktdata');
  });

  it('never invents a price for an empty observation list', () => {
    const stats = computePriceStatistics([], NOW);
    expect(stats.mid).toBeNull();
    expect(stats.rawSampleSize).toBe(0);
  });

  it('produces an ordered band from a healthy sample', () => {
    const stats = computePriceStatistics(
      observations([
        [95, 2],
        [100, 5],
        [105, 9],
        [110, 14],
        [98, 20],
        [102, 30],
      ]),
      NOW,
    );

    expect(stats.low).not.toBeNull();
    expect(stats.mid).not.toBeNull();
    expect(stats.high).not.toBeNull();
    expect(stats.low!).toBeLessThanOrEqual(stats.mid!);
    expect(stats.mid!).toBeLessThanOrEqual(stats.high!);
    expect(stats.sampleSize).toBe(6);
  });

  it('is deterministic for identical input', () => {
    const input = observations([
      [20, 1],
      [22, 4],
      [24, 8],
      [26, 15],
      [21, 40],
    ]);
    expect(computePriceStatistics(input, NOW)).toEqual(
      computePriceStatistics(input, NOW),
    );
  });

  it('drops observations older than the maximum age', () => {
    const stats = computePriceStatistics(
      observations([
        [10, 1],
        [11, 2],
        [12, 3],
        [900, 400],
      ]),
      NOW,
    );
    expect(stats.warnings.join(' ')).toContain('ouder dan 180 dagen');
    expect(stats.high!).toBeLessThan(100);
  });

  it('warns when the band is wide relative to the middle', () => {
    const stats = computePriceStatistics(
      observations([
        [10, 1],
        [40, 2],
        [80, 3],
        [140, 4],
        [200, 5],
      ]),
      NOW,
    );
    expect(stats.warnings.join(' ')).toContain('sterk uiteen');
  });

  it('weights recent observations more heavily in the mid value', () => {
    const stale = computePriceStatistics(
      observations([
        [100, 150],
        [100, 140],
        [100, 130],
        [200, 1],
        [200, 2],
        [200, 3],
      ]),
      NOW,
    );
    expect(stale.mid).toBe(200);
  });
});

describe('computeConfidence', () => {
  it('rises with sample size and recency', () => {
    const weak = computeConfidence({
      sampleSize: 3,
      relativeSpread: 0.7,
      newestAgeDays: 80,
    });
    const strong = computeConfidence({
      sampleSize: 40,
      relativeSpread: 0.05,
      newestAgeDays: 1,
    });
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBeLessThanOrEqual(1);
    expect(weak).toBeGreaterThanOrEqual(0);
  });
});
