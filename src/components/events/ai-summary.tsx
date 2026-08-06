import { Sparkles } from 'lucide-react';
import { joinDutch, type EventSummary } from '@/features/events/summary';

/**
 * Automatic event summary.
 *
 * Labelled as generated, and it states what it was generated from. The point
 * is that a reader can check the claim: if it says three of six vendors are
 * graded specialists, the vendor grid below shows exactly that. A summary that
 * cannot be checked is just a confident-sounding guess.
 */
export function AiSummary({ summary }: { summary: EventSummary }) {
  return (
    <section
      aria-labelledby="ai-summary-heading"
      className="panel-raised relative overflow-hidden p-5 sm:p-6"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            'radial-gradient(70% 120% at 0% 0%, color-mix(in oklab, var(--color-holo-violet) 22%, transparent), transparent 60%)',
        }}
      />
      <div className="flex items-center gap-2">
        <Sparkles
          className="size-4 text-[var(--color-holo-cyan)]"
          aria-hidden="true"
        />
        <h2 id="ai-summary-heading" className="font-semibold">
          Samenvatting
        </h2>
        <span className="label-mono ml-auto text-[var(--color-ink-500)]">
          automatisch gegenereerd
        </span>
      </div>

      <div className="mt-3 space-y-2.5">
        {summary.paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>

      {summary.basedOn.length > 0 ? (
        <p className="mt-4 border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--text-muted)]">
          Samengesteld uit {joinDutch(summary.basedOn)}. Geen redactionele
          beoordeling. Controleer bij twijfel de standhouderslijst hieronder.
        </p>
      ) : null}
    </section>
  );
}
