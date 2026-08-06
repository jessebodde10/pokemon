import Link from 'next/link';
import { Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/features/auth/session';
import { cn } from '@/lib/utils';

export const LEGAL_DISCLAIMER =
  'Pokora geeft indicatieve informatie op basis van herkenningstechnologie en beschikbare marktdata. Werkelijke verkoopprijzen kunnen afwijken. Pokora is geen professionele taxatie-, grading- of beleggingsdienst.';

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
        Pokora
      </span>
    </span>
  );
}

/**
 * Primary sections.
 *
 * "Analyseren" is the app's original card-analysis feature; it keeps its own
 * name rather than being relabelled after something it does not do.
 * "Collectie" points at the real collection page rather than a placeholder,
 * because that feature already exists.
 */
export const PRIMARY_NAV = [
  { href: '/analyze', label: 'Analyseren' },
  { href: '/events', label: 'Events' },
  { href: '/community', label: 'Community' },
  { href: '/dashboard/collection', label: 'Collectie' },
] as const;

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[color-mix(in_oklab,var(--surface-page)_88%,transparent)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        {/* The mark is 32px tall; the padding brings the tap target to 44
            without moving the wordmark off the optical left edge. */}
        <Link
          href="/"
          className="-ml-2 inline-flex min-h-11 items-center rounded-lg px-2"
          aria-label="Pokora, naar home"
        >
          <PokoraLogo />
        </Link>

        {/* Sections live in the bar from `lg` up. Below that they move to the
            bottom bar, so the header never has to compete for width with the
            account actions on a phone. */}
        {/* Named differently from the bottom bar on purpose: two navigation
            landmarks sharing one accessible name is ambiguous to a screen
            reader, and only one of the two is ever visible anyway. */}
        <nav
          aria-label="Hoofdnavigatie"
          className="hidden shrink-0 items-center gap-1 lg:flex"
        >
          {PRIMARY_NAV.map((entry) => (
            <Button
              key={entry.href}
              asChild
              variant="ghost"
              size="sm"
              className="px-3"
            >
              <Link href={entry.href}>{entry.label}</Link>
            </Button>
          ))}
        </nav>

        <nav aria-label="Account" className="flex shrink-0 items-center gap-1">
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
    // The extra bottom padding clears the fixed mobile section bar; without it
    // the last footer line sits underneath it.
    <footer className="mt-20 border-t border-[var(--border-subtle)] pb-14 lg:pb-0">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md">
            <PokoraLogo />
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Inzicht in je Pokémon-kaartenverzameling, inclusief wat we niet
              zeker weten.
            </p>
          </div>
          {/* Each link is its own row with a 44px hit area. As plain text
              these were 17px tall, which is well under what a thumb can hit
              reliably - and they are the links someone reaches for when they
              want to know what this product does not claim. */}
          <nav aria-label="Juridische informatie" className="text-sm">
            <ul className="-ml-2 flex flex-col">
              {[
                { href: '/disclaimer', label: 'Disclaimer' },
                { href: '/privacy', label: 'Privacy' },
                { href: '/terms', label: 'Voorwaarden' },
              ].map((entry) => (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    className="inline-flex min-h-11 items-center rounded-lg px-2 text-[var(--text-muted)] transition-colors hover:bg-white/[0.06] hover:text-[var(--text-primary)]"
                  >
                    {entry.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="mt-8 border-t border-[var(--border-subtle)] pt-6 text-xs leading-relaxed text-[var(--color-ink-500)]">
          {LEGAL_DISCLAIMER} Pokora is niet verbonden aan, en wordt niet
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
      Waarden en conditie-inschattingen zijn indicatief. Pokora is geen
      professionele taxateur of gradingdienst.
    </p>
  );
}
