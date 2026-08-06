import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import {
  AdminConsole,
  type AdminCollection,
} from '@/components/events/admin-console';
import { Badge } from '@/components/ui/primitives';
import { formatLongDate } from '@/features/events/format';
import { getEventsRepository } from '@/features/events/repository';
import {
  COUNTRY_LABELS,
  EVENT_TYPE_LABELS,
  REVIEW_TAG_LABELS,
} from '@/features/events/types';

export const metadata: Metadata = {
  title: 'Beheer',
  description: 'Beheerscherm voor evenementen, standhouders en reviews.',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const repository = getEventsRepository();
  const [events, vendors, categories, venues] = await Promise.all([
    repository.listEvents(),
    repository.listVendors(),
    repository.listVendorCategories(),
    repository.listVenues(),
  ]);

  const reviewLists = await Promise.all(
    events.map((item) => repository.listReviews(item.event.id)),
  );
  const reviews = reviewLists.flat();

  const collections: AdminCollection[] = [
    {
      key: 'events',
      label: 'Evenementen',
      noun: 'Evenement',
      typed: true,
      rows: events.map((item) => ({
        id: item.event.id,
        primary: item.event.name,
        secondary: `${formatLongDate(item.event.date)} · ${item.venue.city}`,
        meta: EVENT_TYPE_LABELS[item.event.type],
      })),
    },
    {
      key: 'vendors',
      label: 'Standhouders',
      noun: 'Standhouder',
      rows: vendors.map((vendor) => ({
        id: vendor.id,
        primary: vendor.name,
        secondary: vendor.tagline,
        meta: vendor.premium ? 'Premium' : undefined,
      })),
    },
    {
      key: 'reviews',
      label: 'Reviews',
      noun: 'Review',
      rows: reviews.map((review) => ({
        id: review.id,
        primary: `${review.authorName} — ${review.rating}/5`,
        secondary: review.body || '(geen toelichting)',
        meta: review.tags[0] ? REVIEW_TAG_LABELS[review.tags[0]] : undefined,
      })),
    },
    {
      key: 'categories',
      label: 'Categorieën',
      noun: 'Categorie',
      rows: categories.map((category) => ({
        id: category.id,
        primary: category.label,
        secondary: category.description,
      })),
    },
    {
      key: 'venues',
      label: 'Locaties',
      noun: 'Locatie',
      rows: venues.map((venue) => ({
        id: venue.id,
        primary: venue.name,
        secondary: `${venue.addressLine}, ${venue.postalCode} ${venue.city}`,
        meta: COUNTRY_LABELS[venue.country],
      })),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <nav aria-label="Kruimelpad" className="mb-5 text-sm">
        <Link
          href="/events"
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          ← Alle evenementen
        </Link>
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Beheer
        </h1>
        <Badge tone="caution">Demo</Badge>
      </div>

      <p
        role="note"
        className="mt-4 flex items-start gap-2 rounded-xl border border-[color-mix(in_oklab,var(--color-caution)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-caution)_10%,transparent)] px-4 py-3 text-sm leading-relaxed text-[var(--color-caution)]"
      >
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Wijzigingen hier worden nergens opgeslagen. Ze bestaan zolang deze
          pagina open staat en verdwijnen bij het verversen. Dit scherm laat
          zien hoe het beheer werkt, het is nog geen beheersysteem — en er zit
          nog geen toegangscontrole op.
        </span>
      </p>

      <div className="mt-8">
        <AdminConsole collections={collections} />
      </div>
    </div>
  );
}
