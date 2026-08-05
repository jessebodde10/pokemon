import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState, Panel, SectionHeading } from '@/components/ui/primitives';
import { ValueRangeBlock } from '@/components/report/report-sections';
import { requireUser } from '@/features/auth/session';
import { getRepository } from '@/repositories';
import { getCollectionOverview } from '@/services/collection-service';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Overzicht',
  robots: { index: false, follow: false },
};

export default async function DashboardOverviewPage() {
  const user = await requireUser();
  const [sessions, collection] = await Promise.all([
    getRepository().listSessionsForUser(user.id),
    getCollectionOverview(user.id),
  ]);

  const recent = sessions.slice(0, 3);

  return (
    <div className="space-y-10">
      <section aria-labelledby="collectie-titel">
        <SectionHeading
          id="collectie-titel"
          title="Je collectie"
          description="Indicatieve bandbreedte over alle opgeslagen kaarten."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/collection">Naar collectie</Link>
            </Button>
          }
        />

        {collection.uniqueCards === 0 ? (
          <EmptyState
            title="Nog geen kaarten in je collectie"
            description="Voer een analyse uit en voeg de bevestigde kaarten toe aan je collectie."
            action={
              <Button asChild>
                <Link href="/analyze">Analyseer kaarten</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Panel>
              <ValueRangeBlock
                range={collection.totalValue}
                label="Totale indicatieve waarde"
              />
            </Panel>
            <Panel>
              <p className="text-xs text-[var(--text-muted)]">Unieke kaarten</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {collection.uniqueCards}
              </p>
            </Panel>
            <Panel>
              <p className="text-xs text-[var(--text-muted)]">Totaal aantal</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {collection.totalCards}
              </p>
            </Panel>
            <Panel>
              <p className="text-xs text-[var(--text-muted)]">
                Zonder prijsdata
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {collection.missingPriceData}
              </p>
            </Panel>
          </div>
        )}
      </section>

      <section aria-labelledby="recent-titel">
        <SectionHeading
          id="recent-titel"
          title="Recente analyses"
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/analyses">Alle analyses</Link>
            </Button>
          }
        />

        {recent.length === 0 ? (
          <EmptyState
            title="Nog geen analyses"
            description="Upload foto’s van je kaarten om je eerste collectieanalyse te maken."
            action={
              <Button asChild>
                <Link href="/analyze">Start een analyse</Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {recent.map((session) => (
              <li key={session.id}>
                <Panel className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {formatDateTime(session.createdAt)}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {session.totalImages} afbeelding(en) ·{' '}
                      {session.detectedCardsCount} kaart(en) ·{' '}
                      {session.confirmedCardsCount} bevestigd
                    </p>
                  </div>
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/analyze/${session.id}/report`}>
                      Bekijk rapport
                    </Link>
                  </Button>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
