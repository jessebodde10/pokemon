import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, countActiveFilters, filterEvents } from './filtering';
import { distanceKm } from './distance';
import { getEventsRepository } from './repository';
import { summariseReviews, consensusTags } from './reviews';
import type { EventReview } from './types';

const repository = getEventsRepository();

async function allEvents() {
  return repository.listEvents();
}

describe('distanceKm', () => {
  it('measures a known distance within a sensible margin', () => {
    // Amsterdam to Rotterdam is roughly 58km as the crow flies.
    const km = distanceKm(
      { latitude: 52.3676, longitude: 4.9041 },
      { latitude: 51.9244, longitude: 4.4777 },
    );
    expect(km).toBeGreaterThan(50);
    expect(km).toBeLessThan(66);
  });

  it('is zero for the same point', () => {
    const point = { latitude: 52, longitude: 5 };
    expect(distanceKm(point, point)).toBe(0);
  });
});

describe('filterEvents', () => {
  it('returns everything in date order without filters', async () => {
    const result = filterEvents(await allEvents(), EMPTY_FILTERS);
    expect(result.length).toBeGreaterThan(5);
    const dates = result.map((entry) => entry.event.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it('narrows on every word in the query rather than widening', async () => {
    const events = await allEvents();
    const single = filterEvents(events, { ...EMPTY_FILTERS, query: 'utrecht' });
    const both = filterEvents(events, {
      ...EMPTY_FILTERS,
      query: 'utrecht vintage',
    });
    expect(both.length).toBeLessThan(single.length);
    expect(both.every((entry) => entry.venue.city === 'Utrecht')).toBe(true);
  });

  it('ignores diacritics and case in the query', async () => {
    const events = await allEvents();
    const plain = filterEvents(events, { ...EMPTY_FILTERS, query: 'Belgie' });
    const accented = filterEvents(events, {
      ...EMPTY_FILTERS,
      query: 'BELGIË',
    });
    expect(plain.map((e) => e.event.id)).toEqual(
      accented.map((e) => e.event.id),
    );
  });

  it('filters by country', async () => {
    const result = filterEvents(await allEvents(), {
      ...EMPTY_FILTERS,
      country: 'BE',
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((entry) => entry.venue.country === 'BE')).toBe(true);
  });

  it('filters by event type', async () => {
    const result = filterEvents(await allEvents(), {
      ...EMPTY_FILTERS,
      type: 'one-piece',
    });
    expect(result.every((entry) => entry.event.type === 'one-piece')).toBe(
      true,
    );
  });

  it('requires every selected tag, not any of them', async () => {
    const events = await allEvents();
    const one = filterEvents(events, { ...EMPTY_FILTERS, tags: ['vintage'] });
    const two = filterEvents(events, {
      ...EMPTY_FILTERS,
      tags: ['vintage', 'japans'],
    });
    expect(two.length).toBeLessThanOrEqual(one.length);
    expect(
      two.every(
        (entry) =>
          entry.event.tags.includes('vintage') &&
          entry.event.tags.includes('japans'),
      ),
    ).toBe(true);
  });

  it('resolves a distance for every venue whose location is known', async () => {
    const result = filterEvents(await allEvents(), {
      ...EMPTY_FILTERS,
      originId: 'utrecht',
    });
    const located = result.filter((entry) => entry.venue.coordinates !== null);
    expect(located.length).toBeGreaterThan(0);
    expect(located.every((entry) => entry.distanceKm !== null)).toBe(true);
  });

  /**
   * Entries compiled from an organiser's announcement usually have no
   * coordinates. Inventing one would put a fair at a distance nobody measured,
   * so the distance stays null and the caller decides what to say about it.
   */
  it('leaves distance null for a venue with no known location', async () => {
    const result = filterEvents(await allEvents(), {
      ...EMPTY_FILTERS,
      originId: 'utrecht',
    });
    const unlocated = result.filter(
      (entry) => entry.venue.coordinates === null,
    );
    expect(unlocated.length).toBeGreaterThan(0);
    expect(unlocated.every((entry) => entry.distanceKm === null)).toBe(true);
  });

  it('leaves distance null without an origin', async () => {
    const result = filterEvents(await allEvents(), EMPTY_FILTERS);
    expect(result.every((entry) => entry.distanceKm === null)).toBe(true);
  });

  it('applies a distance limit relative to the origin', async () => {
    const result = filterEvents(await allEvents(), {
      ...EMPTY_FILTERS,
      originId: 'utrecht',
      maxDistanceKm: 50,
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((entry) => (entry.distanceKm ?? 0) <= 50)).toBe(true);
  });

  it('ignores a distance limit when no origin is set instead of emptying the list', async () => {
    const events = await allEvents();
    const result = filterEvents(events, {
      ...EMPTY_FILTERS,
      maxDistanceKm: 5,
    });
    expect(result.length).toBe(events.length);
  });

  it('keeps only events inside the three-month horizon', async () => {
    const events = await allEvents();
    const now = new Date();
    const result = filterEvents(events, {
      ...EMPTY_FILTERS,
      dateRange: 'next-3-months',
    });
    const horizon = new Date(now);
    horizon.setMonth(horizon.getMonth() + 3);
    expect(result.every((entry) => new Date(entry.event.date) <= horizon)).toBe(
      true,
    );
    expect(result.length).toBeLessThan(events.length);
  });
});

describe('countActiveFilters', () => {
  it('counts nothing for an untouched filter set', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
  });

  it('counts each tag separately', () => {
    expect(
      countActiveFilters({ ...EMPTY_FILTERS, tags: ['vintage', 'psa'] }),
    ).toBe(2);
  });

  it('does not count a distance limit that cannot be applied', () => {
    expect(countActiveFilters({ ...EMPTY_FILTERS, maxDistanceKm: 50 })).toBe(0);
    expect(
      countActiveFilters({
        ...EMPTY_FILTERS,
        maxDistanceKm: 50,
        originId: 'utrecht',
      }),
    ).toBe(1);
  });
});

function review(rating: number, tags: EventReview['tags']): EventReview {
  return {
    id: `r-${Math.random()}`,
    eventId: 'e',
    authorName: 'Test',
    rating,
    body: '',
    tags,
    createdAt: new Date().toISOString(),
  };
}

describe('summariseReviews', () => {
  it('reports null rather than zero when nobody reviewed', () => {
    const summary = summariseReviews([]);
    expect(summary.averageRating).toBeNull();
    expect(summary.count).toBe(0);
  });

  it('orders tags by how often they were picked', () => {
    const summary = summariseReviews([
      review(5, ['druk', 'goede-sfeer']),
      review(4, ['druk']),
      review(3, ['druk', 'goede-sfeer']),
      review(4, ['veel-slabs']),
    ]);
    expect(summary.tagCounts[0]?.tag).toBe('druk');
    expect(summary.tagCounts[0]?.count).toBe(3);
    expect(summary.averageRating).toBe(4);
  });
});

describe('consensusTags', () => {
  it('stays silent below three reviews, however unanimous', () => {
    const summary = summariseReviews([
      review(5, ['druk']),
      review(5, ['druk']),
    ]);
    expect(consensusTags(summary)).toEqual([]);
  });

  it('reports only tags a third of reviewers agreed on', () => {
    const summary = summariseReviews([
      review(5, ['druk', 'goede-sfeer']),
      review(4, ['druk']),
      review(3, ['druk']),
      review(4, ['veel-slabs']),
      review(4, []),
      review(4, []),
    ]);
    const agreed = consensusTags(summary);
    expect(agreed).toContain('druk');
    expect(agreed).not.toContain('veel-slabs');
  });
});
