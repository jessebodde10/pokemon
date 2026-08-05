import type { CatalogCard } from '@/types/domain';

/**
 * Deterministic demo catalog.
 *
 * These records exist so the whole product can be exercised without any API
 * key. They are illustrative reference data, not an official card database:
 * every screen that renders them also renders a "demodata" marker when the
 * mock catalog provider is active.
 */

type SetSeed = {
  setId: string;
  setName: string;
  setCode: string;
  releaseDate: string;
};

const SETS: Record<string, SetSeed> = {
  mew: {
    setId: 'demo-sv3pt5',
    setName: 'Scarlet & Violet 151 (demo)',
    setCode: 'MEW',
    releaseDate: '2023-09-22',
  },
  obf: {
    setId: 'demo-sv3',
    setName: 'Obsidian Flames (demo)',
    setCode: 'OBF',
    releaseDate: '2023-08-11',
  },
  evs: {
    setId: 'demo-swsh7',
    setName: 'Evolving Skies (demo)',
    setCode: 'EVS',
    releaseDate: '2021-08-27',
  },
  base: {
    setId: 'demo-base1',
    setName: 'Base Set (demo)',
    setCode: 'BS',
    releaseDate: '1999-01-09',
  },
};

type CardSeed = {
  key: string;
  set: keyof typeof SETS;
  name: string;
  cardNumber: string;
  rarity: string;
  variant: string;
  pokedexNumber: number | null;
  /** Drives the deterministic mock price; not a real market value. */
  priceAnchorEur: number;
  sampleSize: number;
};

const CARD_SEEDS: CardSeed[] = [
  {
    key: 'mew-199-charizard-ex-sir',
    set: 'mew',
    name: 'Charizard ex',
    cardNumber: '199/165',
    rarity: 'Special Illustration Rare',
    variant: 'special illustration rare',
    pokedexNumber: 6,
    priceAnchorEur: 289,
    sampleSize: 42,
  },
  {
    key: 'mew-006-charizard-ex',
    set: 'mew',
    name: 'Charizard ex',
    cardNumber: '006/165',
    rarity: 'Double Rare',
    variant: 'holo',
    pokedexNumber: 6,
    priceAnchorEur: 18.5,
    sampleSize: 96,
  },
  {
    key: 'mew-205-mew-ex-sir',
    set: 'mew',
    name: 'Mew ex',
    cardNumber: '205/165',
    rarity: 'Special Illustration Rare',
    variant: 'special illustration rare',
    pokedexNumber: 151,
    priceAnchorEur: 132,
    sampleSize: 31,
  },
  {
    key: 'mew-151-mew-ex',
    set: 'mew',
    name: 'Mew ex',
    cardNumber: '151/165',
    rarity: 'Double Rare',
    variant: 'holo',
    pokedexNumber: 151,
    priceAnchorEur: 14.25,
    sampleSize: 74,
  },
  {
    key: 'mew-025-pikachu',
    set: 'mew',
    name: 'Pikachu',
    cardNumber: '025/165',
    rarity: 'Common',
    variant: 'normal',
    pokedexNumber: 25,
    priceAnchorEur: 0.8,
    sampleSize: 120,
  },
  {
    key: 'mew-025-pikachu-rev',
    set: 'mew',
    name: 'Pikachu',
    cardNumber: '025/165',
    rarity: 'Common',
    variant: 'reverse holo',
    pokedexNumber: 25,
    priceAnchorEur: 2.4,
    sampleSize: 58,
  },
  {
    key: 'mew-001-bulbasaur',
    set: 'mew',
    name: 'Bulbasaur',
    cardNumber: '001/165',
    rarity: 'Common',
    variant: 'normal',
    pokedexNumber: 1,
    priceAnchorEur: 0.6,
    sampleSize: 110,
  },
  {
    key: 'mew-001-bulbasaur-rev',
    set: 'mew',
    name: 'Bulbasaur',
    cardNumber: '001/165',
    rarity: 'Common',
    variant: 'reverse holo',
    pokedexNumber: 1,
    priceAnchorEur: 1.9,
    sampleSize: 47,
  },
  {
    key: 'mew-150-mewtwo',
    set: 'mew',
    name: 'Mewtwo',
    cardNumber: '150/165',
    rarity: 'Rare',
    variant: 'holo',
    pokedexNumber: 150,
    priceAnchorEur: 3.1,
    sampleSize: 64,
  },
  {
    key: 'mew-164-gengar-ex',
    set: 'mew',
    name: 'Gengar ex',
    cardNumber: '164/165',
    rarity: 'Ultra Rare',
    variant: 'full art',
    pokedexNumber: 94,
    priceAnchorEur: 41,
    sampleSize: 38,
  },
  {
    key: 'mew-143-snorlax',
    set: 'mew',
    name: 'Snorlax',
    cardNumber: '143/165',
    rarity: 'Rare',
    variant: 'holo',
    pokedexNumber: 143,
    priceAnchorEur: 2.2,
    sampleSize: 51,
  },
  {
    key: 'mew-133-eevee',
    set: 'mew',
    name: 'Eevee',
    cardNumber: '133/165',
    rarity: 'Common',
    variant: 'normal',
    pokedexNumber: 133,
    priceAnchorEur: 0.7,
    sampleSize: 88,
  },
  {
    key: 'evs-215-umbreon-vmax',
    set: 'evs',
    name: 'Umbreon VMAX',
    cardNumber: '215/203',
    rarity: 'Alternate Art Secret Rare',
    variant: 'alternate art',
    pokedexNumber: 197,
    priceAnchorEur: 612,
    sampleSize: 9,
  },
  {
    key: 'evs-189-umbreon-v',
    set: 'evs',
    name: 'Umbreon V',
    cardNumber: '189/203',
    rarity: 'Alternate Art Ultra Rare',
    variant: 'alternate art',
    pokedexNumber: 197,
    priceAnchorEur: 178,
    sampleSize: 16,
  },
  {
    key: 'evs-095-umbreon-v',
    set: 'evs',
    name: 'Umbreon V',
    cardNumber: '095/203',
    rarity: 'Ultra Rare',
    variant: 'holo',
    pokedexNumber: 197,
    priceAnchorEur: 12.4,
    sampleSize: 44,
  },
  {
    key: 'evs-218-rayquaza-vmax',
    set: 'evs',
    name: 'Rayquaza VMAX',
    cardNumber: '218/203',
    rarity: 'Alternate Art Secret Rare',
    variant: 'alternate art',
    pokedexNumber: 384,
    priceAnchorEur: 148,
    sampleSize: 21,
  },
  {
    key: 'obf-054-charizard-ex',
    set: 'obf',
    name: 'Charizard ex',
    cardNumber: '054/197',
    rarity: 'Double Rare',
    variant: 'holo',
    pokedexNumber: 6,
    priceAnchorEur: 9.6,
    sampleSize: 82,
  },
  {
    key: 'obf-164-pidgeot-ex',
    set: 'obf',
    name: 'Pidgeot ex',
    cardNumber: '164/197',
    rarity: 'Ultra Rare',
    variant: 'full art',
    pokedexNumber: 18,
    priceAnchorEur: 27.5,
    sampleSize: 33,
  },
  {
    key: 'base-004-charizard',
    set: 'base',
    name: 'Charizard',
    cardNumber: '004/102',
    rarity: 'Rare Holo',
    variant: 'holo',
    pokedexNumber: 6,
    priceAnchorEur: 340,
    sampleSize: 4,
  },
  {
    key: 'base-002-blastoise',
    set: 'base',
    name: 'Blastoise',
    cardNumber: '002/102',
    rarity: 'Rare Holo',
    variant: 'holo',
    pokedexNumber: 9,
    priceAnchorEur: 118,
    sampleSize: 7,
  },
  {
    key: 'base-015-venusaur',
    set: 'base',
    name: 'Venusaur',
    cardNumber: '015/102',
    rarity: 'Rare Holo',
    variant: 'holo',
    pokedexNumber: 3,
    priceAnchorEur: 96,
    sampleSize: 6,
  },
  {
    key: 'base-058-pikachu',
    set: 'base',
    name: 'Pikachu',
    cardNumber: '058/102',
    rarity: 'Common',
    variant: 'normal',
    pokedexNumber: 25,
    priceAnchorEur: 6.4,
    sampleSize: 29,
  },
  {
    key: 'base-053-charmander',
    set: 'base',
    name: 'Charmander',
    cardNumber: '046/102',
    rarity: 'Common',
    variant: 'normal',
    pokedexNumber: 4,
    priceAnchorEur: 4.1,
    sampleSize: 35,
  },
  {
    key: 'mew-065-alakazam-ex',
    set: 'mew',
    name: 'Alakazam ex',
    cardNumber: '065/165',
    rarity: 'Double Rare',
    variant: 'holo',
    pokedexNumber: 65,
    priceAnchorEur: 5.3,
    sampleSize: 57,
  },
  {
    key: 'mew-145-zapdos',
    set: 'mew',
    name: 'Zapdos',
    cardNumber: '145/165',
    rarity: 'Rare',
    variant: 'holo',
    pokedexNumber: 145,
    priceAnchorEur: 2.9,
    sampleSize: 49,
  },
  {
    key: 'mew-034-nidoking',
    set: 'mew',
    name: 'Nidoking',
    cardNumber: '034/165',
    rarity: 'Rare',
    variant: 'holo',
    pokedexNumber: 34,
    priceAnchorEur: 1.8,
    sampleSize: 41,
  },
];

