import { describe, expect, it } from 'vitest';
import {
  AUTO_SELECT_THRESHOLD,
  parseCardNumber,
  rankCandidates,
  scoreCandidate,
  similarity,
  type MatchInput,
} from './matching';
import { DEMO_CATALOG_CARDS } from '@/providers/catalog/fixtures';
import type { CatalogCard } from '@/types/domain';

function card(overrides: Partial<CatalogCard> = {}): CatalogCard {
  return {
    id: 'test-card',
    externalId: 'test-card',
    name: 'Charizard ex',
    setId: 'set-1',
    setName: 'Scarlet & Violet 151 (demo)',
    setCode: 'MEW',
    cardNumber: '199/165',
    rarity: 'Special Illustration Rare',
    variant: 'special illustration rare',
    language: 'en',
    imageSmallUrl: null,
    imageLargeUrl: null,
    releaseDate: '2023-09-22',
    pokedexNumber: 6,
    metadata: {},
    ...overrides,
  };
}

const baseInput: MatchInput = {
  visibleName: 'Charizard ex',
  visibleCardNumber: '199/165',
  possibleSetCode: 'MEW',
  language: 'en',
  variantHints: ['special illustration rare'],
};

describe('parseCardNumber', () => {
  it('splits number and set total', () => {
    expect(parseCardNumber('199/165')).toEqual({ number: '199', total: '165' });
  });

  it('strips leading zeros', () => {
    expect(parseCardNumber('006/165')).toEqual({ number: '6', total: '165' });
  });

  it('accepts a bare number', () => {
    expect(parseCardNumber('25')).toEqual({ number: '25', total: null });
  });

  it('keeps alphanumeric promo numbers intact', () => {
    expect(parseCardNumber('TG12/TG30')).toEqual({
      number: 'TG12',
      total: 'TG30',
    });
  });

  it('returns null for empty input', () => {
    expect(parseCardNumber(null)).toBeNull();
    expect(parseCardNumber('   ')).toBeNull();
  });
});

describe('similarity', () => {
  it('is 1 for identical names ignoring punctuation and case', () => {
    expect(similarity('Charizard ex', 'CHARIZARD EX')).toBe(1);
  });

  it('scores a shared token highly', () => {
    expect(similarity('Charizard', 'Charizard ex')).toBeGreaterThan(0.4);
  });

  it('is low for unrelated names', () => {
    expect(similarity('Pikachu', 'Blastoise')).toBeLessThan(0.4);
  });
});

describe('scoreCandidate', () => {
  it('scores a perfect match at 1', () => {
    expect(scoreCandidate(baseInput, card()).score).toBe(1);
  });

  it('penalises a mismatched card number heavily', () => {
    const result = scoreCandidate(baseInput, card({ cardNumber: '006/165' }));
    expect(result.score).toBeLessThan(AUTO_SELECT_THRESHOLD);
  });

  it('skips factors that the input does not claim', () => {
    const sparse: MatchInput = {
      visibleName: 'Charizard ex',
      visibleCardNumber: null,
      possibleSetCode: null,
      language: null,
      variantHints: [],
    };
    const result = scoreCandidate(sparse, card());
    const factors = result.reasons.map((reason) => reason.factor);
    expect(factors).toContain('name');
    expect(factors).not.toContain('card_number');
    expect(factors).not.toContain('language');
    // A sparse but correct input should not be punished into uselessness.
    expect(result.score).toBeGreaterThan(AUTO_SELECT_THRESHOLD);
  });

  it('records a human-readable reason per factor', () => {
    const reasons = scoreCandidate(baseInput, card()).reasons;
    expect(reasons.length).toBeGreaterThan(0);
    for (const reason of reasons) {
      expect(reason.detail.length).toBeGreaterThan(3);
      expect(reason.weight).toBeGreaterThan(0);
    }
  });

  it('gives partial credit when only the set total differs', () => {
    const result = scoreCandidate(baseInput, card({ cardNumber: '199/197' }));
    const numberReason = result.reasons.find(
      (reason) => reason.factor === 'card_number',
    );
    expect(numberReason?.score).toBe(0.6);
  });
});

describe('rankCandidates', () => {
  it('puts the exact demo card first', () => {
    const ranked = rankCandidates(baseInput, DEMO_CATALOG_CARDS);
    expect(ranked[0]?.card.name).toBe('Charizard ex');
    expect(ranked[0]?.card.cardNumber).toBe('199/165');
    expect(ranked[0]?.score).toBeGreaterThanOrEqual(AUTO_SELECT_THRESHOLD);
  });

  it('returns at most the requested number of candidates', () => {
    expect(rankCandidates(baseInput, DEMO_CATALOG_CARDS, 5)).toHaveLength(5);
  });

  it('orders by descending score', () => {
    const ranked = rankCandidates(baseInput, DEMO_CATALOG_CARDS, 5);
    for (let i = 1; i < ranked.length; i += 1) {
      expect(ranked[i - 1]!.score).toBeGreaterThanOrEqual(ranked[i]!.score);
    }
  });

  it('distinguishes holo from reverse holo using variant hints', () => {
    const input: MatchInput = {
      visibleName: 'Pikachu',
      visibleCardNumber: '025/165',
      possibleSetCode: 'MEW',
      language: 'en',
      variantHints: ['reverse holo'],
    };
    const ranked = rankCandidates(input, DEMO_CATALOG_CARDS, 3);
    expect(ranked[0]?.card.variant).toBe('reverse holo');
  });

  it('is deterministic', () => {
    expect(rankCandidates(baseInput, DEMO_CATALOG_CARDS)).toEqual(
      rankCandidates(baseInput, DEMO_CATALOG_CARDS),
    );
  });
});
