import { InvalidStateTransitionError } from '@/lib/errors/app-error';
import type { AnalysisStatus } from '@/types/domain';

/**
 * Analysis state machine.
 *
 * Every transition the application performs goes through `assertTransition`,
 * so an out-of-order request (a double-submitted form, a stale tab) fails
 * loudly instead of corrupting a session.
 */

const ALLOWED: Record<AnalysisStatus, AnalysisStatus[]> = {
  created: ['uploading', 'failed'],
  uploading: ['uploading', 'processing', 'failed'],
  processing: ['needs_review', 'completed', 'failed'],
  needs_review: ['needs_review', 'processing', 'completed', 'failed'],
  completed: ['needs_review', 'processing'],
  failed: ['uploading', 'processing'],
};

export function canTransition(
  from: AnalysisStatus,
  to: AnalysisStatus,
): boolean {
  return (ALLOWED[from] ?? []).includes(to);
}

export function assertTransition(
  from: AnalysisStatus,
  to: AnalysisStatus,
): void {
  if (!canTransition(from, to)) {
    throw new InvalidStateTransitionError(from, to);
  }
}

/** Ordered pipeline steps shown on the processing screen. */
export const PIPELINE_STEPS = [
  'preparing_images',
  'locating_cards',
  'recognising_cards',
  'matching_catalog',
  'fetching_market_data',
  'building_report',
] as const;

export type PipelineStep = (typeof PIPELINE_STEPS)[number];

export const PIPELINE_STEP_LABELS: Record<PipelineStep, string> = {
  preparing_images: 'Afbeeldingen verwerken',
  locating_cards: 'Kaarten lokaliseren',
  recognising_cards: 'Kaarten herkennen',
  matching_catalog: 'Mogelijke matches zoeken',
  fetching_market_data: 'Marktinformatie ophalen',
  building_report: 'Rapport samenstellen',
};

export function isPipelineStep(value: string | null): value is PipelineStep {
  return (
    value !== null && (PIPELINE_STEPS as readonly string[]).includes(value)
  );
}

export function stepIndex(step: PipelineStep): number {
  return PIPELINE_STEPS.indexOf(step);
}

/**
 * Progress is derived from the actual persisted pipeline step - never from a
 * timer - so the bar can only move when real work has completed.
 */
export function progressPercent(
  status: AnalysisStatus,
  statusDetail: string | null,
): number {
  if (status === 'completed' || status === 'needs_review') return 100;
  if (status === 'created') return 0;
  if (status === 'uploading') return 5;
  if (!isPipelineStep(statusDetail)) return 10;
  const completed = stepIndex(statusDetail);
  return Math.round(10 + (completed / PIPELINE_STEPS.length) * 90);
}
