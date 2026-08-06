import {
  AlertTriangle,
  BadgeCheck,
  CircleHelp,
  FlaskConical,
} from 'lucide-react';
import { Badge } from '@/components/ui/primitives';
import { formatLongDate } from '@/features/events/format';
import {
  SOURCE_KIND_LABELS,
  VERIFICATION_STALE_DAYS,
  verificationState,
  type EventProvenance,
} from '@/features/events/types';

/**
 * Where a listing's facts come from, and when they were last checked.
 *
 * This platform republishes information about other people's events, so a
 * listing without a visible source is an unverifiable claim. The same rule the
 * analysis side already follows for prices: show the source, show the date,
 * and say plainly when there is nothing to show.
 */

type Tone = 'neutral' | 'accent' | 'positive' | 'caution' | 'critical';

function presentation(provenance: EventProvenance): {
  tone: Tone;
  icon: typeof BadgeCheck;
  label: string;
  detail: string;
} {
  switch (verificationState(provenance)) {
    case 'demo':
      return {
        tone: 'caution',
        icon: FlaskConical,
        label: 'Voorbeeldgegevens',
        detail:
          'Deze beurs is verzonnen en dient alleen om het platform te tonen. Datum, locatie, standhouders en prijzen zijn niet echt.',
      };
    case 'fresh':
      return {
        tone: 'positive',
        icon: BadgeCheck,
        label: 'Gecontroleerd',
        detail: `Overgenomen van ${provenance.sourceName ?? 'de bron'} en voor het laatst gecontroleerd op ${formatLongDate(provenance.lastVerifiedAt ?? '')}.`,
      };
    case 'stale':
      return {
        tone: 'caution',
        icon: AlertTriangle,
        label: 'Controle verlopen',
        detail: `Laatst gecontroleerd op ${formatLongDate(provenance.lastVerifiedAt ?? '')}, meer dan ${VERIFICATION_STALE_DAYS} dagen geleden. Controleer datum en tijden bij de organisator.`,
      };
    default:
      return {
        tone: 'critical',
        icon: CircleHelp,
        label: 'Niet gecontroleerd',
        detail:
          'Deze gegevens zijn nog door niemand tegen de aankondiging van de organisator gelegd. Ga niet af op de datum zonder die zelf te controleren.',
      };
  }
}

/** Compact marker for a card in a list. */
export function ProvenanceBadge({
  provenance,
}: {
  provenance: EventProvenance;
}) {
  const state = verificationState(provenance);
  // A checked listing needs no badge: correct is the baseline, and a badge on
  // every card would make the ones that do need attention disappear.
  if (state === 'fresh') return null;

  const { tone, icon: Icon, label } = presentation(provenance);
  return (
    <Badge tone={tone}>
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}

/** Full disclosure block for the event detail page. */
export function ProvenanceNote({
  provenance,
}: {
  provenance: EventProvenance;
}) {
  const { tone, icon: Icon, label, detail } = presentation(provenance);
  const border =
    tone === 'positive'
      ? 'var(--color-positive)'
      : tone === 'critical'
        ? 'var(--color-critical)'
        : 'var(--color-caution)';

  return (
    <section
      aria-label="Herkomst van deze gegevens"
      className="rounded-xl border px-4 py-3.5"
      style={{
        borderColor: `color-mix(in oklab, ${border} 35%, transparent)`,
        backgroundColor: `color-mix(in oklab, ${border} 8%, transparent)`,
      }}
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Icon
          className="size-4 shrink-0"
          style={{ color: border }}
          aria-hidden="true"
        />
        {label}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">
        {detail}
      </p>

      <dl className="mt-3 grid gap-1 text-xs text-[var(--color-ink-500)] sm:grid-cols-2">
        <div className="flex gap-1.5">
          <dt className="font-medium">Herkomst:</dt>
          <dd>{SOURCE_KIND_LABELS[provenance.kind]}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="font-medium">Bron:</dt>
          <dd className="min-w-0 truncate">
            {provenance.sourceUrl ? (
              <a
                href={provenance.sourceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline underline-offset-2 hover:text-[var(--text-primary)]"
              >
                {provenance.sourceName ?? provenance.sourceUrl}
              </a>
            ) : (
              (provenance.sourceName ?? 'geen')
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