/** Card whose seeded market data is intentionally too thin to price. */
export const NO_PRICE_DATA_CARD_KEY = 'evs-215-umbreon-vmax';

function toCatalogCard(seed: CardSeed): CatalogCard {
  const set = SETS[seed.set];
  if (!set) throw new Error(`Unknown demo set: ${seed.set}`);
  return {
    id: seed.key,
    externalId: seed.key,
    name: seed.name,
    setId: set.setId,
    setName: set.setName,
    setCode: set.setCode,
    cardNumber: seed.cardNumber,
    rarity: seed.rarity,
    variant: seed.variant,
    language: 'en',
    imageSmallUrl: `/api/demo-card-art/${seed.key}?size=small`,
    imageLargeUrl: `/api/demo-card-art/${seed.key}?size=large`,
    releaseDate: set.releaseDate,
    pokedexNumber: seed.pokedexNumber,
    metadata: {
      demo: true,
      priceAnchorEur: seed.priceAnchorEur,
      sampleSize: seed.sampleSize,
    },
  };
}

export const DEMO_CATALOG_CARDS: CatalogCard[] = CARD_SEEDS.map(toCatalogCard);

export const DEMO_CATALOG_BY_ID = new Map(
  DEMO_CATALOG_CARDS.map((card) => [card.id, card]),
);

export function demoPriceAnchor(card: CatalogCard): {
  anchorEur: number;
  sampleSize: number;
} | null {
  const anchor = card.metadata.priceAnchorEur;
  const sample = card.metadata.sampleSize;
  if (typeof anchor !== 'number' || typeof sample !== 'number') return null;
  return { anchorEur: anchor, sampleSize: sample };
}
