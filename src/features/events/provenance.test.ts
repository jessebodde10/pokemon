import { describe, expect, it } from 'vitest';
import { events } from './data/mock-data';
import {
  VERIFICATION_STALE_DAYS,
  verificationState,
  type EventProvenance,
} from './types';

const NOW = new Date('2026-08-06T12:00:00.000Z');

function daysBefore(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

function provenance(overrides: Partial<EventProvenance> = {}): EventProvenance {
  return {
    kind: 'secondary',
    sourceName: 'Organisator',
    sourceUrl: 'https://example.com/beurs',
    lastVerifiedAt: daysBefore(3),
    ...overrides,
  };
}

describe('verificationState', () => {
  it('marks a recently checked listing as fresh', () => {
    expect(verificationState(provenance(), NOW)).toBe('fresh');
  });

  it('marks a listing as stale once the check is older than the window', () => {
    const old = provenance({
      lastVerifiedAt: daysBefore(VERIFICATION_STALE_DAYS + 1),
    });
    expect(verificationState(old, NOW)).toBe('stale');
  });

  it('keeps a listing fresh right up to the boundary', () => {
    const edge = provenance({
      lastVerifiedAt: daysBefore(VERIFICATION_STALE_DAYS),
    });
    expect(verificationState(edge, NOW)).toBe('fresh');
  });

  it('treats a listing nobody checked as unverified', () => {
    expect(verificationState(provenance({ lastVerifiedAt: null }), NOW)).toBe(
      'unverified',
    );
  });

  it('does not let an unparseable date pass as checked', () => {
    expect(
      verificationState(provenance({ lastVerifiedAt: 'binnenkort' }), NOW),
    ).toBe('unverified');
  });

  it('reports demo data as demo whatever else is filled in', () => {
    const seeded = provenance({ kind: 'demo', lastVerifiedAt: daysBefore(1) });
    expect(verificationState(seeded, NOW)).toBe('demo');
  });
});

/**
 * The catalogue now mixes invented entries with ones compiled by hand from an
 * organiser's announcement. The rules that keep the two apart are the whole
 * point of the provenance record, so they are asserted rather than trusted.
 */
describe('catalogue provenance', () => {
  const demo = events.filter((event) => event.provenance.kind === 'demo');
  const real = events.filter((event) => event.provenance.kind !== 'demo');

  it('ships both invented and compiled entries', () => {
    expect(demo.length).toBeGreaterThan(0);
    expect(real.length).toBeGreaterThan(0);
  });

  it('claims no source for invented entries', () => {
    for (const event of demo) {
      expect(event.provenance.sourceName).toBeNull();
      expect(event.provenance.sourceUrl).toBeNull();
      expect(event.provenance.lastVerifiedAt).toBeNull();
    }
  });

  it('gives every compiled entry a reachable source and a check date', () => {
    for (const event of real) {
      expect(event.provenance.sourceName).toBeTruthy();
      expect(event.provenance.sourceUrl).toMatch(/^https:\/\//);
      expect(event.provenance.lastVerifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('does not date a check in the future', () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const event of real) {
      expect(event.provenance.lastVerifiedAt! <= today).toBe(true);
    }
  });

  /**
   * An empty vendor list means "the announcement did not say", and the UI has
   * to be able to tell that apart from a fair with genuinely no vendors. The
   * guard here is that a compiled entry never invents one.
   */
  it('invents no vendors, reviews or visitor counts for compiled entries', () => {
    for (const event of real) {
      expect(event.vendorIds).toEqual([]);
      expect(event.expectedVisitors).toBeNull();
    }
  });
});
