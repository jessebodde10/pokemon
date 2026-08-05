import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CardImage } from '@/components/ui/card-image';
import { EmptyState, Panel, SectionHeading } from '@/components/ui/primitives';
import { ValueRangeBlock } from '@/components/report/report-sections';
import { CONDITION_LABELS } from '@/features/analysis/quality';
import { formatEuro } from '@/features/report/totals';
import { requireUser } from '@/features/auth/session';
import { getCollectionOverview } from '@/services/collection-service';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Collectie',
  robots: { index: false, follow: false },
};

export default async function CollectionPage() {
  const user = await requireUser();
  const overview = await getCollectionOverview(user.id);

  if (overview.uniqueCards === 0) {
    return (
      <EmptyState
        title="Je collectie is nog leeg"
        description="Bevestig kaarten in een analyse en voeg ze daarna toe aan je collectie."
        action={
          <Button asChild>
            <Link href="/analyze">Analyseer kaarten</Link>
          </Button>
        }
      />
    );
  }

  const maxSetValue = Math.max(
    ...overview.bySet.map((entry) => entry.value.mid ?? 0),
    1,
  );

  return (
    <div className="space-y-10">
      <section aria-labelledby="totalen-titel">
        <SectionHeading
          id="totalen-titel"
          title="Totalen"
          description={`Laatst bijgewerkt: ${formatDate(overview.lastUpdatedAt)}. Alle bedragen zijn indicatief.`}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Panel>
            <ValueRangeBlock
              range={overview.totalValue}
              label="Totale indicatieve bandbreedte"
            />
          </Panel>
          <Panel>
            <p className="text-xs text-[var(--text-muted)]">Unieke kaarten</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {overview.uniqueCards}
            </p>
          </Panel>
          <Panel>
            <p className="text-xs text-[var(--text-muted)]">Totaal aantal</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {overview.totalCards}
            </p>
          </Panel>
          <Panel>
            <p className="text-xs text-[var(--text-muted)]">
              Ontbrekende prijsdata
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {overview.missingPriceData}
            </p>
          </Panel>
        </div>
      </section>

      <section aria-labelledby="sets-titel">
        <SectionHeading
          id="sets-titel"
          title="Verdeling per set"
          description="Aantal kaarten en indicatieve middenwaarde per set."
        />
        <Panel>
          <ul className="space-y-3">
            {overview.bySet.map((entry) => (
              <li key={entry.setName}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">{entry.setName}</span>
                  <span className="shrink-0 text-[var(--text-muted)] tabular-nums">
                    {entry.cards} kaart(en) ·{' '}
                    {entry.value.mid === null
                      ? 'geen prijsdata'
                      : formatEuro(entry.value.mid)}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-ink-800)]"
                  role="img"
                  aria-label={`${entry.setName}: ${entry.cards} kaarten`}
                >
                  <div
                    className="h-full rounded-full bg-[var(--color-gold)]"
                    style={{
                      width: `${Math.max(4, ((entry.value.mid ?? 0) / maxSetValue) * 100)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      <section aria-labelledby="top-titel">
        <SectionHeading
          id="top-titel"
          title="Topkaarten"
          description="Gesorteerd op indicatieve middenwaarde."
        />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {overview.topCards.map((entry) => (
            <li key={entry.item.id}>
              <Panel className="flex gap-3">
                <div className="w-16 shrink-0">
                  <CardImage
                    src={entry.catalogCard?.imageSmallUrl ?? null}
                    alt={entry.catalogCard?.name ?? 'Kaart'}
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {entry.catalogCard?.name ?? 'Onbekende kaart'}
                  </p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {entry.catalogCard?.setName ?? '—'} ·{' '}
                    {entry.catalogCard?.cardNumber ?? '—'} ·{' '}
                    {entry.item.quantity}×
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {CONDITION_LABELS[entry.item.conditionEstimate]}
                  </p>
                  <div className="mt-2">
                    <ValueRangeBlock range={entry.lineValue} size="sm" />
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--color-ink-500)]">
                    Bron: {entry.priceSourceName ?? 'geen bron'}
                  </p>
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
