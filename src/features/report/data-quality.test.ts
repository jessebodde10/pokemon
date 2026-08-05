import { describe, expect, it } from 'vitest';
import { computeDataQuality, type QualityInput } from './data-quality';

function cardEntry(
  overrides: Partial<QualityInput['cards'][number]> = {},
): QualityInput['cards'][number] {
  return {
    recognitionConfidence: 0.9,
    userConfirmed: true,
    isUnknown: false,
    priceSampleSize: 25,
    priceAgeDays: 5,
    relativePriceSpread: 0.1,
    imageQualityScore: 0.9,
    variantKnown: true,
    languageKnown: true,
    ...overrides,
  };
}

describe('computeDataQuality', () => {
  it('returns a zero score and an explanation for an empty analysis', () => {
    const result = computeDataQuality({ cards: [] });
    expect(result.score).toBe(0);
    expect(result.band).toBe('low');
    expect(result.factors).toHaveLength(0);
    expect(result.explanation).toContain('nog geen kaarten');
  });

  it('scores a fully confirmed, well-priced analysis as high', () => {
    const result = computeDataQuality({
      cards: [cardEntry(), cardEntry(), cardEntry()],
    });
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.band).toBe('high');
  });

  it('scores an unreviewed, data-poor analysis as low', () => {
    const result = computeDataQuality({
      cards: [
        cardEntry({
          recognitionConfidence: 0.3,
          userConfirmed: false,
          priceSampleSize: null,
          priceAgeDays: null,
          relativePriceSpread: null,
          imageQualityScore: 0.2,
          variantKnown: false,
          languageKnown: false,
        }),
      ],
    });
    expect(result.score).toBeLessThan(45);
    expect(result.band).toBe('low');
  });

  it('always stays within 0..100', () => {
    const best = computeDataQuality({
      cards: [
        cardEntry({
          recognitionConfidence: 1,
          priceSampleSize: 10_000,
          priceAgeDays: 0,
          relativePriceSpread: 0,
          imageQualityScore: 1,
        }),
      ],
    });
    expect(best.score).toBeGreaterThanOrEqual(0);
    expect(best.score).toBeLessThanOrEqual(100);
  });

  it('weights sum to one so the score is a true weighted average', () => {
    const result = computeDataQuality({ cards: [cardEntry()] });
    const total = result.factors.reduce(
      (sum, factor) => sum + factor.weight,
      0,
    );
    expect(total).toBeCloseTo(1, 5);
  });

  it('mentions unconfirmed variants in the explanation', () => {
    const result = computeDataQuality({
      cards: [
        cardEntry(),
        cardEntry({ variantKnown: false }),
        cardEntry({ variantKnown: false }),
      ],
    });
    expect(result.explanation).toContain('2 kaart(en) is de exacte variant');
  });

  it('reports unknown cards separately from recognised ones', () => {
    const result = computeDataQuality({
      cards: [
        cardEntry(),
        cardEntry({ isUnknown: true, userConfirmed: false }),
      ],
    });
    expect(result.explanation).toContain('onbekend');
  });

  it('is deterministic', () => {
    const input: QualityInput = { cards: [cardEntry(), cardEntry()] };
    expect(computeDataQuality(input)).toEqual(computeDataQuality(input));
  });

  it('drops the manual-confirmation factor when nothing is confirmed', () => {
    const result = computeDataQuality({
      cards: [cardEntry({ userConfirmed: false })],
    });
    const confirmation = result.factors.find(
      (factor) => factor.key === 'manual_confirmation',
    );
    expect(confirmation?.score).toBe(0);
  });
});
