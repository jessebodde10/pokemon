'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCheck,
  CheckCircle2,
  HelpCircle,
  Loader2,
  RefreshCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RegionCrop, CardImage } from '@/components/ui/card-image';
import {
  Badge,
  ConfidenceMeter,
  EmptyState,
  Panel,
} from '@/components/ui/primitives';
import { CardSearchDialog } from '@/components/review/card-search-dialog';
import { CONDITION_LABELS } from '@/features/analysis/quality';
import {
  changeCardMatchAction,
  confirmCardAction,
  confirmCardsAction,
  finaliseAnalysisAction,
  markCardUnknownAction,
  reanalyseCardAction,
  removeCardAction,
  setCardQuantityAction,
} from '@/app/analyze/actions';
import type { CatalogCard, ReviewStatus } from '@/types/domain';

export type ReviewCardData = {
  id: string;
  imageUrl: string | null;
  region: { x: number; y: number; width: number; height: number };
  visibleName: string | null;
  visibleCardNumber: string | null;
  detectedLanguage: string | null;
  variantHints: string[];
  recognitionConfidence: number | null;
  reviewStatus: ReviewStatus;
  quantity: number;
  conditionEstimate: keyof typeof CONDITION_LABELS;
  selected: CatalogCard | null;
  alternatives: Array<{ card: CatalogCard; score: number; reasons: string[] }>;
};

/**
 * Confidence at or above which a preselected match is offered for bulk
 * confirmation. Below this the user should look at the card individually.
 */
const BULK_CONFIRM_THRESHOLD = 0.8;

const STATUS_META: Record<
  ReviewStatus,
  { label: string; tone: 'neutral' | 'positive' | 'caution' | 'critical' }
> = {
  pending: { label: 'Nog te controleren', tone: 'caution' },
  confirmed: { label: 'Bevestigd', tone: 'positive' },
  corrected: { label: 'Gecorrigeerd', tone: 'positive' },
  unknown: { label: 'Onbekende kaart', tone: 'neutral' },
  removed: { label: 'Verwijderd', tone: 'neutral' },
};

