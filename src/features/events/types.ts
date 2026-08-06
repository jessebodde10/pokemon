/**
 * Domain model for the events platform.
 *
 * The shapes mirror the tables this will become, so the in-memory repository
 * can be swapped for Supabase without the UI noticing:
 *
 *   events, venues, organizers, vendors, vendor_categories, event_reviews,
 *   event_tags, event_images, tickets, favorites, notifications
 *
 * Identifiers are slugs rather than UUIDs while the data is local. The
 * repository is the only place that assumption lives.
 */

export const EVENT_TYPES = [
  'pokemon',
  'one-piece',
  'lorcana',
  'yu-gi-oh',
  'multi-tcg',
  'retro-toys',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  pokemon: 'Pokémon',
  'one-piece': 'One Piece',
  lorcana: 'Lorcana',
  'yu-gi-oh': 'Yu-Gi-Oh',
  'multi-tcg': 'Multi TCG',
  'retro-toys': 'Retro Toys',
};

/**
 * Descriptive labels a visitor can expect to find. Kept as a closed set so
 * filtering, badges and the advisor all speak the same vocabulary.
 */
export const EVENT_TAGS = [
  'vintage',
  'japans',
  'psa',
  'sealed',
  'singles',
  'kids-friendly',
  'gratis-parkeren',
  'food-aanwezig',
] as const;

export type EventTag = (typeof EVENT_TAGS)[number];

export const EVENT_TAG_LABELS: Record<EventTag, string> = {
  vintage: 'Vintage',
  japans: 'Japans',
  psa: 'PSA',
  sealed: 'Sealed',
  singles: 'Singles',
  'kids-friendly': 'Kids Friendly',
  'gratis-parkeren': 'Gratis parkeren',
  'food-aanwezig': 'Food aanwezig',
};

export type Country = 'NL' | 'BE';

export const COUNTRY_LABELS: Record<Country, string> = {
  NL: 'Nederland',
  BE: 'België',
};

export const PROVINCES: Record<Country, readonly string[]> = {
  NL: [
    'Drenthe',
    'Flevoland',
    'Friesland',
    'Gelderland',
    'Groningen',
    'Limburg',
    'Noord-Brabant',
    'Noord-Holland',
    'Overijssel',
    'Utrecht',
    'Zeeland',
    'Zuid-Holland',
  ],
  BE: [
    'Antwerpen',
    'Henegouwen',
    'Limburg (BE)',
    'Luik',
    'Luxemburg',
    'Namen',
    'Oost-Vlaanderen',
    'Vlaams-Brabant',
    'Waals-Brabant',
    'West-Vlaanderen',
  ],
};

export type Coordinates = { latitude: number; longitude: number };

/** venues */
export type Venue = {
  id: string;
  name: string;
  addressLine: string;
  postalCode: string;
  city: string;
  province: string;
  country: Country;
  coordinates: Coordinates;
  /** Free-form, shown under "praktische informatie". */
  parking: string;
  publicTransport: string;
  food: string;
  toilets: string;
  wheelchairAccessible: boolean;
  /** Built from the address rather than stored, but cached here for clarity. */
  mapsQuery: string;
};

/** organizers */
export type Organizer = {
  id: string;
  name: string;
  description: string;
  website: string | null;
  instagram: string | null;
  email: string | null;
};

/** vendor_categories */
export type VendorCategory = {
  id: string;
  label: string;
  description: string;
};

/** vendors */
export type Vendor = {
  id: string;
  name: string;
  /** Two-letter mark rendered in place of a logo file. */
  initials: string;
  tagline: string;
  description: string;
  /** References VendorCategory.id */
  categoryIds: string[];
  specialisations: string[];
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  /** A paid placement. Drives ordering and the badge, nothing else. */
  premium: boolean;
  rating: number | null;
  reviewCount: number;
  /** Deterministic accent used for the generated logo tile. */
  accent: string;
};

export type TicketStatus =
  | 'free'
  | 'available'
  | 'limited'
  | 'sold-out'
  | 'at-the-door';

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  free: 'Gratis entree',
  available: 'Tickets beschikbaar',
  limited: 'Beperkt beschikbaar',
  'sold-out': 'Uitverkocht',
  'at-the-door': 'Alleen aan de deur',
};

/** tickets */
export type Ticket = {
  id: string;
  eventId: string;
  label: string;
  /** In euros. `null` means free, never rendered as 0 by accident. */
  priceEur: number | null;
  status: TicketStatus;
  note: string | null;
};

/** event_images */
export type EventImage = {
  id: string;
  eventId: string;
  role: 'banner' | 'gallery';
  alt: string;
  /**
   * Two stops for a generated banner. The platform ships no photography of
   * other people's events, so banners are drawn rather than fetched.
   */
  gradient: [string, string];
};

