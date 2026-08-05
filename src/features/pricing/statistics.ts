/**
 * Deterministic price statistics.
 *
 * Design rules that the rest of the app depends on:
 *  - too little data returns nulls, never an invented number;
 *  - the mid value is a recency-weighted median, not a mean;
 *  - the band is the interquartile range, so a single outlier cannot widen it.
 */

export type PriceObservation = {
  /** Price in EUR for a single copy. */
  priceEur: number;
  /** ISO timestamp of the observation. */
  observedAt: string;
};

export const MIN_SAMPLE_SIZE = 3;
/** Observations older than this no longer contribute. */
export const MAX_OBSERVATION_AGE_DAYS = 180;
/** Half-life used for recency weighting. */
export const RECENCY_HALF_LIFE_DAYS = 45;

export function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0] ?? null;
  const position = (sorted.length - 1) * q;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sorted[lowerIndex];
  const upper = sorted[upperIndex];
  if (lower === undefined || upper === undefined) return null;
  if (lowerIndex === upperIndex) return lower;
  return lower + (upper - lower) * (position - lowerIndex);
}

export function median(values: number[]): number | null {
  return quantile(
    [...values].sort((a, b) => a - b),
    0.5,
  );
}

export type OutlierFilterResult = {
  kept: PriceObservation[];
  removed: PriceObservation[];
  lowerFence: number | null;
  upperFence: number | null;
};

/**
 * Tukey fences at 1.5 IQR. With fewer than 4 observations there is not enough
 * signal to call anything an outlier, so everything is kept.
 */
export function filterOutliers(
  observations: PriceObservation[],
): OutlierFilterResult {
  if (observations.length < 4) {
    return {
      kept: [...observations],
      removed: [],
      lowerFence: null,
      upperFence: null,
    };
  }

  const sorted = observations.map((o) => o.priceEur).sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  if (q1 === null || q3 === null) {
    return {
      kept: [...observations],
      removed: [],
      lowerFence: null,
      upperFence: null,
    };
  }

  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  const kept: PriceObservation[] = [];
  const removed: PriceObservation[] = [];
  for (const observation of observations) {
    if (
      observation.priceEur < lowerFence ||
      observation.priceEur > upperFence
    ) {
      removed.push(observation);
    } else {
      kept.push(observation);
    }
  }
  return { kept, removed, lowerFence, upperFence };
}

export function ageInDays(observedAt: string, now: Date): number {
  const observed = Date.parse(observedAt);
  if (Number.isNaN(observed)) return Number.POSITIVE_INFINITY;
  return (now.getTime() - observed) / 86_400_000;
}

export function recencyWeight(ageDays: number): number {
  if (!Number.isFinite(ageDays) || ageDays < 0) return 0;
  return Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
}

/** Weighted median: the value at which cumulative weight crosses 50%. */
export function weightedMedian(
  entries: Array<{ value: number; weight: number }>,
): number | null {
  const usable = entries.filter((e) => e.weight > 0);
  if (usable.length === 0) return null;
  const sorted = [...usable].sort((a, b) => a.value - b.value);
  const totalWeight = sorted.reduce((sum, e) => sum + e.weight, 0);
  if (totalWeight <= 0) return null;

  let cumulative = 0;
  for (const entry of sorted) {
    cumulative += entry.weight;
    if (cumulative >= totalWeight / 2) return entry.value;
  }
  return sorted[sorted.length - 1]?.value ?? null;
}

export type PriceStatistics = {
  low: number | null;
  mid: number | null;
  high: number | null;
  /** Observations that actually contributed after filtering. */
  sampleSize: number;
  /** Observations supplied before filtering. */
  rawSampleSize: number;
  removedOutliers: number;
  /** 0..1, rule-based. */
  confidence: number;
  warnings: string[];
  newestObservationAt: string | null;
  /** (high - low) / mid, or null when it cannot be computed. */
  relativeSpread: number | null;
};

