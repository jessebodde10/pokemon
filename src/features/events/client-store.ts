import type { FavoriteKind } from './types';

/**
 * Browser-local state for favourites, follows and reviews.
 *
 * Everything here is per-device and disappears when someone clears their
 * browser. That is the honest limit of a platform without accounts behind it,
 * and the UI says so rather than implying the data is stored for them.
 *
 * The shape mirrors the `favorites` and `notifications` tables, so moving this
 * to the server later is a transport change, not a redesign.
 */

const FAVORITES_KEY = 'pokora.events.favorites';
const FOLLOWS_KEY = 'pokora.events.follows';
const REVIEWS_KEY = 'pokora.events.reviews';

type StoredKey = `${FavoriteKind}:${string}`;

function readSet(key: string): Set<StoredKey> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((entry): entry is StoredKey => typeof entry === 'string'));
  } catch {
    // Corrupt or unavailable storage must never break the page.
    return new Set();
  }
}

function writeSet(key: string, value: Set<StoredKey>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify([...value]));
  } catch {
    // Private browsing can refuse writes. The toggle still works for this
    // page view; only persistence is lost.
  }
}

function toggle(storageKey: string, entry: StoredKey): boolean {
  const set = readSet(storageKey);
  const next = !set.has(entry);
  if (next) set.add(entry);
  else set.delete(entry);
  writeSet(storageKey, set);
  return next;
}

export function isFavorite(kind: FavoriteKind, targetId: string): boolean {
  return readSet(FAVORITES_KEY).has(`${kind}:${targetId}`);
}

export function toggleFavorite(kind: FavoriteKind, targetId: string): boolean {
  return toggle(FAVORITES_KEY, `${kind}:${targetId}`);
}

export function listFavorites(kind: FavoriteKind): string[] {
  return [...readSet(FAVORITES_KEY)]
    .filter((entry) => entry.startsWith(`${kind}:`))
    .map((entry) => entry.slice(kind.length + 1));
}

export function isFollowed(kind: FavoriteKind, targetId: string): boolean {
  return readSet(FOLLOWS_KEY).has(`${kind}:${targetId}`);
}

export function toggleFollow(kind: FavoriteKind, targetId: string): boolean {
  return toggle(FOLLOWS_KEY, `${kind}:${targetId}`);
}

export function listFollows(kind: FavoriteKind): string[] {
  return [...readSet(FOLLOWS_KEY)]
    .filter((entry) => entry.startsWith(`${kind}:`))
    .map((entry) => entry.slice(kind.length + 1));
}

/** A review written on this device, kept alongside the seeded ones. */
export type LocalReview = {
  id: string;
  eventId: string;
  authorName: string;
  rating: number;
  body: string;
  tags: string[];
  createdAt: string;
};

export function listLocalReviews(eventId: string): LocalReview[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(REVIEWS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as LocalReview[]).filter(
      (review) => review && review.eventId === eventId,
    );
  } catch {
    return [];
  }
}

export function addLocalReview(review: LocalReview): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(REVIEWS_KEY);
    const existing: LocalReview[] = raw ? (JSON.parse(raw) as LocalReview[]) : [];
    window.localStorage.setItem(
      REVIEWS_KEY,
      JSON.stringify([review, ...existing].slice(0, 100)),
    );
  } catch {
    // Same as above: the review shows for this page view either way.
  }
}
