/**
 * Deterministic pseudo-randomness.
 *
 * Mock providers must produce identical output for identical input so that
 * unit tests, e2e runs and manual demos all see the same cards and prices.
 */

/** FNV-1a, adequate for seeding and stable across runtimes. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 PRNG: small, fast, and reproducible. */
export function createSeededRandom(seed: string | number): () => number {
  let state = (typeof seed === 'string' ? hashString(seed) : seed) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededPick<T>(random: () => number, items: readonly T[]): T {
  if (items.length === 0) throw new Error('seededPick called with empty list');
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index] as T;
}

export function seededFloat(
  random: () => number,
  min: number,
  max: number,
): number {
  return min + random() * (max - min);
}