/** event_reviews */
export type EventReview = {
  id: string;
  eventId: string;
  authorName: string;
  rating: number;
  body: string;
  tags: ReviewTag[];
  createdAt: string;
};

export const REVIEW_TAGS = [
  'veel-vintage',
  'goede-prijzen',
  'veel-sealed',
  'druk',
  'veel-kinderen',
  'goede-sfeer',
  'goede-deals',
  'veel-slabs',
] as const;

export type ReviewTag = (typeof REVIEW_TAGS)[number];

export const REVIEW_TAG_LABELS: Record<ReviewTag, string> = {
  'veel-vintage': 'Veel vintage',
  'goede-prijzen': 'Goede prijzen',
  'veel-sealed': 'Veel sealed',
  druk: 'Druk',
  'veel-kinderen': 'Veel kinderen',
  'goede-sfeer': 'Goede sfeer',
  'goede-deals': 'Goede deals',
  'veel-slabs': 'Veel slabs',
};

/**
 * Where an entry's facts come from, and when someone last checked them.
 *
 * This platform republishes information about other people's events. Dates
 * move, halls change and tickets sell out, so a listing without a source and a
 * check date is an unverifiable claim about someone else's business. Every
 * event carries one, and the UI shows it.
 *
 * `demo` exists because the platform ships with invented entries. They are
 * labelled rather than hidden: a visitor must be able to tell seeded example
 * data from something an organiser actually announced.
 */
export type SourceKind = 'organiser' | 'secondary' | 'demo';

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  organiser: 'Opgave van de organisator',
  secondary: 'Overgenomen uit een openbare agenda',
  demo: 'Voorbeeldgegevens',
};

export type EventProvenance = {
  kind: SourceKind;
  /** Who published the facts. Null only for demo entries. */
  sourceName: string | null;
  /** Link to the announcement the facts were taken from. */
  sourceUrl: string | null;
  /** ISO date on which a human last compared this entry against the source. */
  lastVerifiedAt: string | null;
};

/** events */
export type EventRecord = {
  id: string;
  slug: string;
  name: string;
  /** One-line summary used on cards and in meta descriptions. */
  summary: string;
  description: string;
  type: EventType;
  /** ISO date, local to the venue. */
  date: string;
  endDate: string | null;
  openingTimes: string;
  venueId: string;
  organizerId: string;
  vendorIds: string[];
  tags: EventTag[];
  ticketIds: string[];
  imageIds: string[];
  website: string | null;
  /** Set by the organiser; the platform never invents an attendance figure. */
  expectedVisitors: number | null;
  provenance: EventProvenance;
};

/** How stale a listing is allowed to get before the UI says so. */
export const VERIFICATION_STALE_DAYS = 60;

export type VerificationState = 'demo' | 'fresh' | 'stale' | 'unverified';

/**
 * Turns a provenance record into what the UI should say about it.
 *
 * Kept as a pure function so the rule lives in one place: a listing nobody has
 * checked, and one checked too long ago, both have to read as "confirm this
 * yourself" rather than quietly passing as current.
 */
export function verificationState(
  provenance: EventProvenance,
  now: Date = new Date(),
): VerificationState {
  if (provenance.kind === 'demo') return 'demo';
  if (!provenance.lastVerifiedAt) return 'unverified';
  const checked = Date.parse(provenance.lastVerifiedAt);
  if (Number.isNaN(checked)) return 'unverified';
  const days = (now.getTime() - checked) / 86_400_000;
  return days > VERIFICATION_STALE_DAYS ? 'stale' : 'fresh';
}

/** favorites */
export type FavoriteKind = 'event' | 'organizer' | 'vendor';

export type Favorite = {
  id: string;
  kind: FavoriteKind;
  targetId: string;
  createdAt: string;
};

/** notifications */
export type NotificationKind =
  | 'vendor-added'
  | 'tickets-available'
  | 'date-changed'
  | 'new-event';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Where the notification points. */
  href: string;
  createdAt: string;
  read: boolean;
};

/** A wishlist entry, deliberately loose until the collection link lands. */
export type WishlistEntry = {
  id: string;
  cardName: string;
  note: string | null;
  /** Event slugs where a visitor expects to find this. */
  watchEventIds: string[];
};

/**
 * An event joined with everything a page needs. Assembled by the repository so
 * no component has to know how the pieces relate.
 */
export type EventDetail = {
  event: EventRecord;
  venue: Venue;
  organizer: Organizer;
  vendors: Vendor[];
  tickets: Ticket[];
  images: EventImage[];
  reviews: EventReview[];
};

/** The card-sized projection used in lists. */
export type EventListItem = {
  event: EventRecord;
  venue: Venue;
  banner: EventImage | null;
  vendorCount: number;
  reviewCount: number;
  averageRating: number | null;
  ticketStatus: TicketStatus;
  /** Lowest non-null ticket price, or null when the event is free. */
  fromPriceEur: number | null;
};
