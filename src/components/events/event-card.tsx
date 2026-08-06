'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, MapPin, Navigation, Store } from 'lucide-react';
import {
  EventBanner,
  EventTagBadges,
  EventTypeBadge,
  RatingDisplay,
  TicketStatusBadge,
} from './event-visuals';
import {
  formatDistance,
  formatEventDate,
  formatFromPrice,
  formatRelativeDate,
  venueLine,
} from '@/features/events/format';
import type { RankedEvent } from '@/features/events/filtering';

/**
 * Event card.
 *
 * Everything a visitor needs to decide whether to open the page: what it is,
 * when, where, how far, how many vendors, how it was rated, whether they can
 * still get in and what it costs.
 */
export function EventCard({ item, index = 0 }: { item: RankedEvent; index?: number }) {
  const reduceMotion = useReducedMotion();
  const distance = formatDistance(item.distanceKm);
  const isFree = item.ticketStatus === 'free';

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.32,
        // Stagger only the first screenful; beyond that the delay would be
        // long enough to feel like the page is stuck.
        delay: reduceMotion ? 0 : Math.min(index, 7) * 0.04,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={reduceMotion ? undefined : { y: -4 }}
      className="group panel-raised h-full overflow-hidden p-0 transition-colors hover:border-white/20"
    >
      <Link
        href={`/events/${item.event.slug}`}
        className="flex h-full flex-col focus-visible:outline-none"
      >
        <div className="relative">
          <EventBanner
            image={item.banner}
            label={item.event.name}
            className="h-32 w-full transition-transform duration-500 group-hover:scale-[1.04] sm:h-36"
            compact
          />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            <EventTypeBadge type={item.event.type} />
          </div>
          <div className="absolute right-3 bottom-3">
            <TicketStatusBadge status={item.ticketStatus} />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <div>
            <h3 className="text-base leading-snug font-semibold tracking-tight">
              {item.event.name}
            </h3>
            <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">
              {item.event.summary}
            </p>
          </div>

          <dl className="grid gap-1.5 text-sm">
            <div className="flex items-center gap-2">
              <CalendarDays
                className="size-4 shrink-0 text-[var(--color-holo-cyan)]"
                aria-hidden="true"
              />
              <dt className="sr-only">Datum</dt>
              <dd>
                {formatEventDate(item.event)}
                <span className="ml-2 text-xs text-[var(--text-muted)]">
                  {formatRelativeDate(item.event.date)}
                </span>
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <MapPin
                className="size-4 shrink-0 text-[var(--color-holo-cyan)]"
                aria-hidden="true"
              />
              <dt className="sr-only">Locatie</dt>
              <dd className="text-[var(--text-muted)]">
                {venueLine(item.venue)}
              </dd>
            </div>
            {distance ? (
              <div className="flex items-center gap-2">
                <Navigation
                  className="size-4 shrink-0 text-[var(--color-holo-cyan)]"
                  aria-hidden="true"
                />
                <dt className="sr-only">Afstand</dt>
                <dd className="text-[var(--text-muted)]">
                  {distance} hemelsbreed
                </dd>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Store
                className="size-4 shrink-0 text-[var(--color-holo-cyan)]"
                aria-hidden="true"
              />
              <dt className="sr-only">Standhouders</dt>
              <dd className="text-[var(--text-muted)]">
                {item.vendorCount} standhouders aangemeld
              </dd>
            </div>
          </dl>

          <EventTagBadges tags={item.event.tags} limit={3} />

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3">
            <RatingDisplay
              rating={item.averageRating}
              count={item.reviewCount}
            />
            {/* Gold is reserved for money throughout the app. */}
            <span className="text-sm font-semibold text-[var(--color-gold)]">
              {formatFromPrice(item.fromPriceEur, isFree)}
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
