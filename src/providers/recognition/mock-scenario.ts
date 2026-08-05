import type { CardRegion } from '@/types/domain';
import type { CardRecognitionResult } from '@/providers/types';

/**
 * Scripted demo recognition results.
 *
 * The deck deliberately covers every branch the review and report UI has to
 * handle: a confident high-value card, a card whose variant is ambiguous, a
 * card the model could not read at all, and a card the pricing provider will
 * refuse to price.
 */

export type ScenarioEntry = CardRecognitionResult & { region: CardRegion };

/** 3x3 binder layout in normalised coordinates. */
export function binderSlot(index: number): CardRegion {
  const column = index % 3;
  const row = Math.floor(index / 3) % 3;
  const width = 0.26;
  const height = 0.28;
  const gapX = (1 - 3 * width) / 4;
  const gapY = (1 - 3 * height) / 4;
  return {
    x: Number((gapX + column * (width + gapX)).toFixed(4)),
    y: Number((gapY + row * (height + gapY)).toFixed(4)),
    width,
    height,
  };
}

export const MOCK_SCENARIO_DECK: ScenarioEntry[] = [
  {
    region: binderSlot(0),
    visibleName: 'Charizard ex',
    visibleCardNumber: '199/165',
    possibleSetCode: 'MEW',
    language: 'en',
    variantHints: ['special illustration rare'],
    recognitionConfidence: 0.91,
    imageQualityWarnings: [],
  },
  {
    region: binderSlot(1),
    visibleName: 'Pikachu',
    visibleCardNumber: '025/165',
    possibleSetCode: 'MEW',
    language: 'en',
    variantHints: ['reverse holo'],
    recognitionConfidence: 0.84,
    imageQualityWarnings: [],
  },
  {
    region: binderSlot(2),
    visibleName: 'Mew ex',
    visibleCardNumber: '205/165',
    possibleSetCode: 'MEW',
    language: 'en',
    variantHints: ['special illustration rare'],
    recognitionConfidence: 0.88,
    imageQualityWarnings: ['glare'],
  },
  {
    // Umbreon VMAX: recognised well, but the mock pricing source has too few
    // observations to produce a band.
    region: binderSlot(3),
    visibleName: 'Umbreon VMAX',
    visibleCardNumber: '215/203',
    possibleSetCode: 'EVS',
    language: 'en',
    variantHints: ['alternate art'],
    recognitionConfidence: 0.86,
    imageQualityWarnings: [],
  },
  {
    region: binderSlot(4),
    visibleName: 'Bulbasaur',
    visibleCardNumber: '001/165',
    possibleSetCode: 'MEW',
    language: 'en',
    variantHints: [],
    recognitionConfidence: 0.79,
    imageQualityWarnings: [],
  },
  {
    // Ambiguous variant: name and number read fine, holo vs reverse unclear.
    region: binderSlot(5),
    visibleName: 'Charizard ex',
    visibleCardNumber: '006/165',
    possibleSetCode: null,
    language: 'en',
    variantHints: [],
    recognitionConfidence: 0.52,
    imageQualityWarnings: ['blurry', 'angle'],
  },
  {
    // Nothing legible: becomes an "unknown card" in review.
    region: binderSlot(6),
    visibleName: null,
    visibleCardNumber: null,
    possibleSetCode: null,
    language: 'unknown',
    variantHints: [],
    recognitionConfidence: 0.21,
    imageQualityWarnings: ['glare', 'partially covered'],
  },
  {
    region: binderSlot(7),
    visibleName: 'Mewtwo',
    visibleCardNumber: '150/165',
    possibleSetCode: 'MEW',
    language: 'en',
    variantHints: ['holo'],
    recognitionConfidence: 0.81,
    imageQualityWarnings: [],
  },
  {
    region: binderSlot(8),
    visibleName: 'Gengar ex',
    visibleCardNumber: '164/165',
    possibleSetCode: 'MEW',
    language: 'en',
    variantHints: ['full art'],
    recognitionConfidence: 0.77,
    imageQualityWarnings: [],
  },
  {
    region: binderSlot(0),
    visibleName: 'Charizard',
    visibleCardNumber: '004/102',
    possibleSetCode: 'BS',
    language: 'en',
    variantHints: ['holo'],
    recognitionConfidence: 0.73,
    imageQualityWarnings: ['glare'],
  },
  {
    region: binderSlot(1),
    visibleName: 'Blastoise',
    visibleCardNumber: '002/102',
    possibleSetCode: 'BS',
    language: 'en',
    variantHints: ['holo'],
    recognitionConfidence: 0.7,
    imageQualityWarnings: [],
  },
  {
    region: binderSlot(2),
    visibleName: 'Snorlax',
    visibleCardNumber: '143/165',
    possibleSetCode: 'MEW',
    language: 'en',
    variantHints: ['holo'],
    recognitionConfidence: 0.68,
    imageQualityWarnings: [],
  },
];

/**
 * Deterministically slice the deck for a given image so multi-image analyses
 * keep producing new - but stable - cards.
 */
export function scenarioForImage(
  imageIndex: number,
  cardsPerImage: number,
): ScenarioEntry[] {
  const entries: ScenarioEntry[] = [];
  for (let i = 0; i < cardsPerImage; i += 1) {
    const deckIndex =
      (imageIndex * cardsPerImage + i) % MOCK_SCENARIO_DECK.length;
    const entry = MOCK_SCENARIO_DECK[deckIndex];
    if (!entry) continue;
    entries.push({ ...entry, region: binderSlot(i) });
  }
  return entries;
}
