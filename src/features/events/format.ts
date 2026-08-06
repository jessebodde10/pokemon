import type { EventRecord, Venue } from './types';

/**
 * Presentation helpers shared by every events surface.
 *
 * Money is formatted in one place so a price never renders as "0" when it is
 * actually absent - the same rule the analysis side of the app follows.
 */

const dateFormatter = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
});

const dateFormatterWithYear = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatEventDate(event: EventRecord): string {
  const start = new Date(`${event.date}T12:00:00`);
  if (!event.endDate) return dateFormatter.format(start);
  const end = new Date(`${event.endDate}T12:00:00`);
  return `${dateFormatter.format(start)} – ${dateFormatter.format(end)}`;
}

export function formatLongDate(iso: string): string {
  return dateFormatterWithYear.format(new Date(`${iso}T12:00:00`));
}

export function formatRelativeDate(
  iso: string,
  now: Date = new Date(),
): string {
  const target = new Date(`${iso}T12:00:00`);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.round(
    (target.getTime() - startOfToday.getTime()) / 86_400_000,
  );
  if (days < 0) return 'Afgelopen';
  if (days === 0) return 'Vandaag';
  if (days === 1) return 'Morgen';
  if (days < 7) return `Over ${days} dagen`;
  if (days < 14) return 'Volgende week';
  if (days < 60) return `Over ${Math.round(days / 7)} weken`;
  return `Over ${Math.round(days / 30)} maanden`;
}

/**
 * Prices. `null` means there is no price, which is not the same as free and
 * definitely not the same as zero, so it never renders as an amount.
 */
export function formatPrice(value: number | null): string {
  if (value === null) return 'Prijs onbekend';
  if (value === 0) return 'Gratis';
  return `€${value.toFixed(2).replace('.', ',')}`;
}

export function formatFromPrice(value: number | null, isFree: boolean): string {
  if (isFree) return 'Gratis';
  if (value === null) return 'Prijs onbekend';
  return `vanaf ${formatPrice(value)}`;
}

export function formatDistance(km: number | null): string | null {
  if (km === null) return null;
  return `${km} km`;
}

export function venueLine(venue: Venue): string {
  return `${venue.city} · ${venue.province}`;
}

export function mapsUrl(venue: Venue): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.mapsQuery)}`;
}
