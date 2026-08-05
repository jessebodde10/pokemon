import type { ConditionEstimate } from '@/types/domain';

/**
 * Rule-based image quality and condition heuristics.
 *
 * Deliberately conservative: a binder photo can never produce a condition
 * estimate other than `unknown`, because the back of the card, the edges and
 * the surface are simply not visible.
 */

export const CONDITION_LABELS: Record<ConditionEstimate, string> = {
  unknown: 'Onbekend',
  possibly_near_mint: 'Mogelijk near mint',
  possibly_lightly_played: 'Mogelijk lightly played',
  visibly_damaged: 'Zichtbaar beschadigd',
  needs_better_photo: 'Betere foto nodig',
};

export const CONDITION_REQUIREMENTS = [
  'Foto van de voorzijde',
  'Foto van de achterzijde',
  'Scherpe close-up',
  'Neutraal licht',
  'Beperkte reflectie',
];

const QUALITY_PENALTIES: Record<string, number> = {
  glare: 0.18,
  blurry: 0.28,
  angle: 0.12,
  'partially covered': 0.22,
  'low resolution': 0.25,
  dark: 0.15,
};

/** 0..1 quality score derived from resolution and reported warnings. */
export function computeImageQualityScore(input: {
  width: number;
  height: number;
  warnings: string[];
}): number {
  const megapixels = (input.width * input.height) / 1_000_000;
  // Below ~1MP a binder page simply does not carry enough detail per card.
  const resolutionScore = Math.max(0, Math.min(1, (megapixels - 0.3) / 3.7));

  let score = 0.35 + resolutionScore * 0.65;
  for (const warning of input.warnings) {
    score -= QUALITY_PENALTIES[warning.toLowerCase()] ?? 0.08;
  }
  return Math.round(Math.max(0, Math.min(1, score)) * 100) / 100;
}

/**
 * Resolution below which a binder page cannot carry enough detail per card.
 *
 * A 3x3 sheet divides the frame into nine tiles; at 2 MP each tile is roughly
 * 470x350, which is about the floor for reading a printed card number.
 */
export const MIN_RECOMMENDED_MEGAPIXELS = 2;
export const MIN_USABLE_MEGAPIXELS = 0.8;

export type PhotoQualityVerdict = {
  level: 'ok' | 'warn' | 'poor';
  messages: string[];
};

/**
 * User-facing quality assessment, shown *before* an analysis is started.
 *
 * The point is to spend the user's attempt on a photo that can actually work:
 * the same signals were previously only computed server-side, after the
 * analysis had already begun.
 */
export function describePhotoQuality(input: {
  width: number;
  height: number;
  byteSize: number;
}): PhotoQualityVerdict {
  const megapixels = (input.width * input.height) / 1_000_000;
  const messages: string[] = [];
  let level: PhotoQualityVerdict['level'] = 'ok';

  if (megapixels < MIN_USABLE_MEGAPIXELS) {
    level = 'poor';
    messages.push(
      `Deze foto is ${megapixels.toFixed(1)} megapixel. Kaartnummers zijn hierop vrijwel zeker onleesbaar.`,
    );
  } else if (megapixels < MIN_RECOMMENDED_MEGAPIXELS) {
    level = 'warn';
    messages.push(
      `Deze foto is ${megapixels.toFixed(1)} megapixel. Bij een volle binderpagina worden kaartnummers dan lastig leesbaar.`,
    );
  }

  // Bytes per pixel exposes heavy re-compression (screenshots, chat forwards)
  // that resolution alone does not reveal.
  const bytesPerPixel =
    input.byteSize / Math.max(1, input.width * input.height);
  if (bytesPerPixel < 0.08 && megapixels >= MIN_USABLE_MEGAPIXELS) {
    if (level === 'ok') level = 'warn';
    messages.push(
      'Dit bestand is sterk gecomprimeerd. Stuur je de foto via een chat-app door, gebruik dan het origineel.',
    );
  }

  return { level, messages };
}

export function qualityWarningsFor(input: {
  width: number;
  height: number;
  byteSize: number;
}): string[] {
  const warnings: string[] = [];
  if (input.width * input.height < 800_000) warnings.push('low resolution');
  if (input.byteSize < 60_000) {
    warnings.push('sterk gecomprimeerd bestand');
  }
  return warnings;
}

/**
 * Condition estimate for a detected card.
 *
 * `isDedicatedPhoto` means the image contained a single card filling most of
 * the frame. Anything else stays `unknown`.
 */
export function estimateCondition(input: {
  isDedicatedPhoto: boolean;
  imageQualityScore: number | null;
  warnings: string[];
}): ConditionEstimate {
  if (!input.isDedicatedPhoto) return 'unknown';

  const quality = input.imageQualityScore ?? 0;
  const lowered = input.warnings.map((warning) => warning.toLowerCase());
  if (quality < 0.45 || lowered.includes('blurry')) {
    return 'needs_better_photo';
  }
  if (lowered.includes('visible damage') || lowered.includes('creased')) {
    return 'visibly_damaged';
  }
  // Even a good single-card photo only supports a hedged statement.
  return quality >= 0.75 ? 'possibly_near_mint' : 'possibly_lightly_played';
}

/** A region covering most of the frame indicates a dedicated single-card shot. */
export function isDedicatedPhotoRegion(region: {
  width: number;
  height: number;
}): boolean {
  return region.width * region.height >= 0.45;
}
