import type { Metadata } from 'next';
import { BackLink } from '@/components/events/back-link';
import Link from 'next/link';
import { adviseAction } from './actions';
import { AdvisorForm } from '@/components/events/advisor-form';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Welke beurs past bij jou?',
  description:
    'Vertel waar je op verzamelt en krijg drie beurzen die daarbij passen, met uitleg waarom.',
  alternates: { canonical: '/events/advisor' },
  openGraph: {
    type: 'website',
    locale: 'nl_NL',
    title: 'Welke Pokémon-beurs past bij jou?',
    description:
      'Kies je voorkeuren en krijg drie passende beurzen in Nederland en België, met uitleg per aanbeveling.',
    url: '/events/advisor',
  },
};

export default function AdvisorPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <BackLink href="/events">Alle evenementen</BackLink>

      <p className="label-mono text-[var(--color-holo-cyan)]">Beursadvies</p>
      <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
        Welke beurs past bij <span className="holo-text">wat jij zoekt</span>?
      </h1>
      <p className="mt-4 max-w-2xl text-base text-[var(--text-muted)]">
        Geef aan waar je op verzamelt. Je krijgt drie beurzen terug, elk met de
        reden waarom die er tussen staat — zodat je zelf kunt beoordelen of het
        advies hout snijdt.
      </p>

      <div className="mt-8">
        <AdvisorForm action={adviseAction} />
      </div>

      <section className="mt-12 rounded-2xl border border-[var(--border-subtle)] p-5 sm:p-6">
        <h2 className="font-semibold">Hoe dit werkt</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          Elke beurs krijgt punten voor standhouders die aansluiten op je
          voorkeur, voor labels die de organisator opgaf en voor de spreiding
          van beoordelingen. Een beurs waar drie van de drie standhouders in
          graded kaarten handelen scoort hoger dan een grote beurs waar dat er
          drie van de tien zijn — concentratie telt mee, niet alleen aantal.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          Sluit niets aan op je voorkeuren, dan zegt het advies dat, in plaats
          van de agenda op datum te presenteren alsof het een aanbeveling is.
        </p>
        <Button asChild variant="ghost" size="sm" className="mt-4 -ml-4">
          <Link href="/events">Liever zelf filteren</Link>
        </Button>
      </section>
    </div>
  );
}
