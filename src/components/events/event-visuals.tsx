import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/primitives';
import {
  EVENT_TAG_LABELS,
  EVENT_TYPE_LABELS,
  TICKET_STATUS_LABELS,
  type EventImage,
  type EventTag,
  type EventType,
  type TicketStatus,
} from '@/features/events/types';
import { cn } from '@/lib/utils';

/**
 * Generated banner.
 *
 * The platform ships no photography of other people's events, so a banner is
 * drawn from two stored colour stops. Deterministic per event, so a fair looks
 * the same on every visit, and nothing is fetched from a third party.
 */
export function EventBanner({
  image,
  label,
  className,
  compact = false,
}: {
  image: EventImage | null;
  label: string;
  className?: string;
  compact?: boolean;
}) {
  const [from, to] = image?.gradient ?? ['#2b3350', '#171c2e'];

  return (
    <div
      role="img"
      aria-label={image?.alt ?? `Sfeerbanner voor ${label}`}
      className={cn(
        'relative overflow-hidden bg-[var(--color-ink-800)]',
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(115deg, ${from} 0%, ${to} 100%)`,
      }}
    >
      {/* A soft grid reads as a hall floor plan without depicting any real
          venue, and keeps the flat gradient from looking unfinished. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.6) 1px, transparent 1px)',
          backgroundSize: compact ? '26px 26px' : '44px 44px',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 15% 10%, rgba(255,255,255,.28), transparent 60%), linear-gradient(to top, rgba(11,13,20,.85), transparent 55%)',
        }}
      />
    </div>
  );
}

export function EventTypeBadge({ type }: { type: EventType }) {
  return <Badge tone="accent">{EVENT_TYPE_LABELS[type]}</Badge>;
}

export function EventTagBadges({
  tags,
  limit,
}: {
  tags: readonly EventTag[];
  limit?: number;
}) {
  const shown = limit ? tags.slice(0, limit) : tags;
  const rest = limit ? tags.length - shown.length : 0;

  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((tag) => (
        <Badge key={tag}>{EVENT_TAG_LABELS[tag]}</Badge>
      ))}
      {rest > 0 ? <Badge>+{rest}</Badge> : null}
    </div>
  );
}

/** Ticket status carries meaning, so the colour follows availability. */
export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const tone =
    status === 'sold-out'
      ? 'critical'
      : status === 'limited'
        ? 'caution'
        : status === 'free'
          ? 'positive'
          : 'neutral';

  return <Badge tone={tone}>{TICKET_STATUS_LABELS[status]}</Badge>;
}

/**
 * Rating display. Shows the count alongside the stars, because "5,0" from one
 * review and "4,3" from ninety are not comparable claims.
 */
export function RatingDisplay({
  rating,
  count,
  className,
}: {
  rating: number | null;
  count: number;
  className?: string;
}) {
  if (rating === null || count === 0) {
    return (
      <span className={cn('text-xs text-[var(--text-muted)]', className)}>
        Nog geen beoordelingen
      </span>
    );
  }

  return (
    <span
      className={cn('flex items-center gap-1.5 text-xs', className)}
      aria-label={`Gemiddeld ${rating.toFixed(1)} van 5, uit ${count} beoordelingen`}
    >
      <Star
        className="size-3.5 fill-[var(--color-gold)] text-[var(--color-gold)]"
        aria-hidden="true"
      />
      <span className="font-semibold tabular-nums">
        {rating.toFixed(1).replace('.', ',')}
      </span>
      <span className="text-[var(--text-muted)]">({count})</span>
    </span>
  );
}

/** Stand-in for a vendor logo: their initials on their own accent colour. */
export function VendorMark({
  initials,
  accent,
  className,
}: {
  initials: string;
  accent: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-11 shrink-0 place-items-center rounded-xl text-sm font-bold text-[var(--color-ink-950)]',
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 40%, white))`,
      }}
    >
      {initials}
    </span>
  );
}
