import type { Metadata } from 'next';
import { BackLink } from '@/components/events/back-link';
import { notFound } from 'next/navigation';
import { Crown, ExternalLink, Facebook, Instagram } from 'lucide-react';
import { EventCard } from '@/components/events/event-card';
import {
  FavoriteButton,
  FollowButton,
} from '@/components/events/event-actions';
import { RatingDisplay, VendorMark } from '@/components/events/event-visuals';
import {
  Badge,
  EmptyState,
  Panel,
  SectionHeading,
} from '@/components/ui/primitives';
import { getEventsRepository } from '@/features/events/repository';

type Params = { params: Promise<{ vendorId: string }> };

export async function generateStaticParams() {
  const vendors = await getEventsRepository().listVendors();
  return vendors.map((vendor) => ({ vendorId: vendor.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { vendorId } = await params;
  const vendor = await getEventsRepository().getVendor(vendorId);
  if (!vendor) return { title: 'Standhouder niet gevonden' };

  const description = `${vendor.tagline}. ${vendor.description}`.slice(0, 300);
  return {
    title: vendor.name,
    description,
    alternates: { canonical: `/vendors/${vendor.id}` },
    openGraph: {
      type: 'profile',
      locale: 'nl_NL',
      title: `${vendor.name} — standhouder`,
      description,
      url: `/vendors/${vendor.id}`,
    },
  };
}

export default async function VendorPage({ params }: Params) {
  const { vendorId } = await params;
  const repository = getEventsRepository();
  const vendor = await repository.getVendor(vendorId);
  if (!vendor) notFound();

  const [upcoming, categories] = await Promise.all([
    repository.listEventsForVendor(vendor.id),
    repository.listVendorCategories(),
  ]);

  const vendorCategories = categories.filter((category) =>
    vendor.categoryIds.includes(category.id),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <BackLink href="/vendors">Alle standhouders</BackLink>

      <header>
        {/* Banner drawn from the vendor's own accent, so a profile is
            recognisable without hosting anyone's artwork. */}
        <div
          className="h-28 rounded-3xl sm:h-36"
          style={{
            backgroundImage: `linear-gradient(115deg, ${vendor.accent}, color-mix(in oklab, ${vendor.accent} 25%, #0b0d14))`,
          }}
          role="img"
          aria-label={`Sfeerbanner van ${vendor.name}`}
        />

        <div className="-mt-8 flex flex-wrap items-end gap-4 px-1">
          <VendorMark
            initials={vendor.initials}
            accent={vendor.accent}
            className="size-16 rounded-2xl text-xl ring-4 ring-[var(--surface-page)]"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {vendor.name}
              </h1>
              {vendor.premium ? (
                <Badge tone="accent" title="Betaald standhoudersprofiel">
                  <Crown className="size-3" aria-hidden="true" />
                  Premium
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-[var(--text-muted)]">{vendor.tagline}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <RatingDisplay rating={vendor.rating} count={vendor.reviewCount} />
          <FavoriteButton
            kind="vendor"
            targetId={vendor.id}
            label={vendor.name}
          />
          <FollowButton
            kind="vendor"
            targetId={vendor.id}
            label={vendor.name}
          />
        </div>
      </header>

      <div className="mt-10 space-y-10">
        <section aria-labelledby="vendor-about">
          <SectionHeading id="vendor-about" title="Over deze standhouder" />
          <Panel>
            <p className="leading-relaxed">{vendor.description}</p>

            <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
              <h3 className="text-sm font-medium text-[var(--text-muted)]">
                Specialisaties
              </h3>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {vendor.specialisations.map((item) => (
                  <li key={item}>
                    <Badge>{item}</Badge>
                  </li>
                ))}
                {vendorCategories.map((category) => (
                  <li key={category.id}>
                    <Badge tone="accent">{category.label}</Badge>
                  </li>
                ))}
              </ul>
            </div>

            {vendor.website || vendor.instagram || vendor.facebook ? (
              <div className="mt-4 -ml-2 flex flex-wrap gap-1 border-t border-[var(--border-subtle)] pt-4 text-sm">
                {vendor.website ? (
                  <a
                    href={vendor.website}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-[var(--color-holo-cyan)] transition-colors hover:bg-white/[0.06] hover:underline"
                  >
                    <ExternalLink className="size-4" aria-hidden="true" />
                    Website
                  </a>
                ) : null}
                {vendor.instagram ? (
                  <a
                    href={`https://instagram.com/${vendor.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-[var(--color-holo-cyan)] transition-colors hover:bg-white/[0.06] hover:underline"
                  >
                    <Instagram className="size-4" aria-hidden="true" />
                    Instagram
                  </a>
                ) : null}
                {vendor.facebook ? (
                  <a
                    href={`https://facebook.com/${vendor.facebook}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-[var(--color-holo-cyan)] transition-colors hover:bg-white/[0.06] hover:underline"
                  >
                    <Facebook className="size-4" aria-hidden="true" />
                    Facebook
                  </a>
                ) : null}
              </div>
            ) : null}
          </Panel>
        </section>

        <section aria-labelledby="vendor-events">
          <SectionHeading
            id="vendor-events"
            title="Komende beurzen"
            description={`Waar je ${vendor.name} tegenkomt.`}
          />
          {upcoming.length === 0 ? (
            <EmptyState
              title="Nog niet ingepland"
              description="Deze standhouder staat op dit moment niet aangemeld voor een beurs in de agenda."
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {upcoming.map((item, index) => (
                <li key={item.event.id} className="h-full">
                  <EventCard
                    item={{ ...item, distanceKm: null }}
                    index={index}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--color-ink-900)] px-4 py-3 text-sm leading-relaxed text-[var(--text-muted)]">
          Beoordelingen van standhouders zijn afkomstig van bezoekers en zeggen
          niets over de echtheid of staat van losse kaarten. Beoordeel een kaart
          altijd zelf voor je koopt.
        </p>
      </div>
    </div>
  );
}
