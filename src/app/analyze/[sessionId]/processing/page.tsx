import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ProcessingView } from '@/components/analysis/processing-view';
import { getRequester } from '@/features/auth/requester';
import { isAppError } from '@/lib/errors/app-error';
import { getSessionStatus } from '@/services/analysis-service';
import { progressPercent } from '@/services/analysis-state';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Analyse wordt uitgevoerd',
  robots: { index: false, follow: false },
};

export default async function ProcessingPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  let session;
  try {
    session = await getSessionStatus({
      sessionId,
      requester: await getRequester(),
    });
  } catch (error) {
    if (isAppError(error) && error.code === 'ANALYSIS_NOT_FOUND') notFound();
    throw error;
  }

  if (session.status === 'needs_review' || session.status === 'completed') {
    redirect(`/analyze/${sessionId}/review`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        We analyseren je foto’s
      </h1>
      <p className="mt-3 text-[var(--text-muted)]">
        Je kunt dit scherm open laten staan. Zodra de herkenning klaar is, ga je
        automatisch door naar de controlestap.
      </p>

      <div className="mt-8">
        <ProcessingView
          sessionId={sessionId}
          initial={{
            status: session.status,
            step: session.statusDetail,
            progress: progressPercent(session.status, session.statusDetail),
            detectedCards: session.detectedCardsCount,
            totalImages: session.totalImages,
            errorMessage: session.errorMessage,
          }}
        />
      </div>
    </div>
  );
}
