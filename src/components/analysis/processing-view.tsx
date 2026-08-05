'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/primitives';
import { retryAnalysisAction } from '@/app/analyze/actions';
import {
  PIPELINE_STEPS,
  PIPELINE_STEP_LABELS,
  type PipelineStep,
} from '@/services/analysis-state';
import type { AnalysisStatus } from '@/types/domain';

type StatusPayload = {
  status: AnalysisStatus;
  step: string | null;
  progress: number;
  detectedCards: number;
  totalImages: number;
  errorMessage: string | null;
};

const POLL_INTERVAL_MS = 1200;

/**
 * Progress is read from the backend on every poll. There is no local timer or
 * simulated animation: if the backend does not advance, neither does the bar.
 */
export function ProcessingView({
  sessionId,
  initial,
}: {
  sessionId: string;
  initial: StatusPayload;
}) {
  const router = useRouter();
  const [state, setState] = React.useState<StatusPayload>(initial);
  const [pollError, setPollError] = React.useState<string | null>(null);
  const [isRetrying, setIsRetrying] = React.useState(false);

  React.useEffect(() => {
    if (state.status === 'needs_review' || state.status === 'completed') {
      router.replace(`/analyze/${sessionId}/review`);
      return;
    }
    if (state.status === 'failed') return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/analysis/${sessionId}/status`, {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('status request failed');
        const payload = (await response.json()) as StatusPayload;
        if (!cancelled) {
          setState(payload);
          setPollError(null);
        }
      } catch {
        if (!cancelled) {
          setPollError(
            'We konden de status even niet ophalen. We blijven het proberen.',
          );
          // Force a re-run of the effect so polling continues.
          setState((current) => ({ ...current }));
        }
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state, sessionId, router]);

  const currentIndex = PIPELINE_STEPS.indexOf(state.step as PipelineStep);

  async function handleRetry() {
    setIsRetrying(true);
    const result = await retryAnalysisAction(sessionId);
    if (result.ok) {
      setState((current) => ({
        ...current,
        status: 'processing',
        step: 'preparing_images',
        progress: 10,
        errorMessage: null,
      }));
    }
    setIsRetrying(false);
  }

  if (state.status === 'failed') {
    return (
      <Panel>
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0 text-[var(--color-critical)]"
            aria-hidden="true"
          />
          <div>
            <h2 className="font-semibold">De analyse is niet afgerond</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {state.errorMessage ??
                'Er ging iets mis tijdens het verwerken van je foto’s.'}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button onClick={handleRetry} disabled={isRetrying}>
                {isRetrying ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    Opnieuw starten…
                  </>
                ) : (
                  'Opnieuw proberen'
                )}
              </Button>
              <Button variant="outline" onClick={() => router.push('/analyze')}>
                Nieuwe foto’s uploaden
              </Button>
            </div>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      <Panel>
        <div
          role="progressbar"
          aria-valuenow={state.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Voortgang van de analyse"
          className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-ink-800)]"
        >
          <div
            className="h-full rounded-full bg-[var(--color-holo-cyan)] transition-[width] duration-500"
            style={{ width: `${state.progress}%` }}
          />
        </div>

        <p aria-live="polite" className="mt-4 text-sm text-[var(--text-muted)]">
          {state.progress}% · {state.totalImages} afbeelding(en) in behandeling
        </p>

        <ol className="mt-6 space-y-3">
          {PIPELINE_STEPS.map((step, index) => {
            const isDone = currentIndex > index;
            const isActive = currentIndex === index;
            return (
              <li key={step} className="flex items-center gap-3">
                <span
                  className={
                    isDone
                      ? 'grid size-6 place-items-center rounded-full bg-[var(--color-positive)] text-[var(--color-ink-950)]'
                      : isActive
                        ? 'grid size-6 place-items-center rounded-full bg-[var(--color-holo-cyan)] text-[var(--color-ink-950)]'
                        : 'grid size-6 place-items-center rounded-full border border-[var(--border-subtle)] text-[11px] text-[var(--color-ink-500)]'
                  }
                  aria-hidden="true"
                >
                  {isDone ? (
                    <Check className="size-3.5" />
                  ) : isActive ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={
                    isDone || isActive
                      ? 'text-sm font-medium'
                      : 'text-sm text-[var(--color-ink-500)]'
                  }
                >
                  {PIPELINE_STEP_LABELS[step]}
                  {isDone ? <span className="sr-only"> — afgerond</span> : null}
                  {isActive ? <span className="sr-only"> — bezig</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      </Panel>

      {pollError ? (
        <p className="text-sm text-[var(--color-caution)]" role="status">
          {pollError}
        </p>
      ) : null}
    </div>
  );
}
