import { distanceKm, findOrigin } from './distance';
import type { Country, EventListItem, EventTag, EventType } from './types';

/**
 * Search and filtering for the events overview.
 *
 * Pure and synchronous, so it runs identically on the server for the first
 * render and in the browser as the visitor changes a filter. Every filter is
 * optional; an empty filter set returns everything in date order.
 */

export type DateRange = 'any' | 'this-month' | 'next-3-months' | 'weekend';

export const DATE_RANGE_LABELS: Record<DateRange, string> = {
  any: 'Alle datums',
  weekend: 'Komend weekend',
  'this-month': 'Deze maand',
  'next-3-months': 'Komende 3 maanden',
};

export const DISTANCE_OPTIONS = [25, 50, 100, 200] as const;

export type EventFilters = {
  query: string;
  country: Country | 'all';
  province: string | 'all';
  type: EventType | 'all';
  tags: EventTag[];
  dateRange: DateRange;
  /** Origin city id from ORIGIN_CITIES; distance is ignored without it. */
  originId: string | null;
  maxDistanceKm: number | null;
};

export const EMPTY_FILTERS: EventFilters = {
  query: '',
  country: 'all',
  province: 'all',
  type: 'all',
  tags: [],
  dateRange: 'any',
  originId: null,
  maxDistanceKm: null,
};

/** An event with the distance resolved for the visitor's chosen origin. */
export type RankedEvent = EventListItem & { distanceKm: number | null };

function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Free-text match across the fields a visitor would actually type: the event
 * name, the city, the venue and the organiser's own summary.
 */
function matchesQuery(item: EventListItem, query: string): boolean {
  if (query.length === 0) return true;
  const haystack = normalise(
    [
      item.event.name,
      item.event.summary,
      item.venue.city,
      item.venue.name,
      item.venue.province,
    ].join(' '),
  );
  // Every word must appear somewhere, so "utrecht vintage" narrows rather
  // than widens the result set.
  return normalise(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function endOfMonth(from: Date): Date {
  return new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59);
}

/** Upcoming Saturday and Sunday, treating today as part of this weekend. */
function comingWeekend(from: Date): { start: Date; end: Date } {
  const start = new Date(from);
  const daysUntilSaturday = (6 - start.getDay() + 7) % 7;
  start.setDate(start.getDate() + daysUntilSaturday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function matchesDateRange(
  isoDate: string,
  range: DateRange,
  now: Date,
): boolean {
  if (range === 'any') return true;
  const date = new Date(`${isoDate}T12:00:00`);

  if (range === 'weekend') {
    const { start, end } = comingWeekend(now);
    return date >= start && date <= end;
  }
  if (range === 'this-month') {
    return date >= now && date <= endOfMonth(now);
  }
  const horizon = new Date(now);
  horizon.setMonth(horizon.getMonth() + 3);
  return date >= now && date <= horizon;
}

export function filterEvents(
  items: readonly EventListItem[],
  filters: EventFilters,
  now: Date = new Date(),
): RankedEvent[] {
  const origin = findOrigin(filters.originId);

  return items
    .map(
      (item): RankedEvent => ({
        ...item,
        distanceKm: origin ? distanceKm(origin, item.venue.coordinates) : null,
      }),
    )
    .filter((item) => {
      if (!matchesQuery(item, filters.query)) return false;
      if (filters.country !== 'all' && item.venue.country !== filters.country) {
        return false;
      }
      if (
        filters.province !== 'all' &&
        item.venue.province !== filters.province
      ) {
        return false;
      }
      if (filters.type !== 'all' && item.event.type !== filters.type) {
        return false;
      }
      if (
        filters.tags.length > 0 &&
        !filters.tags.every((tag) => item.event.tags.includes(tag))
      ) {
        return false;
      }
      if (!matchesDateRange(item.event.date, filters.dateRange, now)) {
        return false;
      }
      // A distance limit without an origin is meaningless, so it is ignored
      // rather than silently emptying the list.
      if (
        filters.maxDistanceKm !== null &&
        item.distanceKm !== null &&
        item.distanceKm > filters.maxDistanceKm
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.event.date.localeCompare(b.event.date));
}

export function countActiveFilters(filters: EventFilters): number {
  let count = 0;
  if (filters.query.trim().length > 0) count += 1;
  if (filters.country !== 'all') count += 1;
  if (filters.province !== 'all') count += 1;
  if (filters.type !== 'all') count += 1;
  if (filters.dateRange !== 'any') count += 1;
  if (filters.maxDistanceKm !== null && filters.originId) count += 1;
  count += filters.tags.length;
  return count;
}
