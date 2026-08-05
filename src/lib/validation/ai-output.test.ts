import { describe, expect, it } from 'vitest';
import {
  extractJsonObject,
  parseVisionResponse,
  reportNarrativeSchema,
  visionResponseSchema,
} from './ai-output';

const VALID = {
  cards: [
    {
      region: { x: 0.12, y: 0.18, width: 0.24, height: 0.35 },
      visibleName: 'Charizard ex',
      visibleCardNumber: '199/165',
      possibleSetCode: null,
      language: 'en',
      variantHints: ['special illustration rare'],
      recognitionConfidence: 0.82,
      imageQualityWarnings: ['glare'],
    },
  ],
};

describe('extractJsonObject', () => {
  it('returns plain JSON unchanged', () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
  });

  it('unwraps a markdown fence', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('extracts an object surrounded by prose', () => {
    expect(extractJsonObject('Sure! {"a":1} Hope that helps.')).toBe('{"a":1}');
  });

  it('handles braces inside strings', () => {
    expect(extractJsonObject('{"a":"} not the end"}')).toBe(
      '{"a":"} not the end"}',
    );
  });

  it('handles escaped quotes inside strings', () => {
    expect(extractJsonObject('{"a":"say \\"hi\\""}')).toBe(
      '{"a":"say \\"hi\\""}',
    );
  });

  it('returns null when there is no object', () => {
    expect(extractJsonObject('no json here')).toBeNull();
  });
});

describe('visionResponseSchema', () => {
  it('accepts a well-formed response', () => {
    expect(visionResponseSchema.safeParse(VALID).success).toBe(true);
  });

  it('rejects coordinates outside 0..1', () => {
    const result = visionResponseSchema.safeParse({
      cards: [
        {
          ...VALID.cards[0],
          region: { x: 1.4, y: 0, width: 0.2, height: 0.2 },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a region that runs off the right edge', () => {
    const result = visionResponseSchema.safeParse({
      cards: [
        {
          ...VALID.cards[0],
          region: { x: 0.9, y: 0, width: 0.5, height: 0.2 },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a zero-width region', () => {
    const result = visionResponseSchema.safeParse({
      cards: [
        {
          ...VALID.cards[0],
          region: { x: 0.1, y: 0.1, width: 0, height: 0.2 },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a confidence above 1', () => {
    const result = visionResponseSchema.safeParse({
      cards: [{ ...VALID.cards[0], recognitionConfidence: 1.5 }],
    });
    expect(result.success).toBe(false);
  });

  it('falls back to "unknown" for an unsupported language', () => {
    const result = visionResponseSchema.parse({
      cards: [{ ...VALID.cards[0], language: 'klingon' }],
    });
    expect(result.cards[0]?.language).toBe('unknown');
  });
});

describe('parseVisionResponse', () => {
  it('parses a clean model response', () => {
    const result = parseVisionResponse(JSON.stringify(VALID));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.cards).toHaveLength(1);
      expect(result.data.cards[0]?.visibleName).toBe('Charizard ex');
    }
  });

  it('parses a fenced, chatty response', () => {
    const raw = `Here you go:\n\`\`\`json\n${JSON.stringify(VALID)}\n\`\`\``;
    expect(parseVisionResponse(raw).ok).toBe(true);
  });

  it('reports not_json for prose without an object', () => {
    const result = parseVisionResponse('I could not read this photo.');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_json');
  });

  it('reports not_json for malformed syntax', () => {
    const result = parseVisionResponse('{"cards": [');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_json');
  });

  it('reports schema_mismatch with readable issues for bad values', () => {
    const result = parseVisionResponse(
      JSON.stringify({
        cards: [{ ...VALID.cards[0], recognitionConfidence: 9 }],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('schema_mismatch');
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it('never throws, whatever it is given', () => {
    for (const input of ['', '   ', 'null', '[]', '{}', '{"cards":null}']) {
      expect(() => parseVisionResponse(input)).not.toThrow();
    }
  });

  it('accepts an empty card list', () => {
    const result = parseVisionResponse('{"cards":[]}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.cards).toHaveLength(0);
  });
});

describe('reportNarrativeSchema', () => {
  it('accepts a well-formed narrative', () => {
    const result = reportNarrativeSchema.safeParse({
      headline: 'Indicatieve waarde tussen €420 en €560',
      summary: 'Van de 9 gevonden kaarten heb je er 7 bevestigd.',
      highlights: ['Hoogst geschatte kaart: Charizard ex'],
      cautions: ['Twee kaarten wachten nog op controle'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an over-long list of highlights', () => {
    const result = reportNarrativeSchema.safeParse({
      headline: 'Kop',
      summary: 'Een samenvatting van voldoende lengte.',
      highlights: Array.from({ length: 9 }, () => 'punt'),
      cautions: [],
    });
    expect(result.success).toBe(false);
  });
});
