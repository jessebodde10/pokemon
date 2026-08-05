import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/primitives';
import { DisclaimerNotice } from '@/components/layout/site-shell';
import { CardTable } from '@/components/report/card-table';
import { ReportActions } from '@/components/report/report-actions';
import {
  AttentionSection,
  NarrativeSection,
  ReportSectionHeading,
  ReportSummarySection,
  TopCardsSection,
} from '@/components/report/report-sections';
import { getRequester } from '@/features/auth/requester';
import { getCurrentUser } from '@/features/auth/session';
import { isAppError } from '@/lib/errors/app-error';
import { generateCollectionReport } from '@/services/report-service';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Collectierapport',
  robots: { index: false, follow: false },
};

export default async function ReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const user = await getCurrentUser();

  let report;
  try {
    report = await generateCollectionReport(sessionId, await getRequester());
  } catch (error) {
    if (isAppError(error) && error.code === 'ANALYSIS_NOT_FOUND') notFound();
    throw error;
  }

  if (report.status === 'processing' || report.status === 'uploading') {
    redirect(`/analyze/${sessionId}/processing`);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <nav aria-label="Kruimelpad" className="label-mono mb-4">
            <Link href="/analyze" className="hover:text-[var(--text-primary)]">
              Upload
            </Link>
            <span aria-hidden="true"> / </span>
            <Link
              href={`/analyze/${sessionId}/review`}
              className="hover:text-[var(--text-primary)]"
            >
              Controleren
            </Link>
            <span aria-hidden="true"> / </span>
            <span aria-current="page" className="text-[var(--color-holo-cyan)]">
              Rapport
            </span>
          </nav>
          <h1 className="text-[clamp(2.1rem,5vw,3.2rem)] leading-[1] font-extrabold tracking-[-0.04em]">
            Je collectieanalyse
          </h1>
        </div>

        <ReportActions sessionId={sessionId} isLoggedIn={Boolean(user)} />
      </div>

      <div className="mt-12 space-y-16 sm:space-y-20">
        <ReportSummarySection report={report} />
        <NarrativeSection report={report} />
        <TopCardsSection cards={report.topCards} />
        <AttentionSection cards={report.attentionCards} />

        <section aria-labelledby="lijst-titel">
          <ReportSectionHeading
            id="lijst-titel"
            eyebrow={`${report.allCards.length} kaart(en)`}
            title="Volledige kaartenlijst"
            description="Sorteer en filter op status, set, waarde of naam."
          />
          <CardTable cards={report.allCards} />
        </section>

        {report.unknownCards.length > 0 ? (
          <section aria-labelledby="onbekend-titel">
            <ReportSectionHeading
              id="onbekend-titel"
              eyebrow={`${report.unknownCards.length} niet vastgesteld`}
              title="Onbekende kaarten"
              description="Deze kaarten konden niet worden vastgesteld en tellen niet mee in het totaal."
            />
            <Panel>
              <ul className="space-y-2 text-sm text-[var(--text-muted)]">
                {report.unknownCards.map((card) => (
                  <li key={card.detectedCardId}>
                    {card.name}
                    {card.cardNumber ? ` · ${card.cardNumber}` : ''} — meer
                    foto’s nodig voor een betere beoordeling.
                  </li>
                ))}
              </ul>
            </Panel>
          </section>
        ) : null}

        {!user ? (
          <section
            aria-labelledby="cta-titel"
            className="relative overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] px-6 py-12 text-center sm:px-10"
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 opacity-25"
              style={{
                background:
                  'radial-gradient(600px circle at 50% 120%, var(--color-holo-violet), transparent 65%)',
              }}
            />
            <h2
              id="cta-titel"
              className="text-[clamp(1.4rem,3vw,2rem)] leading-tight font-bold"
            >
              Bewaar deze analyse en bouw je digitale collectie op
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-[var(--text-muted)]">
              Als gast is deze analyse tijdelijk. Met een gratis account bewaar
              je je analyses, correcties en collectie.
            </p>
            <Button asChild size="lg" className="mt-7">
              <Link href="/login">Gratis collectie aanmaken</Link>
            </Button>
          </section>
        ) : null}

        <DisclaimerNotice />
      </div>
    </div>
  );
}
