import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState, Panel } from '@/components/ui/primitives';
import { DeleteAnalysisButton } from '@/components/collection/delete-analysis-button';
import { requireUser } from '@/features/auth/session';
import { computeDataQuality } from '@/features/report/data-quality';
import { formatEuro, multiplyRange, sumRanges } from '@/features/report/totals';
import { getRepository } from '@/repositories';
import { formatDateTime } from '@/lib/utils';
import type { AnalysisStatus } from '@/types/domain';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Analyses',
  robots: { index: false, follow: false },
};

const STATUS_LABELS: Record<AnalysisStatus, string> = {
  created: 'Aangemaakt',
  uploading: 'Uploaden',
  processing: 'Wordt geanalyseerd',
  needs_review: 'Wacht op controle',
  completed: 'Afgerond',
  failed: 'Mislukt',
};

export default async function AnalysesPage() {
  const user = await requireUser();
  const repository = getRepository();
  const sessions = await repository.listSessionsForUser(user.id);

  // Each row needs a headline value and a quality score; both are derived from
  // the same stored data the full report uses, so the numbers cannot diverge.
  const rows = await Promise.all(
    sessions.map(async (session) => {
      const [cards, prices] = await Promise.all([
        repository.listDetectedCards(session.id),
        repository.listPriceEstimates(session.id),
      ]);
      const priceByCard = new Map(
        prices.map((price) => [price.detectedCardId, price]),
      );

      const confirmed = cards.filter(
        (card) =>
          card.reviewStatus === 'confirmed' ||
          card.reviewStatus === 'corrected',
      );

      const totalValue = sumRanges(
        confirmed.map((card) => {
          const price = priceByCard.get(card.id);
          return multiplyRange(
            {
              currency: 'EUR',
              low: price?.low ?? null,
              mid: price?.mid ?? null,
              high: price?.high ?? null,
            },
            card.quantity,
          );
        }),
      );

      const quality = computeDataQuality({
        cards: cards.map((card) => {
          const price = priceByCard.get(card.id);
          return {
            recognitionConfidence: card.recognitionConfidence,
            userConfirmed: card.userConfirmed,
            isUnknown: card.reviewStatus === 'unknown',
            priceSampleSize: price?.mid != null ? price.sampleSize : null,
            priceAgeDays: price?.lastUpdatedAt
              ? Math.max(
                  0,
                  (Date.now() - Date.parse(price.lastUpdatedAt)) / 86_400_000,
                )
              : null,
            relativePriceSpread:
              price?.mid != null &&
              price.low != null &&
              price.high != null &&
              price.mid > 0
                ? (price.high - price.low) / price.mid
                : null,
            imageQualityScore: null,
            variantKnown: card.variantHints.length > 0,
            languageKnown:
              card.detectedLanguage !== null &&
              card.detectedLanguage !== 'unknown',
          };
        }),
      });

      return { session, totalValue, quality, cardCount: cards.length };
    }),
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Je hebt nog geen analyses"
        description="Upload foto’s van je kaarten om je eerste collectieanalyse te maken."
        action={
          <Button asChild>
            <Link href="/analyze">Start een analyse</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map(({ session, totalValue, quality, cardCount }) => (
        <li key={session.id}>
          <Panel className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">
                  {formatDateTime(session.createdAt)}
                </p>
                <Badge
                  tone={
                    session.status === 'completed'
                      ? 'positive'
                      : session.status === 'failed'
                        ? 'critical'
                        : 'caution'
                  }
                >
                  {STATUS_LABELS[session.status]}
                </Badge>
              </div>

              <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--text-muted)]">
                <div className="flex gap-1.5">
                  <dt>Afbeeldingen:</dt>
                  <dd className="tabular-nums">{session.totalImages}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt>Kaarten:</dt>
                  <dd className="tabular-nums">{cardCount}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt>Middenwaarde:</dt>
                  <dd className="tabular-nums">
                    {totalValue.mid === null
                      ? 'Onvoldoende marktdata'
                      : formatEuro(totalValue.mid)}
                  </dd>
                </div>
                <div className="flex gap-1.5">
                  <dt>Datakwaliteit:</dt>
                  <dd className="tabular-nums">{quality.score}/100</dd>
                </div>
              </dl>
            </div>

            <div className="flex gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href={`/analyze/${session.id}/report`}>Rapport</Link>
              </Button>
              <DeleteAnalysisButton sessionId={session.id} />
            </div>
          </Panel>
        </li>
      ))}
    </ul>
  );
}