export function ReviewBoard({
  sessionId,
  cards: initialCards,
}: {
  sessionId: string;
  cards: ReviewCardData[];
}) {
  const router = useRouter();
  const [cards, setCards] = React.useState(initialCards);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [isFinalising, setIsFinalising] = React.useState(false);
  const [isBulkConfirming, setIsBulkConfirming] = React.useState(false);

  const reviewed = cards.filter(
    (card) => card.reviewStatus !== 'pending',
  ).length;
  const allReviewed = cards.length > 0 && reviewed === cards.length;

  function patchCard(id: string, patch: Partial<ReviewCardData>) {
    setCards((current) =>
      current.map((card) => (card.id === id ? { ...card, ...patch } : card)),
    );
  }

  async function run<T>(
    cardId: string,
    action: () => Promise<{ ok: boolean; message?: string } & T>,
    onSuccess: () => void,
    successMessage: string,
  ) {
    setBusyId(cardId);
    const result = await action();
    if (result.ok) {
      onSuccess();
      toast.success(successMessage);
    } else {
      toast.error(result.message ?? 'Actie mislukt');
    }
    setBusyId(null);
  }

  /**
   * Cards the user almost certainly wants to accept as-is: still pending, a
   * catalog match was preselected, and the model was confident about it.
   */
  const bulkCandidates = cards.filter(
    (card) =>
      card.reviewStatus === 'pending' &&
      card.selected !== null &&
      (card.recognitionConfidence ?? 0) >= BULK_CONFIRM_THRESHOLD,
  );

  async function handleBulkConfirm() {
    const ids = bulkCandidates.map((card) => card.id);
    if (ids.length === 0) return;

    setIsBulkConfirming(true);
    const result = await confirmCardsAction(ids);
    if (result.ok) {
      const confirmedIds = new Set(ids);
      setCards((current) =>
        current.map((card) =>
          confirmedIds.has(card.id)
            ? { ...card, reviewStatus: 'confirmed' as const }
            : card,
        ),
      );
      toast.success(
        result.data.confirmed === 1
          ? '1 kaart bevestigd'
          : `${result.data.confirmed} kaarten bevestigd`,
      );
    } else {
      toast.error(result.message);
    }
    setIsBulkConfirming(false);
  }

  async function handleFinalise() {
    setIsFinalising(true);
    const result = await finaliseAnalysisAction(sessionId);
    if (result.ok) {
      router.push(`/analyze/${sessionId}/report`);
    } else {
      toast.error(result.message);
      setIsFinalising(false);
    }
  }

  if (cards.length === 0) {
    return (
      <EmptyState
        title="Geen kaarten gevonden op deze foto’s"
        description="De herkenning heeft geen kaarten kunnen lokaliseren. Probeer een foto recht van boven, met voldoende licht en zonder reflecties."
        action={
          <Button onClick={() => router.push('/analyze')}>
            Nieuwe foto’s uploaden
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <Panel className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">
            {reviewed} van {cards.length} kaarten beoordeeld
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Alleen bevestigde en gecorrigeerde kaarten tellen mee in het
            rapporttotaal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {bulkCandidates.length > 0 ? (
            <Button
              variant="secondary"
              onClick={handleBulkConfirm}
              disabled={isBulkConfirming || isFinalising}
            >
              {isBulkConfirming ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Bevestigen…
                </>
              ) : (
                <>
                  <CheckCheck aria-hidden="true" />
                  {bulkCandidates.length === 1
                    ? 'Bevestig 1 zekere kaart'
                    : `Bevestig ${bulkCandidates.length} zekere kaarten`}
                </>
              )}
            </Button>
          ) : null}

          <Button onClick={handleFinalise} disabled={isFinalising}>
            {isFinalising ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Rapport samenstellen…
              </>
            ) : (
              'Bekijk collectierapport'
            )}
          </Button>
        </div>
      </Panel>

      {bulkCandidates.length > 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          {bulkCandidates.length === 1 ? 'Eén kaart is' : 'Deze kaarten zijn'}{' '}
          met minstens {Math.round(BULK_CONFIRM_THRESHOLD * 100)}% zekerheid
          herkend én aan een catalogus­kaart gekoppeld. Controleer ze gerust
          eerst — bevestigen kan ook per kaart.
        </p>
      ) : null}

      {!allReviewed ? (
        <p className="rounded-xl border border-[color-mix(in_oklab,var(--color-caution)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-caution)_10%,transparent)] px-4 py-3 text-sm text-[var(--color-caution)]">
          Je kunt het rapport altijd bekijken, maar kaarten die je nog niet hebt
          beoordeeld tellen niet mee in het totaal.
        </p>
      ) : null}

      <ul className="space-y-4">
        {cards.map((card) => {
          const isBusy = busyId === card.id;
          const isConfirmed =
            card.reviewStatus === 'confirmed' ||
            card.reviewStatus === 'corrected';
          const status = STATUS_META[card.reviewStatus];

          return (
            <li key={card.id}>
              <Panel className="grid gap-5 sm:grid-cols-[140px_minmax(0,1fr)]">
                <div className="max-w-[140px]">
                  <RegionCrop
                    src={card.imageUrl}
                    alt={
                      card.selected?.name ??
                      card.visibleName ??
                      'Gevonden kaart'
                    }
                    region={card.region}
                  />
                  <p className="mt-2 text-center text-[11px] text-[var(--text-muted)]">
                    Uitsnede uit je foto
                  </p>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold">
                        {card.selected?.name ??
                          card.visibleName ??
                          'Onbekende kaart'}
                      </h3>
                      <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                        {card.selected
                          ? `${card.selected.setName} · ${card.selected.cardNumber}`
                          : (card.visibleCardNumber ??
                            'Geen kaartnummer gelezen')}
                      </p>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>

                  <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                    <div className="flex justify-between gap-3 sm:block">
                      <dt className="text-[var(--text-muted)]">Variant</dt>
                      <dd>
                        {card.selected?.variant ??
                          (card.variantHints.length > 0
                            ? `${card.variantHints.join(', ')} (nog niet bevestigd)`
                            : 'Nog niet vastgesteld')}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 sm:block">
                      <dt className="text-[var(--text-muted)]">Taal</dt>
                      <dd>
                        {card.selected?.language ??
                          card.detectedLanguage ??
                          'Onbekend'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 sm:block">
                      <dt className="text-[var(--text-muted)]">Conditie</dt>
                      <dd>{CONDITION_LABELS[card.conditionEstimate]}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:block">
                      <dt className="text-[var(--text-muted)]">Aantal</dt>
                      <dd>
                        <label className="sr-only" htmlFor={`qty-${card.id}`}>
                          Aantal exemplaren
                        </label>
                        <input
                          id={`qty-${card.id}`}
                          type="number"
                          min={1}
                          max={99}
                          value={card.quantity}
                          disabled={isBusy}
                          onChange={(event) => {
                            const quantity = Number(event.target.value);
                            patchCard(card.id, { quantity });
                          }}
                          onBlur={async (event) => {
                            const quantity = Number(event.target.value);
                            if (!Number.isFinite(quantity)) return;
                            await setCardQuantityAction({
                              detectedCardId: card.id,
                              quantity,
                            });
                          }}
                          className="h-8 w-16 rounded-lg border border-[var(--border-subtle)] bg-[var(--color-ink-950)] px-2 text-sm"
                        />
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3">
                    <ConfidenceMeter value={card.recognitionConfidence} />
                  </div>

                  {card.alternatives.length > 0 ? (
                    <details className="mt-4 rounded-xl border border-[var(--border-subtle)] p-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        Alternatieve matches ({card.alternatives.length})
                      </summary>
                      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {card.alternatives.map((alternative) => (
                          <li key={alternative.card.id}>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                run(
                                  card.id,
                                  () =>
                                    changeCardMatchAction({
                                      detectedCardId: card.id,
                                      catalogCardId: alternative.card.id,
                                    }),
                                  () =>
                                    patchCard(card.id, {
                                      selected: alternative.card,
                                      reviewStatus: 'corrected',
                                    }),
                                  'Match gewijzigd',
                                )
                              }
                              className="flex w-full items-center gap-3 rounded-lg border border-[var(--border-subtle)] p-2 text-left hover:border-[var(--color-holo-cyan)] disabled:opacity-50"
                            >
                              <div className="w-10 shrink-0">
                                <CardImage
                                  src={alternative.card.imageSmallUrl}
                                  alt=""
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium">
                                  {alternative.card.name}
                                </p>
                                <p className="truncate text-[11px] text-[var(--text-muted)]">
                                  {alternative.card.setName} ·{' '}
                                  {alternative.card.cardNumber}
                                </p>
                                <p className="text-[11px] text-[var(--text-muted)]">
                                  Matchscore{' '}
                                  {Math.round(alternative.score * 100)}%
                                </p>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {/* Once confirmed the action is done. An enabled
                        "Bevestigen" here invites repeat clicks that appear to
                        do nothing. */}
                    <Button
                      size="sm"
                      variant={isConfirmed ? 'outline' : 'primary'}
                      disabled={isBusy || !card.selected || isConfirmed}
                      onClick={() =>
                        run(
                          card.id,
                          () =>
                            confirmCardAction({
                              detectedCardId: card.id,
                              quantity: card.quantity,
                            }),
                          () =>
                            patchCard(card.id, { reviewStatus: 'confirmed' }),
                          'Kaart bevestigd',
                        )
                      }
                    >
                      {isConfirmed ? (
                        <>
                          <CheckCheck aria-hidden="true" />
                          Bevestigd
                        </>
                      ) : (
                        <>
                          <CheckCircle2 aria-hidden="true" />
                          Bevestigen
                        </>
                      )}
                    </Button>

                    <CardSearchDialog
                      trigger={
                        <Button size="sm" variant="secondary" disabled={isBusy}>
                          <Search aria-hidden="true" />
                          Andere kaart zoeken
                        </Button>
                      }
                      onSelect={(chosen) =>
                        run(
                          card.id,
                          () =>
                            changeCardMatchAction({
                              detectedCardId: card.id,
                              catalogCardId: chosen.id,
                            }),
                          () =>
                            patchCard(card.id, {
                              selected: chosen,
                              reviewStatus: 'corrected',
                            }),
                          'Match gewijzigd',
                        )
                      }
                    />

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() =>
                        run(
                          card.id,
                          () => markCardUnknownAction(card.id),
                          () =>
                            patchCard(card.id, {
                              reviewStatus: 'unknown',
                              selected: null,
                            }),
                          'Gemarkeerd als onbekend',
                        )
                      }
                    >
                      <HelpCircle aria-hidden="true" />
                      Onbekende kaart
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() =>
                        run(
                          card.id,
                          () => reanalyseCardAction(card.id),
                          () => router.refresh(),
                          'Opnieuw geanalyseerd',
                        )
                      }
                    >
                      <RefreshCcw aria-hidden="true" />
                      Opnieuw analyseren
                    </Button>

                    <Button
                      size="sm"
                      variant="danger"
                      disabled={isBusy}
                      onClick={() =>
                        run(
                          card.id,
                          () => removeCardAction(card.id),
                          () =>
                            setCards((current) =>
                              current.filter((entry) => entry.id !== card.id),
                            ),
                          'Kaart verwijderd',
                        )
                      }
                    >
                      <Trash2 aria-hidden="true" />
                      Verwijderen
                    </Button>
                  </div>

                  {!card.selected && card.reviewStatus !== 'unknown' ? (
                    <p className="mt-3 text-sm text-[var(--color-caution)]">
                      Nog geen kaart gekozen. Zoek de juiste kaart of markeer
                      hem als onbekend.
                    </p>
                  ) : null}
                </div>
              </Panel>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
