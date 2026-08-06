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
    expect(
      verificationState(provenance({ lastVerifiedAt: null }), NOW),
    ).toBe('unverified');
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
 * The seeded catalogue is invented. If an entry ever loses its marker it would
 * silently pass as a real event, which is the one outcome this whole mechanism
 * exists to prevent.
 */
describe('seeded catalogue', () => {
  it('marks every shipped event as demo data', () => {
    const notDemo = events.filter(
      (event) => event.provenance.kind !== 'demo',
    );
    expect(notDemo.map((event) => event.slug)).toEqual([]);
  });

  it('claims no source for invented entries', () => {
    for (const event of events) {
      expect(event.provenance.sourceName).toBeNull();
      expect(event.provenance.sourceUrl).toBeNull();
      expect(event.provenance.lastVerifiedAt).toBeNull();
    }
  });
});
