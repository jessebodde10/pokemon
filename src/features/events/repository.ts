import {
  eventImages,
  eventReviews,
  events,
  favoriteSeeds,
  notifications,
  organizers,
  tickets,
  vendorCategories,
  vendors,
  venues,
  wishlist,
} from './data/mock-data';
import { summariseReviews } from './reviews';
import type {
  AppNotification,
  EventDetail,
  EventImage,
  EventListItem,
  EventRecord,
  EventReview,
  Favorite,
  FavoriteKind,
  Organizer,
  Ticket,
  TicketStatus,
  Vendor,
  VendorCategory,
  Venue,
  WishlistEntry,
} from './types';

/**
 * Data access for the events platform.
 *
 * The interface is the contract every page codes against. Today it is served
 * from local seed data; a Supabase implementation can be dropped in behind
 * `setEventsRepository` without touching a single component, exactly as the
 * analysis side of the app already does.
 */
export interface EventsRepository {
  listEvents(): Promise<EventListItem[]>;
  getEventBySlug(slug: string): Promise<EventDetail | null>;
  listVendors(): Promise<Vendor[]>;
  getVendor(id: string): Promise<Vendor | null>;
  listVendorCategories(): Promise<VendorCategory[]>;
  listVenues(): Promise<Venue[]>;
  listOrganizers(): Promise<Organizer[]>;
  /** Upcoming events a given vendor attends. */
  listEventsForVendor(vendorId: string): Promise<EventListItem[]>;
  listReviews(eventId: string): Promise<EventReview[]>;
  addReview(input: Omit<EventReview, 'id' | 'createdAt'>): Promise<EventReview>;
  listFavorites(): Promise<Favorite[]>;
  toggleFavorite(kind: FavoriteKind, targetId: string): Promise<boolean>;
  listNotifications(): Promise<AppNotification[]>;
  listWishlist(): Promise<WishlistEntry[]>;
}

/**
 * The ticket status shown on a card.
 *
 * An event sells several ticket types, so the card needs one honest headline.
 * Free wins outright; otherwise the most encouraging status that is actually
 * purchasable wins, and "uitverkocht" only shows when nothing is left.
 */
export function headlineTicketStatus(
  eventTickets: readonly Ticket[],
): TicketStatus {
  if (eventTickets.length === 0) return 'at-the-door';
  if (eventTickets.some((ticket) => ticket.status === 'free')) return 'free';
  if (eventTickets.some((ticket) => ticket.status === 'available')) {
    return 'available';
  }
  if (eventTickets.some((ticket) => ticket.status === 'limited')) {
    return 'limited';
  }
  if (eventTickets.some((ticket) => ticket.status === 'at-the-door')) {
    return 'at-the-door';
  }
  return 'sold-out';
}

