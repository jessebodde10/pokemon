import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageSquare, Repeat2, Trophy, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, Panel, SectionHeading } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: 'Community',
  description:
    'De community rond Pokora AI: ruilen, beursverslagen en verzamelaars in Nederland en België. In voorbereiding.',
  alternates: { canonical: '/community' },
  // Nothing to index yet; announcing an empty section helps nobody.
  robots: { index: false, follow: true },
};

const PLANNED = [
  {
    icon: Repeat2,
    title: 'Ruilen',
    body: 'Bied kaarten aan en zoek gericht naar wat je mist, met een koppeling naar je wishlist.',
  },
  {
    icon: MessageSquare,
    title: 'Beursverslagen',
    body: 'Deel na afloop wat je op een beurs tegenkwam, zodat anderen weten wat ze kunnen verwachten.',
  },
  {
    icon: Users,
    title: 'Verzamelaars volgen',
    body: 'Volg verzamelaars met dezelfde focus en zie welke beurzen zij bezoeken.',
  },
  {
    icon: Trophy,
    title: 'Toernooiagenda',
    body: 'Speeltafels en toernooien apart van de verzamelbeurzen, met inschrijving.',
  },
] as const;

export default function CommunityPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <Badge tone="caution">In voorbereiding</Badge>
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
        Community
      </h1>
      <p className="mt-4 max-w-2xl text-base text-[var(--text-muted)]">
        Deze sectie bestaat nog niet. We zetten hem hier alvast neer zodat je
        weet waar het komt te staan, maar er valt op dit moment niets te doen.
      </p>

      <section className="mt-10">
        <SectionHeading
          title="Wat hier komt"
          description="Volgorde en invulling liggen nog niet vast."
        />
        <ul className="grid gap-4 sm:grid-cols-2">
          {PLANNED.map((entry) => {
            const Icon = entry.icon;
            return (
              <li key={entry.title}>
                <Panel className="h-full">
                  <Icon
                    className="size-5 text-[var(--color-holo-cyan)]"
                    aria-hidden="true"
                  />
                  <h3 className="mt-3 font-semibold">{entry.title}</h3>
                  <p className="mt-1.5 text-sm text-[var(--text-muted)]">
                    {entry.body}
                  </p>
                </Panel>
              </li>
            );
          })}
        </ul>
      </section>

      <Panel className="mt-8">
        <h2 className="font-semibold">Ondertussen</h2>
        <p className="mt-1.5 text-sm text-[var(--text-muted)]">
          De evenementenagenda werkt wel al, inclusief reviews per beurs.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="secondary">
            <Link href="/events">Naar de evenementen</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/events/advisor">Beursadvies</Link>
          </Button>
        </div>
      </Panel>
    </div>
  );
}
