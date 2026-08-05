import Link from 'next/link';
import { Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/features/auth/session';
import { cn } from '@/lib/utils';

export const LEGAL_DISCLAIMER =
  'Pokora AI geeft indicatieve informatie op basis van herkenningstechnologie en beschikbare marktdata. Werkelijke verkoopprijzen kunnen afwijken. Pokora AI is geen professionele taxatie-, grading- of beleggingsdienst.';

/**
 * The wordmark is one of the three places the holo sheen is allowed to appear.
 * The mark is a stack of sleeves - a binder, not a creature - so nothing about
 * it reads as an imitation of an official trading-card brand.
 */
export function PokoraLogo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span
        className="grid size-8 shrink-0 place-items-center rounded-xl"
        style={{
          background:
            'linear-gradient(135deg, var(--color-holo-violet), var(--color-holo-cyan) 55%, var(--color-holo-pink))',
        }}
      >
        <Layers
          className="size-4 text-[var(--color-ink-950)]"
          aria-hidden="true"
        />
      </span>
      <span className="font-[family-name:var(--font-display)] text-[17px] font-bold tracking-tight whitespace-nowrap">
        Pokora<span className="text-[var(--color-ink-500)]"> AI</span>
      </span>
    </span>
  );
}

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[color-mix(in_oklab,var(--surface-page)_88%,transparent)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <Link href="/" className="rounded-md" aria-label="Pokora AI, naar home">
          <PokoraLogo />
        </Link>

        <nav
          aria-label="Hoofdnavigatie"
          className="flex shrink-0 items-center gap-1"
        >
          {/* Tighter horizontal padding below `sm`: at 375px the full-width
              labels otherwise push the bar 2px past the viewport, and the page
              body must never scroll sideways. The labels themselves stay
              identical on every breakpoint. */}
          {user ? (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="px-2.5 sm:px-4"
              >
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button
                asChild
                variant="primary"
                size="sm"
                className="px-3 sm:px-4"
              >
                <Link href="/analyze">Analyseer kaarten</Link>
              </Button>
            </>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="px-2.5 sm:px-4"
              >
                <Link href="/login">Inloggen</Link>
              </Button>
              <Button
                asChild
                variant="primary"
                size="sm"
                className="px-3 sm:px-4"
              >
                <Link href="/analyze">Analyseer kaarten</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-[var(--border-subtle)]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md">
            <PokoraLogo />
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Inzicht in je Pokémon-kaartenverzameling, met open kaart over wat
              we wel en niet zeker weten.
            </p>
          </div>
          <nav aria-label="Juridische informatie" className="text-sm">
            <ul className="flex flex-col gap-2">
              <li>
                <Link
                  href="/disclaimer"
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Disclaimer
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Privacy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Voorwaarden
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <p className="mt-8 border-t border-[var(--border-subtle)] pt-6 text-xs leading-relaxed text-[var(--color-ink-500)]">
          {LEGAL_DISCLAIMER} Pokora AI is niet verbonden aan, en wordt niet
          gesteund door, de uitgevers of rechthebbenden van de Pokémon-kaarten.
          Kaartnamen worden uitsluitend beschrijvend gebruikt.
        </p>
      </div>
    </footer>
  );
}

export function DisclaimerNotice({ compact = false }: { compact?: boolean }) {
  return (
    <p
      className={
        compact
          ? 'text-xs leading-relaxed text-[var(--text-muted)]'
          : 'rounded-xl border border-[var(--border-subtle)] bg-[var(--color-ink-900)] px-4 py-3 text-sm leading-relaxed text-[var(--text-muted)]'
      }
    >
      Waarden en conditie-inschattingen zijn indicatief. Pokora AI is geen
      professionele taxateur of gradingdienst.
    </p>
  );
}
