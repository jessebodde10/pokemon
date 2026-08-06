import { AppError } from '@/lib/errors/app-error';
import type { EventListItem, Ticket, Vendor } from '../types';

/**
 * Contracts for the parts of the platform that do not exist yet.
 *
 * These are interfaces plus a registry, not stubs pretending to work. Every
 * unimplemented method throws a typed error rather than returning empty data,
 * because a silent empty array is indistinguishable from "there is nothing"
 * and would let a half-built feature ship unnoticed.
 *
 * Adding a real implementation means writing a class against the interface and
 * registering it. No calling code changes.
 */

export class NotImplementedError extends AppError {
  constructor(feature: string) {
    super(
      'NOT_IMPLEMENTED',
      `${feature} is not implemented yet`,
      'Dit onderdeel is nog niet beschikbaar.',
      501,
      { feature },
    );
  }
}

/** AI-driven recommendations beyond the rule-based advisor. */
export interface RecommendationService {
  readonly name: string;
  /** Personalised suggestions from behaviour rather than a filled-in form. */
  recommendForVisitor(visitorId: string): Promise<EventListItem[]>;
  /** "Because you saved X" style suggestions next to an event. */
  relatedEvents(eventId: string): Promise<EventListItem[]>;
}

/** Selling tickets rather than linking out to the organiser. */
export interface TicketingService {
  readonly name: string;
  listAvailability(eventId: string): Promise<Ticket[]>;
  reserve(input: {
    ticketId: string;
    quantity: number;
    visitorId: string;
  }): Promise<{ reservationId: string; expiresAt: string }>;
  confirm(reservationId: string): Promise<{ orderId: string }>;
}

/** Paid vendor profiles: what a subscription actually unlocks. */
export interface VendorSubscriptionService {
  readonly name: string;
  getPlan(vendorId: string): Promise<{
    tier: 'free' | 'premium';
    renewsAt: string | null;
  }>;
  /** Which capabilities the current plan grants, so the UI can gate on it. */
  entitlements(vendorId: string): Promise<{
    highlightedPlacement: boolean;
    galleryImages: number;
    analytics: boolean;
  }>;
}

/** Advertising slots, kept separate from editorial content by design. */
export interface AdvertisingService {
  readonly name: string;
  /**
   * Slot contents must be distinguishable from organic results; the return
   * type carries the disclosure label rather than leaving it to the caller.
   */
  fetchSlot(slotId: string): Promise<{
    slotId: string;
    disclosure: string;
    vendor: Vendor | null;
  } | null>;
}

/** Buying and selling between collectors. */
export interface MarketplaceService {
  readonly name: string;
  listOffers(cardName: string): Promise<
    Array<{ vendorId: string; priceEur: number; condition: string }>
  >;
  createListing(input: {
    sellerId: string;
    cardName: string;
    priceEur: number;
  }): Promise<{ listingId: string }>;
}

/** Ties the events side to the analysis side of the app. */
export interface CollectionLinkService {
  readonly name: string;
  /** Cards the visitor confirmed in an analysis, for wishlist matching. */
  ownedCardNames(userId: string): Promise<string[]>;
  /** Vendors at an event who list what the visitor is missing. */
  matchVendorsToGaps(input: {
    userId: string;
    eventId: string;
  }): Promise<Vendor[]>;
}

/** Wishlist as a first-class, server-stored list. */
export interface WishlistService {
  readonly name: string;
  add(input: { userId: string; cardName: string }): Promise<void>;
  remove(input: { userId: string; entryId: string }): Promise<void>;
  /** Events where a wished-for card is likely to turn up. */
  suggestEvents(userId: string): Promise<EventListItem[]>;
}

/** Alerts when a watched card moves in price. */
export interface PriceAlertService {
  readonly name: string;
  create(input: {
    userId: string;
    cardName: string;
    belowEur: number;
  }): Promise<{ alertId: string }>;
  list(userId: string): Promise<
    Array<{ alertId: string; cardName: string; belowEur: number }>
  >;
  cancel(alertId: string): Promise<void>;
}

export type EventsServiceBundle = {
  recommendations: RecommendationService | null;
  ticketing: TicketingService | null;
  vendorSubscriptions: VendorSubscriptionService | null;
  advertising: AdvertisingService | null;
  marketplace: MarketplaceService | null;
  collectionLink: CollectionLinkService | null;
  wishlist: WishlistService | null;
  priceAlerts: PriceAlertService | null;
};

const services: EventsServiceBundle = {
  recommendations: null,
  ticketing: null,
  vendorSubscriptions: null,
  advertising: null,
  marketplace: null,
  collectionLink: null,
  wishlist: null,
  priceAlerts: null,
};

/**
 * Resolves a service, or throws a typed error naming what is missing.
 *
 * Callers can check `isServiceAvailable` first when a feature is optional, so
 * a page can hide a section rather than fail.
 */
export function requireService<K extends keyof EventsServiceBundle>(
  key: K,
): NonNullable<EventsServiceBundle[K]> {
  const service = services[key];
  if (!service) throw new NotImplementedError(String(key));
  return service as NonNullable<EventsServiceBundle[K]>;
}

export function isServiceAvailable(key: keyof EventsServiceBundle): boolean {
  return services[key] !== null;
}

export function registerService<K extends keyof EventsServiceBundle>(
  key: K,
  implementation: EventsServiceBundle[K],
): void {
  services[key] = implementation;
}