/** Lowest priced ticket, or null when the event is free or unpriced. */
export function lowestPrice(eventTickets: readonly Ticket[]): number | null {
  const prices = eventTickets
    .map((ticket) => ticket.priceEur)
    .filter((price): price is number => price !== null);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

export class InMemoryEventsRepository implements EventsRepository {
  private readonly reviews: EventReview[] = [...eventReviews];
  private readonly favorites: Favorite[] = [
    ...favoriteSeeds.events.map((id, index) => ({
      id: `fav-event-${index}`,
      kind: 'event' as const,
      targetId: id,
      createdAt: new Date().toISOString(),
    })),
    ...favoriteSeeds.vendors.map((id, index) => ({
      id: `fav-vendor-${index}`,
      kind: 'vendor' as const,
      targetId: id,
      createdAt: new Date().toISOString(),
    })),
    ...favoriteSeeds.organizers.map((id, index) => ({
      id: `fav-org-${index}`,
      kind: 'organizer' as const,
      targetId: id,
      createdAt: new Date().toISOString(),
    })),
  ];

  private ticketsFor(event: EventRecord): Ticket[] {
    return tickets.filter((ticket) => event.ticketIds.includes(ticket.id));
  }

  private bannerFor(event: EventRecord): EventImage | null {
    return (
      eventImages.find(
        (image) => event.imageIds.includes(image.id) && image.role === 'banner',
      ) ?? null
    );
  }

  private toListItem(event: EventRecord): EventListItem {
    const venue = venues.find((item) => item.id === event.venueId);
    if (!venue) {
      throw new Error(`Event ${event.id} references unknown venue`);
    }
    const eventTickets = this.ticketsFor(event);
    const summary = summariseReviews(
      this.reviews.filter((review) => review.eventId === event.id),
    );

    return {
      event,
      venue,
      banner: this.bannerFor(event),
      vendorCount: event.vendorIds.length,
      reviewCount: summary.count,
      averageRating: summary.averageRating,
      ticketStatus: headlineTicketStatus(eventTickets),
      fromPriceEur: lowestPrice(eventTickets),
    };
  }

  async listEvents(): Promise<EventListItem[]> {
    return events
      .map((event) => this.toListItem(event))
      .sort((a, b) => a.event.date.localeCompare(b.event.date));
  }

  async getEventBySlug(slug: string): Promise<EventDetail | null> {
    const event = events.find((item) => item.slug === slug);
    if (!event) return null;

    const venue = venues.find((item) => item.id === event.venueId);
    const organizer = organizers.find((item) => item.id === event.organizerId);
    if (!venue || !organizer) return null;

    return {
      event,
      venue,
      organizer,
      // Premium placements sort first; that is the whole of what a paid
      // profile buys today, and it is visible as a badge.
      vendors: vendors
        .filter((vendor) => event.vendorIds.includes(vendor.id))
        .sort((a, b) => Number(b.premium) - Number(a.premium)),
      tickets: this.ticketsFor(event),
      images: eventImages.filter((image) => event.imageIds.includes(image.id)),
      reviews: this.reviews
        .filter((review) => review.eventId === event.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  }

  async listVendors(): Promise<Vendor[]> {
    return [...vendors].sort(
      (a, b) =>
        Number(b.premium) - Number(a.premium) || a.name.localeCompare(b.name),
    );
  }

  async getVendor(id: string): Promise<Vendor | null> {
    return vendors.find((vendor) => vendor.id === id) ?? null;
  }

  async listVendorCategories(): Promise<VendorCategory[]> {
    return [...vendorCategories];
  }

  async listVenues(): Promise<Venue[]> {
    return [...venues];
  }

  async listOrganizers(): Promise<Organizer[]> {
    return [...organizers];
  }

  async listEventsForVendor(vendorId: string): Promise<EventListItem[]> {
    return events
      .filter((event) => event.vendorIds.includes(vendorId))
      .map((event) => this.toListItem(event))
      .sort((a, b) => a.event.date.localeCompare(b.event.date));
  }

  async listReviews(eventId: string): Promise<EventReview[]> {
    return this.reviews
      .filter((review) => review.eventId === eventId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async addReview(
    input: Omit<EventReview, 'id' | 'createdAt'>,
  ): Promise<EventReview> {
    const review: EventReview = {
      ...input,
      id: `review-${this.reviews.length + 1}-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.reviews.unshift(review);
    return review;
  }

  async listFavorites(): Promise<Favorite[]> {
    return [...this.favorites];
  }

  async toggleFavorite(kind: FavoriteKind, targetId: string): Promise<boolean> {
    const index = this.favorites.findIndex(
      (favorite) => favorite.kind === kind && favorite.targetId === targetId,
    );
    if (index >= 0) {
      this.favorites.splice(index, 1);
      return false;
    }
    this.favorites.push({
      id: `fav-${kind}-${targetId}`,
      kind,
      targetId,
      createdAt: new Date().toISOString(),
    });
    return true;
  }

  async listNotifications(): Promise<AppNotification[]> {
    return [...notifications].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  async listWishlist(): Promise<WishlistEntry[]> {
    return [...wishlist];
  }
}

let repository: EventsRepository | null = null;

export function getEventsRepository(): EventsRepository {
  repository ??= new InMemoryEventsRepository();
  return repository;
}

/** Test seam, and the hook a database implementation plugs into. */
export function setEventsRepository(next: EventsRepository | null): void {
  repository = next;
}
