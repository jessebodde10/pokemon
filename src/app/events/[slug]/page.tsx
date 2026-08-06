import type { Metadata } from 'next';
import { BackLink } from '@/components/events/back-link';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Accessibility,
  Bus,
  CalendarDays,
  Clock,
  ExternalLink,
  MapPin,
  ParkingCircle,
  Ticket as TicketIcon,
  Toilet,
  UtensilsCrossed,
} from 'lucide-react';
import { AiSummary } from '@/components/events/ai-summary';
import {
  FavoriteButton,
  FollowButton,
  ShareButton,
} from '@/components/events/event-actions';
import {
  EventBanner,
  EventTagBadges,
  EventTypeBadge,
  TicketStatusBadge,
} from '@/components/events/event-visuals';
import { ReviewSection } from '@/components/events/review-section';
import { VendorCard } from '@/components/events/vendor-card';
import { Button } from '@/components/ui/button';
import { Panel, SectionHeading } from '@/components/ui/primitives';
import { ProvenanceNote } from '@/components/events/provenance-note';
import { publicConfig } from '@/config/public';
import {
  formatEventDate,
  formatLongDate,
  formatPrice,
  mapsUrl,
} from '@/features/events/format';
import {
  getEventsRepository,
  headlineTicketStatus,
} from '@/features/events/repository';
import { generateEventSummary } from '@/features/events/summary';
import { EVENT_TYPE_LABELS, type EventDetail } from '@/features/events/types';

type Params = { params: Promise<{ slug: string }> };

