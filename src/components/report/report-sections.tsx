import { AlertTriangle, Info, Sparkles } from 'lucide-react';
import { CardImage } from '@/components/ui/card-image';
import { Badge, ConfidenceMeter, Panel } from '@/components/ui/primitives';
import { CONDITION_LABELS } from '@/features/analysis/quality';
import { DATA_QUALITY_BAND_LABELS } from '@/features/report/data-quality';
import { formatEuro } from '@/features/report/totals';
import { formatDate, relativeDays } from '@/lib/utils';
import type { CollectionReport, ReportCard, ValueRange } from '@/types/report';

/**
 * Report presentation.
 *
 * Every monetary figure goes through `ValueRangeBlock` or `ValueRail`, which
 * are the only components allowed to render an amount - and both always show
 * the full band or an explicit "no data" message, never a bare single number.
 *
 * Gold is reserved for amounts. Anything that is not money (data quality,
 * recognition confidence) uses cyan, so a gold number on screen always means
 * "estimated value".
 */

/**
 * Label for the three headline value boxes.
 *
 * Deliberately not `.label-mono`: that utility uppercases, and "LAGE SCHATTING
 * / MEEST WAARSCHIJNLIJK / HOGE SCHATTING" at 10px is measurably harder to
 * scan than sentence case. Uppercase micro-labels are right for eyebrows and
 * table headers, not for the primary legend of the number people came for.
 */
const VALUE_LABEL =
  'font-mono text-[10px] font-medium tracking-wide text-[var(--text-muted)]';

