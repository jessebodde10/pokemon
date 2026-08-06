import Link from 'next/link';
import { Crown, ExternalLink, Instagram } from 'lucide-react';
import { RatingDisplay, VendorMark } from './event-visuals';
import { Badge } from '@/components/ui/primitives';
import type { Vendor } from '@/features/events/types';

/**
 * Vendor card.
 *
 * The premium badge is stated plainly rather than dressed up: a paid profile
 * sorts higher and carries a mark, and a visitor can see that is what it is.
 * It never changes the rating or the review count.
 */
export function VendorCard({ vendor }: { vendor: Vendor }) {
  return (
    <article className="panel-raised group flex h-full flex-col gap-3 p-4 transition-colors hover:border-white/20">
      <div className="flex items-start gap-3">
        <VendorMark initials={vendor.initials} accent={vendor.accent} />
        <div className="min-w-0 flex-1">
          <h3 className="leading-snug font-semibold">
            <Link
              href={`/vendors/${vendor.id}`}
              className="hover:text-[var(--color-holo-cyan)]"
            >
              {vendor.name}
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-sm text-[var(--text-muted)]">
            {vendor.tagline}
          </p>
        </div>
        {vendor.premium ? (
          <Badge tone="accent" title="Betaald standhoudersprofiel">
            <Crown className="size-3" aria-hidden="true" />
            Premium
          </Badge>
        ) : null}
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {vendor.specialisations.slice(0, 3).map((item) => (
          <li key={item}>
            <Badge>{item}</Badge>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3">
        <RatingDisplay rating={vendor.rating} count={vendor.reviewCount} />
        <div className="flex items-center gap-1">
          {vendor.instagram ? (
            <a
              href={`https://instagram.com/${vendor.instagram}`}
              target="_blank"
              rel="noopener noreferrer nofollow"
              aria-label={`${vendor.name} op Instagram`}
              className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-white/[0.06] hover:text-[var(--text-primary)]"
            >
              <Instagram className="size-4" aria-hidden="true" />
            </a>
          ) : null}
          {vendor.website ? (
            <a
              href={vendor.website}
              target="_blank"
              rel="noopener noreferrer nofollow"
              aria-label={`Website van ${vendor.name}`}
              className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-white/[0.06] hover:text-[var(--text-primary)]"
            >
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
