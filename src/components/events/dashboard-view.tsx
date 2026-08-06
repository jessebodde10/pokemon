'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Bell,
  CalendarClock,
  CalendarPlus,
  Heart,
  Store,
  Ticket,
} from 'lucide-react';
import { EventCard } from './event-card';
import { VendorCard } from './vendor-card';
import { Button } from '@/components/ui/button';
import {
  Badge,
  EmptyState,
  Panel,
  SectionHeading,
} from '@/components/ui/primitives';
import { listFavorites, listFollows } from '@/features/events/client-store';
import { formatRelativeDate } from '@/features/events/format';
import type {
  AppNotification,
  EventListItem,
  Vendor,
  WishlistEntry,
} from '@/features/events/types';

/**
 * Events dashboard.
 *
 * Favourites live in the browser, so the lists are resolved after mount by
 * intersecting the stored ids with the full catalogue the server sent. That
 * avoids a hydration mismatch and keeps the page useful without an account.
 */
export function EventsDashboard({
  allEvents,
  allVendors,
  notifications,
  wishlist,
}: {
  allEvents: EventListItem[];
  allVendors: Vendor[];
  notifications: AppNotification[];
  wishlist: WishlistEntry[];
}) {
  const reduceMotion = useReducedMotion();
  const [ready, setReady] = React.useState(false);
  const [favoriteEventIds, setFavoriteEventIds] = React.useState<string[]>([]);
  const [savedVendorIds, setSavedVendorIds] = React.useState<string[]>([]);
  const [followedIds, setFollowedIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    setFavoriteEventIds(listFavorites('event'));
    setSavedVendorIds(listFavorites('vendor'));
    setFollowedIds([
      ...listFollows('event'),
      ...listFollows('vendor'),
      ...listFollows('organizer'),
    ]);
    setReady(true);
  }, []);

  const favoriteEvents = allEvents.filter((item) =>
    favoriteEventIds.includes(item.event.id),
  );
  const savedVendors = allVendors.filter((vendor) =>
    savedVendorIds.includes(vendor.id),
  );
  const unread = notifications.filter((entry) => !entry.read).length;

  return (
    <div className="space-y-12">
      <section aria-labelledby="dash-notifications">
        <SectionHeading
          id="dash-notifications"
          title="Meldingen"
          description="Updates over wat je volgt."
          action={
            unread > 0 ? (
              <Badge tone="accent">{unread} nieuw</Badge>
            ) : undefined
          }
        />
        <ul className="space-y-2">
          {notifications.map((entry, index) => (
            <motion.li
              key={entry.id}
              initial={reduceMotion ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04 }}
            >
              <Link href={entry.href} className="block">
                <Panel
                  className={
                    entry.read
                      ? 'flex items-start gap-3 transition-colors hover:border-white/20'
                      : 'flex items-start gap-3 border-[color-mix(in_oklab,var(--color-holo-cyan)_35%,transparent)] transition-colors hover:border-white/30'
                  }
                >
                  <span
                    className={
                      entry.read
                        ? 'mt-1 size-2 shrink-0 rounded-full bg-[var(--color-ink-700)]'
                        : 'mt-1 size-2 shrink-0 rounded-full bg-[var(--color-holo-cyan)]'
                    }
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="font-medium">{entry.title}</p>
                    <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                      {entry.body}
                    </p>
                  </div>
                  <Bell
                    className="ml-auto size-4 shrink-0 text-[var(--text-muted)]"
                    aria-hidden="true"
                  />
                </Panel>
              </Link>
            </motion.li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          {ready && followedIds.length > 0
            ? `Je volgt ${followedIds.length} ${followedIds.length === 1 ? 'item' : 'items'} op dit apparaat.`
            : 'Volg een beurs, organisator of standhouder om hier updates te zien.'}
        </p>
      </section>

      <section aria-labelledby="dash-events">
        <SectionHeading
          id="dash-events"
          title="Bewaarde evenementen"
          description="Beurzen die je hebt opgeslagen."
        />
        {!ready ? (
          <Panel>
            <p className="text-sm text-[var(--text-muted)]">Bezig met laden…</p>
          </Panel>
        ) : favoriteEvents.length === 0 ? (
          <EmptyState
            icon={<Heart className="size-6" />}
            title="Nog niets bewaard"
            description="Sla een beurs op vanaf de eventpagina, dan staat hij hier klaar."
            action={
              <Button asChild variant="secondary">
                <Link href="/events">Naar de agenda</Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favoriteEvents.map((item, index) => (
              <li key={item.event.id} className="h-full">
                <EventCard item={{ ...item, distanceKm: null }} index={index} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="dash-vendors">
        <SectionHeading
          id="dash-vendors"
          title="Opgeslagen standhouders"
          description="Handelaren die je in de gaten houdt."
        />
        {!ready ? null : savedVendors.length === 0 ? (
          <EmptyState
            icon={<Store className="size-6" />}
            title="Nog geen standhouders opgeslagen"
            description="Bewaar een standhouder om te zien op welke beurzen ze staan."
            action={
              <Button asChild variant="secondary">
                <Link href="/vendors">Bekijk standhouders</Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {savedVendors.map((vendor) => (
              <li key={vendor.id} className="h-full">
                <VendorCard vendor={vendor} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="dash-wishlist">
        <SectionHeading
          id="dash-wishlist"
          title="Wishlist"
          description="Kaarten die je zoekt, en waar ze mogelijk te vinden zijn."
        />
        <ul className="space-y-2">
          {wishlist.map((entry) => {
            const matches = allEvents.filter((item) =>
              entry.watchEventIds.includes(item.event.id),
            );
            return (
              <li key={entry.id}>
                <Panel>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{entry.cardName}</p>
                      {entry.note ? (
                        <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                          {entry.note}
                        </p>
                      ) : null}
                    </div>
                    <Ticket
                      className="size-4 shrink-0 text-[var(--text-muted)]"
                      aria-hidden="true"
                    />
                  </div>
                  {matches.length > 0 ? (
                    <ul className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-3">
                      {matches.map((item) => (
                        <li key={item.event.id}>
                          <Link
                            href={`/events/${item.event.slug}`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs hover:border-white/30"
                          >
                            <CalendarClock
                              className="size-3.5 text-[var(--color-holo-cyan)]"
                              aria-hidden="true"
                            />
                            {item.event.name}
                            <span className="text-[var(--text-muted)]">
                              {formatRelativeDate(item.event.date)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-sm text-[var(--text-muted)]">
                      Geen beurs in de agenda waar deze kaart specifiek wordt
                      verwacht.
                    </p>
                  )}
                </Panel>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          De wishlist is in deze demo nog niet gekoppeld aan je collectie. Die
          koppeling staat als losse service klaar.
        </p>
      </section>

      <section>
        <Panel raised className="flex flex-wrap items-center gap-4">
          <CalendarPlus
            className="size-5 text-[var(--color-holo-cyan)]"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Organiseer je zelf een beurs?</p>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              Beheer evenementen en standhouders via het beheerscherm.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/admin">Naar beheer</Link>
          </Button>
        </Panel>
      </section>
    </div>
  );
}