/** Section header, at the same display scale as the landing page. */
export function ReportSectionHeading({
  id,
  eyebrow,
  title,
  description,
  action,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="holo-rule mb-8" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono">{eyebrow}</p>
          <h2
            id={id}
            className="mt-2 text-[clamp(1.6rem,3.2vw,2.35rem)] leading-[1.05] font-bold"
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-xl text-sm text-[var(--text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
    </div>
  );
}

/**
 * The signature element of this screen: the band drawn as a rail, with the
 * most-likely value marked inside it. You can see at a glance how wide the
 * uncertainty is and whether the middle sits low or high within it - something
 * three separate numbers never communicate.
 */
export function ValueRail({ range }: { range: ValueRange }) {
  if (range.low === null || range.high === null || range.mid === null) {
    return null;
  }

  const span = range.high - range.low;
  const position = span <= 0 ? 50 : ((range.mid - range.low) / span) * 100;
  const clamped = Math.min(94, Math.max(6, position));

  return (
    <div className="mt-5">
      {/* The track is the band; the marker is the most likely value. The track
          stays deliberately quiet - a fully saturated fill would encode nothing
          (it is always 100% wide) while drowning out the one thing here that
          does carry information: where the marker sits. */}
      <div className="relative h-1.5 rounded-full bg-[color-mix(in_oklab,var(--color-gold)_22%,var(--color-ink-800))]">
        <span
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--color-ink-950)] bg-[var(--color-gold)] shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-gold)_25%,transparent)]"
          style={{ left: `${clamped}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-[var(--text-muted)] tabular-nums">
        <span>{formatEuro(range.low)}</span>
        <span>{formatEuro(range.high)}</span>
      </div>
    </div>
  );
}

export function ValueRangeBlock({
  range,
  size = 'md',
  label,
}: {
  range: ValueRange;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}) {
  if (range.mid === null) {
    return (
      <p className="font-mono text-sm text-[var(--color-caution)]">
        Onvoldoende marktdata
      </p>
    );
  }

  const midClass =
    size === 'lg'
      ? 'text-3xl sm:text-4xl'
      : size === 'sm'
        ? 'text-base'
        : 'text-xl';

  return (
    <div>
      {label ? <p className="label-mono">{label}</p> : null}
      <p
        className={`font-mono font-semibold text-[var(--color-gold)] tabular-nums ${midClass} ${label ? 'mt-1' : ''}`}
      >
        {formatEuro(range.mid)}
      </p>
      <p className="mt-1 font-mono text-[11px] text-[var(--text-muted)] tabular-nums">
        Bandbreedte {formatEuro(range.low)} – {formatEuro(range.high)}
      </p>
    </div>
  );
}

export function ReportSummarySection({ report }: { report: CollectionReport }) {
  const { summary, narrative } = report;

  return (
    <section aria-labelledby="samenvatting-titel">
      <ReportSectionHeading
        id="samenvatting-titel"
        eyebrow="Samenvatting"
        title={narrative.headline}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel className="flex flex-col">
          <p className="label-mono">
            Totaal · {summary.totalConfirmed} bevestigde kaart(en)
          </p>

          {summary.totalValue.mid === null ? (
            <p className="mt-4 font-mono text-lg font-semibold text-[var(--color-caution)]">
              Onvoldoende marktdata voor een totaalschatting
            </p>
          ) : (
            <>
              {/* Tightened tracking: the nl-NL format puts a space after the
                  euro sign, which a monospace face renders full-width and
                  makes the headline number read as two separate things. */}
              <p className="mt-3 font-mono text-[clamp(2.4rem,6vw,3.5rem)] leading-none font-semibold tracking-[-0.05em] text-[var(--color-gold)] tabular-nums">
                {formatEuro(summary.totalValue.mid)}
              </p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Meest waarschijnlijke schatting
              </p>

              <ValueRail range={summary.totalValue} />

              <dl className="mt-6 grid grid-cols-3 gap-3">
                <div className="rounded-[var(--radius-card)] bg-[var(--color-ink-950)] p-3">
                  <dt className={VALUE_LABEL}>Lage schatting</dt>
                  <dd className="mt-1.5 font-mono text-base font-semibold tabular-nums sm:text-lg">
                    {formatEuro(summary.totalValue.low)}
                  </dd>
                </div>
                <div
                  className="rounded-[var(--radius-card)] p-3"
                  style={{
                    background:
                      'color-mix(in oklab, var(--color-gold) 12%, var(--color-ink-950))',
                  }}
                >
                  <dt
                    className={`${VALUE_LABEL} text-[var(--color-gold-soft)]`}
                  >
                    Meest waarschijnlijk
                  </dt>
                  <dd className="mt-1.5 font-mono text-base font-semibold text-[var(--color-gold)] tabular-nums sm:text-lg">
                    {formatEuro(summary.totalValue.mid)}
                  </dd>
                </div>
                <div className="rounded-[var(--radius-card)] bg-[var(--color-ink-950)] p-3">
                  <dt className={VALUE_LABEL}>Hoge schatting</dt>
                  <dd className="mt-1.5 font-mono text-base font-semibold tabular-nums sm:text-lg">
                    {formatEuro(summary.totalValue.high)}
                  </dd>
                </div>
              </dl>
            </>
          )}

          <p className="mt-6 text-sm leading-relaxed text-[var(--text-muted)]">
            {narrative.summary}
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--border-subtle)] pt-5 sm:grid-cols-4">
            <Stat label="Herkend" value={summary.totalDetected} />
            <Stat label="Bevestigd" value={summary.totalConfirmed} />
            <Stat label="Onbekend" value={summary.totalUnknown} />
            <Stat
              label="Zonder prijsdata"
              value={summary.cardsWithoutPriceData}
            />
          </dl>

          <p className="mt-5 font-mono text-[11px] leading-relaxed text-[var(--color-ink-500)]">
            Prijsindicatie op basis van ongeslabde exemplaren in vergelijkbare,
            niet professioneel beoordeelde staat. Laatst bijgewerkt:{' '}
            {formatDate(summary.lastUpdatedAt)}.
          </p>
        </Panel>

        <DataQualityPanel report={report} />
      </div>

      {report.warnings.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {report.warnings.map((warning) => (
            <li
              key={warning}
              className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-[color-mix(in_oklab,var(--color-caution)_32%,transparent)] bg-[color-mix(in_oklab,var(--color-caution)_9%,transparent)] px-4 py-3 text-sm text-[var(--color-caution)]"
            >
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="label-mono !text-[10px]">{label}</dt>
      <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}

export function DataQualityPanel({ report }: { report: CollectionReport }) {
  const { dataQuality } = report;
  const tone =
    dataQuality.band === 'high'
      ? 'positive'
      : dataQuality.band === 'medium'
        ? 'caution'
        : 'critical';

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold">Datakwaliteit</h3>
        <Badge tone={tone}>
          <span className="font-mono tabular-nums">
            {dataQuality.score}/100
          </span>
          <span aria-hidden="true">·</span>
          {DATA_QUALITY_BAND_LABELS[dataQuality.band]}
        </Badge>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
        {dataQuality.explanation}
      </p>

      <ul className="mt-6 space-y-3.5">
        {dataQuality.factors.map((factor) => (
          <li key={factor.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-medium">{factor.label}</span>
              <span className="font-mono text-[11px] text-[var(--text-muted)] tabular-nums">
                {Math.round(factor.score * 100)}%
                <span className="text-[var(--color-ink-600)]">
                  {' '}
                  · w{Math.round(factor.weight * 100)}
                </span>
              </span>
            </div>
            <div
              className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--color-ink-800)]"
              role="img"
              aria-label={`${factor.label}: ${Math.round(factor.score * 100)} procent`}
            >
              {/* Cyan, not gold: this is a quality score, not an amount. */}
              <div
                className="h-full rounded-full bg-[var(--color-holo-cyan)]"
                style={{ width: `${Math.round(factor.score * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] leading-snug text-[var(--color-ink-500)]">
              {factor.detail}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-6 border-t border-[var(--border-subtle)] pt-4 font-mono text-[11px] leading-relaxed text-[var(--color-ink-500)]">
        Deze score wordt berekend met vaste regels, niet door een taalmodel.
      </p>
    </Panel>
  );
}

export function TopCardsSection({ cards }: { cards: ReportCard[] }) {
  if (cards.length === 0) {
    return (
      <section aria-labelledby="topkaarten-titel">
        <ReportSectionHeading
          id="topkaarten-titel"
          eyebrow="Hoogste schattingen"
          title="Topkaarten"
          description="Zodra je kaarten bevestigt waarvoor marktdata beschikbaar is, verschijnen ze hier."
        />
        <Panel>
          <p className="text-sm text-[var(--text-muted)]">
            Nog geen bevestigde kaarten met bruikbare prijsdata.
          </p>
        </Panel>
      </section>
    );
  }

  return (
    <section aria-labelledby="topkaarten-titel">
      <ReportSectionHeading
        id="topkaarten-titel"
        eyebrow={`Hoogste schattingen · ${cards.length}`}
        title="Topkaarten"
        description="Maximaal tien bevestigde kaarten, gesorteerd op geschatte middenwaarde."
      />

      <ul className="grid gap-4 sm:grid-cols-2">
        {cards.map((card, index) => (
          <li key={card.detectedCardId}>
            <Panel className="flex h-full gap-4">
              <div className="w-[72px] shrink-0">
                <CardImage src={card.imageUrl} alt={card.name} />
                <p className="mt-1.5 text-center font-mono text-[10px] text-[var(--color-ink-600)]">
                  {String(index + 1).padStart(2, '0')}
                </p>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="truncate font-bold">{card.name}</h3>
                <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--text-muted)]">
                  {card.setName ?? 'Onbekende set'} ·{' '}
                  {card.cardNumber ?? 'geen nummer'}
                  {card.quantity > 1 ? ` · ${card.quantity}×` : ''}
                </p>

                <div className="mt-3">
                  <ValueRangeBlock range={card.lineValue} size="sm" />
                </div>

                <dl className="mt-3 space-y-1 border-t border-[var(--border-subtle)] pt-3 font-mono text-[11px] text-[var(--text-muted)]">
                  <div className="flex justify-between gap-2">
                    <dt>Prijsbron</dt>
                    <dd className="truncate text-right">
                      {card.priceSourceName ?? 'Geen bron'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Waarnemingen</dt>
                    <dd className="tabular-nums">
                      {card.priceSampleSize > 0
                        ? card.priceSampleSize
                        : 'niet gepubliceerd'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Bijgewerkt</dt>
                    <dd>{relativeDays(card.priceUpdatedAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Conditie</dt>
                    <dd className="text-right">
                      {CONDITION_LABELS[card.conditionEstimate]}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3">
                  <ConfidenceMeter value={card.recognitionConfidence} />
                </div>

                {card.priceWarnings.length > 0 ? (
                  <ul className="mt-2.5 space-y-1">
                    {card.priceWarnings.map((warning) => (
                      <li
                        key={warning}
                        className="text-[11px] leading-snug text-[var(--color-caution)]"
                      >
                        {warning}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Panel>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AttentionSection({ cards }: { cards: ReportCard[] }) {
  return (
    <section aria-labelledby="aandacht-titel">
      <ReportSectionHeading
        id="aandacht-titel"
        eyebrow={
          cards.length > 0 ? `${cards.length} kaart(en)` : 'Niets opvallends'
        }
        title="Verdient extra aandacht"
        description="Observaties over de data, geen koop- of verkoopadvies."
      />

      {cards.length === 0 ? (
        <Panel>
          <p className="text-sm text-[var(--text-muted)]">
            Er zijn op dit moment geen kaarten die opvallen in de data.
          </p>
        </Panel>
      ) : (
        <ul className="space-y-3">
          {cards.map((card) => (
            <li key={card.detectedCardId}>
              <Panel className="flex gap-4 border-l-2 !border-l-[color-mix(in_oklab,var(--color-caution)_55%,transparent)]">
                <div className="w-14 shrink-0">
                  <CardImage src={card.imageUrl} alt={card.name} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3 className="font-bold">{card.name}</h3>
                    <span className="font-mono text-[11px] text-[var(--text-muted)]">
                      {card.setName ?? 'Onbekende set'} ·{' '}
                      {card.cardNumber ?? 'geen nummer'}
                    </span>
                  </div>

                  <ul className="mt-3 space-y-2">
                    {card.attentionReasons.map((reason) => (
                      <li
                        key={reason.code}
                        className="flex items-start gap-2 text-sm leading-snug text-[var(--text-muted)]"
                      >
                        <AlertTriangle
                          className="mt-0.5 size-3.5 shrink-0 text-[var(--color-caution)]"
                          aria-hidden="true"
                        />
                        {reason.message}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4">
                    <ValueRangeBlock range={card.lineValue} size="sm" />
                  </div>
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function NarrativeSection({ report }: { report: CollectionReport }) {
  const { narrative } = report;
  if (narrative.highlights.length === 0 && narrative.cautions.length === 0) {
    return null;
  }

  return (
    <Panel className="grid gap-8 sm:grid-cols-2">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Sparkles
            className="size-4 text-[var(--color-holo-cyan)]"
            aria-hidden="true"
          />
          Wat opvalt in deze analyse
        </h2>
        {narrative.highlights.length > 0 ? (
          <ul className="mt-4 space-y-2.5 text-sm text-[var(--text-muted)]">
            {narrative.highlights.map((highlight) => (
              <li key={highlight} className="flex gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--color-positive)]"
                />
                {highlight}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {narrative.cautions.length > 0 ? (
        <div>
          <h3 className="label-mono">Kanttekeningen</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-[var(--text-muted)]">
            {narrative.cautions.map((caution) => (
              <li key={caution} className="flex gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--color-caution)]"
                />
                {caution}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}
