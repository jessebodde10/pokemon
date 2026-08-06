import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, Sparkles, Store } from 'lucide-react';
import { EventsExplorer } from '@/components/events/events-explorer';
import { Reveal } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';
import { getEventsRepository } from '@/features/events/repository';

export const metadata: Metadata = {
  title: 'Pokémon Events Nederland & België',
  description:
    'Ontdek alle Pokémon-, TCG- en verzamelbeurzen in Nederland en België. Filter op provincie, datum, afstand en type beurs.',
  alternates: { canonical: '/events' },
  openGraph: {
    type: 'website',
    locale: 'nl_NL',
    title: 'Pokémon Events Nederland & België',
    description:
      'Alle Pokémon-, TCG- en verzamelbeurzen in Nederland en België, met standhouders, reviews en ticketstatus.',
    url: '/events',
  },
};

export default async function EventsPage() {
  const repository = getEventsRepository();
  const [items, venues] = await Promise.all([
    repository.listEvents(),
    repository.listVenues(),
  ]);

  const provinces = [...new Set(venues.map((venue) => venue.province))].sort(
    (a, b) => a.localeCompare(b, 'nl'),
  );

  const vendorTotal = new Set(items.flatMap((item) => item.event.vendorIds))
    .size;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="relative overflow-hidden rounded-3xl border border-[var(--border-subtle)] px-6 py-12 sm:px-10 sm:py-16">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(90% 120% at 12% 0%, color-mix(in oklab, var(--color-holo-violet) 30%, transparent), transparent 62%), radial-gradient(80% 100% at 95% 10%, color-mix(in oklab, var(--color-holo-cyan) 22%, transparent), transparent 60%)',
          }}
        />
        <Reveal as="span" className="block">
          <p className="label-mono text-[var(--color-holo-cyan)]">
            Beurzen en conventies
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="mt-4 max-w-3xl text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Pokémon Events{' '}
            <span className="holo-text">Nederland &amp; België</span>
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="mt-5 max-w-2xl text-base text-[var(--text-muted)] sm:text-lg">
            Ontdek alle Pokémon-, TCG- en verzamelbeurzen in Nederland en
            België.
          </p>
        </Reveal>

        <Reveal delay={0.24}>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/events/advisor">
                <Sparkles aria-hidden="true" />
                Vind een beurs die bij je past
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/vendors">Bekijk standhouders</Link>
            </Button>
          </div>
        </Reveal>

        <dl className="mt-9 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div className="flex items-center gap-2">
            <CalendarDays
              className="size-4 text-[var(--color-holo-cyan)]"
              aria-hidden="true"
            />
            <dt className="text-[var(--text-muted)]">Evenementen</dt>
            <dd className="font-semibold tabular-nums">{items.length}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Store
              className="size-4 text-[var(--color-holo-cyan)]"
              aria-hidden="true"
            />
            <dt className="text-[var(--text-muted)]">Standhouders</dt>
            <dd className="font-semibold tabular-nums">{vendorTotal}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-10">
        <EventsExplorer items={items} provinces={provinces} />
      </section>

      <p className="mt-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--color-ink-900)] px-4 py-3 text-sm leading-relaxed text-[var(--text-muted)]">
        Alle beursgegevens in deze demo zijn fictief en dienen als voorbeeld.
        Controleer datum, openingstijden en ticketprijzen altijd bij de
        organisator zelf voordat je op pad gaat.
      </p>
    </div>
  );
}
