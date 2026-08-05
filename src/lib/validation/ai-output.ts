import { z } from 'zod';

/**
 * Contract for multimodal vision output.
 *
 * The model is untrusted input: everything it returns is parsed through these
 * schemas before it can reach the database. Coordinates must be normalised
 * between 0 and 1 and the region must stay inside the image.
 */

const normalised = z.number().min(0).max(1);

export const visionRegionSchema = z
  .object({
    x: normalised,
    y: normalised,
    width: z.number().gt(0).max(1),
    height: z.number().gt(0).max(1),
  })
  .refine((r) => r.x + r.width <= 1.0001, {
    message: 'region extends beyond the right edge of the image',
  })
  .refine((r) => r.y + r.height <= 1.0001, {
    message: 'region extends beyond the bottom edge of the image',
  });

export const visionCardSchema = z.object({
  region: visionRegionSchema,
  visibleName: z.string().trim().min(1).max(120).nullable().catch(null),
  visibleCardNumber: z.string().trim().min(1).max(24).nullable().catch(null),
  possibleSetCode: z.string().trim().min(1).max(24).nullable().catch(null),
  language: z.enum(['en', 'nl', 'unknown']).catch('unknown'),
  variantHints: z.array(z.string().trim().min(1).max(60)).max(8).catch([]),
  recognitionConfidence: z.number().min(0).max(1),
  imageQualityWarnings: z
    .array(z.string().trim().min(1).max(60))
    .max(8)
    .catch([]),
});

export const visionResponseSchema = z.object({
  cards: z.array(visionCardSchema).max(64),
});

export type VisionCard = z.infer<typeof visionCardSchema>;
export type VisionResponse = z.infer<typeof visionResponseSchema>;

/**
 * Models frequently wrap JSON in prose or markdown fences. Extract the first
 * balanced top-level object before parsing so a chatty model does not become
 * a hard failure.
 */
export function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  const start = candidate.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < candidate.length; i += 1) {
    const char = candidate[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      if (inString) escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  return null;
}

export type VisionParseResult =
  | { ok: true; data: VisionResponse }
  | { ok: false; reason: 'not_json' | 'schema_mismatch'; issues: string[] };

/** Parse untrusted model output. Never throws. */
export function parseVisionResponse(raw: string): VisionParseResult {
  const json = extractJsonObject(raw);
  if (!json) {
    return { ok: false, reason: 'not_json', issues: ['no JSON object found'] };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'not_json', issues: ['invalid JSON syntax'] };
  }

  const result = visionResponseSchema.safeParse(parsedJson);
  if (!result.success) {
    return {
      ok: false,
      reason: 'schema_mismatch',
      issues: result.error.issues.map(
        (issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`,
      ),
    };
  }
  return { ok: true, data: result.data };
}

/** Strict schema for the optional LLM-generated report narrative. */
export const reportNarrativeSchema = z.object({
  headline: z.string().trim().min(3).max(120),
  summary: z.string().trim().min(10).max(600),
  highlights: z.array(z.string().trim().min(3).max(200)).max(5),
  cautions: z.array(z.string().trim().min(3).max(200)).max(5),
});
