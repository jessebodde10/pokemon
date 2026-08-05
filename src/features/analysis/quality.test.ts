import { describe, expect, it } from 'vitest';
import {
  computeImageQualityScore,
  reconcileSourceMetrics,
  type ImageMetrics,
} from './quality';

/**
 * The browser downscales a photo before uploading it, so the stored file is
 * smaller than what the user photographed. These rules decide which of the two
 * quality judgement is allowed to describe.
 */
describe('reconcileSourceMetrics', () => {
  const stored: ImageMetrics = {
    width: 1600,
    height: 1200,
    byteSize: 380_000,
  };

  it('falls back to the stored file when nothing is claimed', () => {
    expect(reconcileSourceMetrics(stored, null)).toEqual(stored);
  });

  it('honours a plausible original', () => {
    const claimed: ImageMetrics = {
      width: 4032,
      height: 3024,
      byteSize: 8_400_000,
    };
    expect(reconcileSourceMetrics(stored, claimed)).toEqual(claimed);
  });

  it('rejects an original smaller than the file that arrived', () => {
    const claimed: ImageMetrics = {
      width: 800,
      height: 600,
      byteSize: 900_000,
    };
    expect(reconcileSourceMetrics(stored, claimed)).toEqual(stored);
  });

  it('rejects a claim that shrinks only one dimension', () => {
    const claimed: ImageMetrics = {
      width: 4032,
      height: 900,
      byteSize: 8_400_000,
    };
    expect(reconcileSourceMetrics(stored, claimed)).toEqual(stored);
  });

  it('rejects a byte size below what was actually stored', () => {
    const claimed: ImageMetrics = {
      width: 4032,
      height: 3024,
      byteSize: 1_000,
    };
    expect(reconcileSourceMetrics(stored, claimed)).toEqual(stored);
  });

  it('rejects an implausibly large resolution', () => {
    const claimed: ImageMetrics = {
      width: 60_000,
      height: 40_000,
      byteSize: 9_000_000,
    };
    expect(reconcileSourceMetrics(stored, claimed)).toEqual(stored);
  });

  it('rejects a non-finite claim', () => {
    const claimed: ImageMetrics = {
      width: Number.POSITIVE_INFINITY,
      height: 3024,
      byteSize: 8_400_000,
    };
    expect(reconcileSourceMetrics(stored, claimed)).toEqual(stored);
  });
});

describe('downscaling and the quality score', () => {
  /**
   * The regression this guards against: scoring the downscaled copy drops a
   * sharp 12MP photo far enough to change its condition estimate from
   * "possibly near mint" to "possibly lightly played".
   */
  it('keeps a good photo scoring high after a downscale', () => {
    const original: ImageMetrics = {
      width: 4032,
      height: 3024,
      byteSize: 8_400_000,
    };
    const stored: ImageMetrics = {
      width: 1600,
      height: 1200,
      byteSize: 380_000,
    };

    const metrics = reconcileSourceMetrics(stored, original);
    const score = computeImageQualityScore({
      width: metrics.width,
      height: metrics.height,
      warnings: [],
    });
    const naiveScore = computeImageQualityScore({
      width: stored.width,
      height: stored.height,
      warnings: [],
    });

    expect(score).toBeGreaterThanOrEqual(0.75);
    expect(naiveScore).toBeLessThan(0.75);
  });
});
