import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { DisclaimerNotice } from '@/components/layout/site-shell';
import {
  ReviewBoard,
  type ReviewCardData,
} from '@/components/review/review-board';
import { getRequester } from '@/features/auth/requester';
import { isAppError } from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';
import { getFileStorage } from '@/repositories/storage';
import { getReviewData } from '@/services/analysis-service';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Herkenning controleren',
  robots: { index: false, follow: false },
};

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  let data;
  try {
    data = await getReviewData({ sessionId, requester: await getRequester() });
  } catch (error) {
    if (isAppError(error) && error.code === 'ANALYSIS_NOT_FOUND') notFound();
    throw error;
  }

  // A session that is not ready for review belongs on the processing screen -
  // including a failed one, which is where the error and the retry action live.
  // Rendering an empty review board for a failed analysis would tell the user
  // "no cards found" when the truth is "the analysis never ran".
  if (
    data.session.status === 'created' ||
    data.session.status === 'uploading' ||
    data.session.status === 'processing' ||
    data.session.status === 'failed'
  ) {
    redirect(`/analyze/${sessionId}/processing`);
  }

  // Signed URLs are generated per render and are short-lived; they are never
  // stored on the client beyond the lifetime of the page.
  const storage = getFileStorage();
  const signedUrlByPath = new Map<string, string | null>();
  for (const entry of data.cards) {
    const path = entry.image?.storagePath;
    if (!path || signedUrlByPath.has(path)) continue;
    try {
      signedUrlByPath.set(path, await storage.createSignedUrl(path, 900));
    } catch (error) {
      logger.warn('Could not sign image URL', { error: String(error) });
      signedUrlByPath.set(path, null);
    }
  }

  const cards: ReviewCardData[] = data.cards.map((entry) => ({
    id: entry.card.id,
    imageUrl: entry.image
      ? (signedUrlByPath.get(entry.image.storagePath) ?? null)
      : null,
    region: entry.card.region,
    visibleName: entry.card.visibleName,
    visibleCardNumber: entry.card.visibleCardNumber,
    detectedLanguage: entry.card.detectedLanguage,
    variantHints: entry.card.variantHints,
    recognitionConfidence: entry.card.recognitionConfidence,
    reviewStatus: entry.card.reviewStatus,
    quantity: entry.card.quantity,
    conditionEstimate: entry.card.conditionEstimate,
    selected: entry.selectedCatalogCard,
    alternatives: entry.candidates
      .filter(
        (candidate) =>
          candidate.catalogCard !== null &&
          candidate.catalogCard.id !== entry.card.selectedCatalogCardId,
      )
      .map((candidate) => ({
        card: candidate.catalogCard!,
        score: candidate.candidate.matchScore,
        reasons: candidate.candidate.matchReasons.map(
          (reason) => reason.detail,
        ),
      })),
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <nav
        aria-label="Kruimelpad"
        className="mb-4 text-sm text-[var(--text-muted)]"
      >
        <Link href="/analyze" className="hover:text-[var(--text-primary)]">
          Upload
        </Link>
        <span aria-hidden="true"> › </span>
        <span aria-current="page" className="text-[var(--text-primary)]">
          Controleren
        </span>
        <span aria-hidden="true"> › </span>
        <span>Rapport</span>
      </nav>

      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Controleer de herkenning
      </h1>
      <p className="mt-3 max-w-2xl text-[var(--text-muted)]">
        We hebben {cards.length} kaart(en) gevonden. Niets wordt als definitief
        beschouwd voordat jij het hebt bevestigd of gecorrigeerd.
      </p>

      <div className="mt-8">
        <ReviewBoard sessionId={sessionId} cards={cards} />
      </div>

      <div className="mt-8">
        <DisclaimerNotice />
      </div>
    </div>
  );
}