/** Pre-render every event; the catalogue is small and fully known at build. */
export async function generateStaticParams() {
  const items = await getEventsRepository().listEvents();
  return items.map((item) => ({ slug: item.event.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getEventsRepository().getEventBySlug(slug);
  if (!detail) return { title: 'Evenement niet gevonden' };

  const { event, venue } = detail;
  const title = `${event.name} — ${venue.city}, ${formatLongDate(event.date)}`;
  const description = `${event.summary} ${detail.vendors.length} standhouders in ${venue.name}, ${venue.city}.`;
  const url = `/events/${event.slug}`;

  return {
    title: event.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      locale: 'nl_NL',
      title,
      description,
      url,
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/**
 * Structured data for the event.
 *
 * Only fields that are genuinely known are emitted. An `offers` block is left
 * out entirely for a free event rather than declaring a price of 0, which
 * would be a different claim.
 */
function eventJsonLd(detail: EventDetail) {
  const { event, venue, organizer, tickets } = detail;
  const priced = tickets
    .map((ticket) => ticket.priceEur)
    .filter((price): price is number => price !== null);
  const status = headlineTicketStatus(tickets);

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    description: event.summary,
    startDate: event.date,
    ...(event.endDate ? { endDate: event.endDate } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: `${publicConfig.appUrl}/events/${event.slug}`,
    location: {
      '@type': 'Place',
      name: venue.name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: venue.addressLine,
        postalCode: venue.postalCode,
        addressLocality: venue.city,
        addressRegion: venue.province,
        addressCountry: venue.country,
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: venue.coordinates.latitude,
        longitude: venue.coordinates.longitude,
      },
    },
    organizer: {
      '@type': 'Organization',
      name: organizer.name,
      ...(organizer.website ? { url: organizer.website } : {}),
    },
    ...(priced.length > 0
      ? {
          offers: {
            '@type': 'Offer',
            price: Math.min(...priced).toFixed(2),
            priceCurrency: 'EUR',
            availability:
              status === 'sold-out'
                ? 'https://schema.org/SoldOut'
                : status === 'limited'
                  ? 'https://schema.org/LimitedAvailability'
                  : 'https://schema.org/InStock',
            url: `${publicConfig.appUrl}/events/${event.slug}`,
          },
        }
      : {}),
  };
}

export default async function EventDetailPage({ params }: Params) {
  const { slug } = await params;
  const detail = await getEventsRepository().getEventBySlug(slug);
  if (!detail) notFound();

  const { event, venue, organizer, vendors, tickets, reviews } = detail;
  const banner = detail.images.find((image) => image.role === 'banner') ?? null;
  const status = headlineTicketStatus(tickets);
  const summary = generateEventSummary(detail);

  const practical = [
    { icon: Clock, label: 'Openingstijden', value: event.openingTimes },
    { icon: ParkingCircle, label: 'Parkeren', value: venue.parking },
    { icon: Bus, label: 'Openbaar vervoer', value: venue.publicTransport },
    { icon: UtensilsCrossed, label: 'Eten en drinken', value: venue.food },
    { icon: Toilet, label: 'Toiletten', value: venue.toilets },
    {
      icon: Accessibility,
      label: 'Rolstoeltoegankelijk',
      value: venue.wheelchairAccessible
        ? 'Ja, de hal is rolstoeltoegankelijk.'
        : 'Niet volledig toegankelijk. Neem contact op met de organisator.',
    },
  ] as const;

  return (
    <>
      <script
        type="application/ld+json"
        // Structured data, not user input: the object is built above from
        // typed records, so there is nothing here to escape.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(eventJsonLd(detail)),
        }}
      />

      <article className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <BackLink href="/events">Alle evenementen</BackLink>

        <header>
          <div className="relative overflow-hidden rounded-3xl">
            <EventBanner
              image={banner}
              label={event.name}
              className="h-40 w-full sm:h-56"
            />
            <div className="absolute top-4 left-4 flex flex-wrap gap-2">
              <EventTypeBadge type={event.type} />
              <TicketStatusBadge status={status} />
            </div>
          </div>

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {event.name}
          </h1>
          <p className="mt-3 max-w-2xl text-base text-[var(--text-muted)]">
            {event.summary}
          </p>

          <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <CalendarDays
                className="size-4 text-[var(--color-holo-cyan)]"
                aria-hidden="true"
              />
              <dt className="sr-only">Datum</dt>
              <dd>{formatEventDate(event)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <MapPin
                className="size-4 text-[var(--color-holo-cyan)]"
                aria-hidden="true"
              />
              <dt className="sr-only">Locatie</dt>
              <dd>
                {venue.name}, {venue.city}
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild>
              <a
                href={mapsUrl(venue)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MapPin aria-hidden="true" />
                Route in Google Maps
              </a>
            </Button>
            {event.website ? (
              <Button asChild variant="secondary">
                <a
                  href={event.website}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  <TicketIcon aria-hidden="true" />
                  {status === 'sold-out' ? 'Naar de website' : 'Tickets'}
                </a>
              </Button>
            ) : null}
            <FavoriteButton
              kind="event"
              targetId={event.id}
              label={event.name}
            />
            <FollowButton kind="event" targetId={event.id} label={event.name} />
            <ShareButton title={event.name} text={event.summary} />
          </div>
        </header>

        <div className="mt-10 space-y-10">
          {/* Above the summary on purpose: whether these facts have been
              checked decides how much weight the rest of the page deserves. */}
          <ProvenanceNote provenance={event.provenance} />

          <AiSummary summary={summary} />

          <section aria-labelledby="about-heading">
            <SectionHeading id="about-heading" title="Over deze beurs" />
            <Panel>
              <p className="leading-relaxed">{event.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-4 text-sm">
                <span className="text-[var(--text-muted)]">
                  Georganiseerd door
                </span>
                <span className="font-medium">{organizer.name}</span>
                {organizer.website ? (
                  <a
                    href={organizer.website}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-[var(--color-holo-cyan)] transition-colors hover:bg-white/[0.06] hover:underline"
                  >
                    Website
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                ) : null}
                <FollowButton
                  kind="organizer"
                  targetId={organizer.id}
                  label={organizer.name}
                />
              </div>
              <div className="mt-4">
                <EventTagBadges tags={event.tags} />
              </div>
            </Panel>
          </section>

          <section aria-labelledby="practical-heading">
            <SectionHeading
              id="practical-heading"
              title="Praktische informatie"
              description={`${venue.name}, ${venue.addressLine}, ${venue.postalCode} ${venue.city}`}
            />
            <dl className="grid gap-3 sm:grid-cols-2">
              {practical.map((entry) => {
                const Icon = entry.icon;
                return (
                  <div key={entry.label} className="panel flex gap-3 p-4">
                    <Icon
                      className="mt-0.5 size-4 shrink-0 text-[var(--color-holo-cyan)]"
                      aria-hidden="true"
                    />
                    <div>
                      <dt className="text-sm font-medium">{entry.label}</dt>
                      <dd className="mt-0.5 text-sm text-[var(--text-muted)]">
                        {entry.value}
                      </dd>
                    </div>
                  </div>
                );
              })}
            </dl>
          </section>

          <section aria-labelledby="tickets-heading">
            <SectionHeading id="tickets-heading" title="Tickets" />
            <ul className="space-y-2">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <Panel className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{ticket.label}</p>
                      {ticket.note ? (
                        <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                          {ticket.note}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <TicketStatusBadge status={ticket.status} />
                      <span className="text-base font-semibold text-[var(--color-gold)]">
                        {ticket.priceEur === null
                          ? 'Gratis'
                          : formatPrice(ticket.priceEur)}
                      </span>
                    </div>
                  </Panel>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="vendors-heading">
            <SectionHeading
              id="vendors-heading"
              title="Standhouders"
              description={`${vendors.length} standhouders aangemeld. De lijst kan tot vlak voor de beurs veranderen.`}
            />
            <ul className="grid gap-4 sm:grid-cols-2">
              {vendors.map((vendor) => (
                <li key={vendor.id} className="h-full min-w-0">
                  <VendorCard vendor={vendor} />
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="reviews-heading">
            <SectionHeading
              id="reviews-heading"
              title="Beoordelingen"
              description="Sterren zeggen weinig over of een beurs bij jou past. De labels wel."
            />
            <ReviewSection eventId={event.id} initialReviews={reviews} />
          </section>

          <section aria-labelledby="type-heading">
            <SectionHeading
              id="type-heading"
              title="Meer van dit type"
              description={`Andere beurzen in de categorie ${EVENT_TYPE_LABELS[event.type]}.`}
            />
            <Button asChild variant="outline">
              <Link href="/events">Bekijk de volledige agenda</Link>
            </Button>
          </section>
        </div>
      </article>
    </>
  );
}