export const EMPTY_STATISTICS: PriceStatistics = {
  low: null,
  mid: null,
  high: null,
  sampleSize: 0,
  rawSampleSize: 0,
  removedOutliers: 0,
  confidence: 0,
  warnings: ['Onvoldoende marktdata'],
  newestObservationAt: null,
  relativeSpread: null,
};

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Compute a price band from raw observations.
 *
 * Returns null values (and an explicit warning) rather than a guess whenever
 * fewer than MIN_SAMPLE_SIZE usable observations remain.
 */
export function computePriceStatistics(
  observations: PriceObservation[],
  now: Date = new Date(),
): PriceStatistics {
  const warnings: string[] = [];
  const valid = observations.filter(
    (o) => Number.isFinite(o.priceEur) && o.priceEur > 0,
  );
  const rawSampleSize = valid.length;

  const fresh = valid.filter(
    (o) => ageInDays(o.observedAt, now) <= MAX_OBSERVATION_AGE_DAYS,
  );
  if (fresh.length < valid.length) {
    warnings.push(
      `${valid.length - fresh.length} waarneming(en) ouder dan ${MAX_OBSERVATION_AGE_DAYS} dagen niet meegerekend`,
    );
  }

  const { kept, removed } = filterOutliers(fresh);
  if (removed.length > 0) {
    warnings.push(
      `${removed.length} uitschieter(s) buiten beschouwing gelaten`,
    );
  }

  if (kept.length < MIN_SAMPLE_SIZE) {
    return {
      ...EMPTY_STATISTICS,
      rawSampleSize,
      sampleSize: kept.length,
      removedOutliers: removed.length,
      warnings: [
        ...warnings,
        `Onvoldoende marktdata: ${kept.length} van minimaal ${MIN_SAMPLE_SIZE} bruikbare waarnemingen`,
      ],
      newestObservationAt: newestOf(kept),
    };
  }

  const sortedValues = kept.map((o) => o.priceEur).sort((a, b) => a - b);
  const low = quantile(sortedValues, 0.25);
  const high = quantile(sortedValues, 0.75);
  const mid = weightedMedian(
    kept.map((o) => ({
      value: o.priceEur,
      weight: recencyWeight(ageInDays(o.observedAt, now)),
    })),
  );

  const relativeSpread =
    low !== null && high !== null && mid !== null && mid > 0
      ? (high - low) / mid
      : null;

  if (relativeSpread !== null && relativeSpread > 0.6) {
    warnings.push('De gevonden prijsdata lopen sterk uiteen');
  }

  const newestObservationAt = newestOf(kept);
  const newestAgeDays = newestObservationAt
    ? ageInDays(newestObservationAt, now)
    : Number.POSITIVE_INFINITY;
  if (newestAgeDays > 60) {
    warnings.push('De meest recente prijswaarneming is ouder dan 60 dagen');
  }

  return {
    low: low === null ? null : roundCents(low),
    mid: mid === null ? null : roundCents(mid),
    high: high === null ? null : roundCents(high),
    sampleSize: kept.length,
    rawSampleSize,
    removedOutliers: removed.length,
    confidence: computeConfidence({
      sampleSize: kept.length,
      relativeSpread,
      newestAgeDays,
    }),
    warnings,
    newestObservationAt,
    relativeSpread,
  };
}

function newestOf(observations: PriceObservation[]): string | null {
  let newest: string | null = null;
  let newestTime = Number.NEGATIVE_INFINITY;
  for (const observation of observations) {
    const time = Date.parse(observation.observedAt);
    if (Number.isNaN(time)) continue;
    if (time > newestTime) {
      newestTime = time;
      newest = observation.observedAt;
    }
  }
  return newest;
}

export function computeConfidence(input: {
  sampleSize: number;
  relativeSpread: number | null;
  newestAgeDays: number;
}): number {
  // Sample size saturates at 30 observations.
  const sampleScore = Math.min(1, input.sampleSize / 30);
  const spreadScore =
    input.relativeSpread === null
      ? 0.5
      : Math.max(0, 1 - input.relativeSpread / 0.8);
  const recencyScore = Number.isFinite(input.newestAgeDays)
    ? Math.max(0, 1 - input.newestAgeDays / 90)
    : 0;

  const score = sampleScore * 0.4 + spreadScore * 0.35 + recencyScore * 0.25;
  return Math.round(Math.max(0, Math.min(1, score)) * 100) / 100;
}
