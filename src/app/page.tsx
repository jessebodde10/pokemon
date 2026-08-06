import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CalendarClock,
  Camera,
  CheckCircle2,
  FileBarChart,
  Gauge,
  Layers3,
  ScanSearch,
  ShieldQuestion,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/primitives';
import { DisclaimerNotice } from '@/components/layout/site-shell';
import { HeroVisual } from '@/components/marketing/phone-mockup';
import {
  HoloRule,
  HoverLift,
  Reveal,
  RevealGroup,
  RevealItem,
} from '@/components/motion/reveal';

export const metadata: Metadata = {
  title: 'Ontdek wat er in je Pokémon-binder zit',
  description:
    'Upload foto’s van je kaarten en ontvang een transparante analyse met kaartnamen, geschatte marktwaarden en opvallende kaarten. Altijd met bron, datum en bandbreedte.',
  alternates: { canonical: '/' },
};

/** A real sequence, so numbering it carries information rather than decoration. */
const STEPS = [
  {
    icon: Camera,
    title: 'Upload je foto’s',
    body: 'Losse kaarten of hele binderpagina’s. JPG, PNG of WEBP tot 10 MB per foto.',
    meta: 'Gast: 3 foto’s · Account: 10',
  },
  {
    icon: ScanSearch,
    title: 'Controleer de herkenning',
    body: 'Je ziet per kaart hoe zeker de herkenning is en welke alternatieven er zijn. Jij beslist.',
    meta: 'Niets telt mee tot jij bevestigt',
  },
  {
    icon: FileBarChart,
    title: 'Bekijk je collectieanalyse',
    body: 'Een rapport met bandbreedtes, prijsbron, datum en een uitleg van de datakwaliteit.',
    meta: 'Lage · midden · hoge schatting',
  },
];

/**
 * This sits where a competitor would put download counts. We have no users to
 * count, and inventing social proof is the one thing this product cannot
 * afford to do. These six disclosures are the actual differentiator.
 */
const DISCLOSURES = [
  { icon: Layers3, text: 'Welke kaart waarschijnlijk is herkend' },
  { icon: Gauge, text: 'Hoe zeker die herkenning is' },
  { icon: FileBarChart, text: 'Welke prijsbron is gebruikt' },
  {
    icon: CalendarClock,
    text: 'Wanneer de prijs voor het laatst is bijgewerkt',
  },
  { icon: CheckCircle2, text: 'Op hoeveel waarnemingen de schatting rust' },
  { icon: ShieldQuestion, text: 'Welke informatie nog ontbreekt' },
];

const FAQ = [
  {
    question: 'Hoe nauwkeurig is de herkenning?',
    answer:
      'Dat verschilt per foto. Pokora toont bij iedere kaart een herkenningszekerheid en alternatieve matches. Niets wordt definitief opgeslagen voordat jij het hebt bevestigd of gecorrigeerd.',
  },
  {
    question: 'Krijg ik een exacte waarde van mijn kaarten?',
    answer:
      'Nee. Je krijgt een geschatte bandbreedte met een lage, midden- en hoge schatting, inclusief de gebruikte prijsbron, de datum van de laatste update en het aantal prijswaarnemingen. Bij te weinig data tonen we geen bedrag.',
  },
  {
    question: 'Kan Pokora de conditie van mijn kaart beoordelen?',
    answer:
      'Niet betrouwbaar op basis van een binderfoto. De conditie blijft dan op "onbekend" staan. Voor een inschatting zijn minimaal een scherpe voor- en achterkantfoto bij neutraal licht nodig.',
  },
  {
    question: 'Welke kaarten worden ondersteund?',
    answer:
      'In deze eerste versie alleen ongeslabde Pokémon-kaarten. Geslabde kaarten (PSA, BGS, CGC) en andere spellen zoals Magic of Yu-Gi-Oh! vallen buiten deze versie.',
  },
  {
    question: 'Wat gebeurt er met mijn foto’s?',
    answer:
      'Foto’s worden opgeslagen in een afgeschermde opslag en alleen gebruikt om jouw analyse uit te voeren. Analyses van gasten worden standaard na 24 uur automatisch verwijderd.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((entry) => ({
    '@type': 'Question',
    name: entry.question,
    acceptedAnswer: { '@type': 'Answer', text: entry.answer },
  })),
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Structured data only; the content is the static constant above.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero ----------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-12 sm:px-6 sm:pt-20 sm:pb-16">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-10">
          {/* Hero copy arrives in reading order, each line a beat behind the
              last, so the eye is led down to the call to action. */}
          <div>
            <Reveal as="span" className="block">
              <p className="label-mono flex items-center gap-2">
                <span
                  className="inline-block size-1.5 animate-pulse rounded-full"
                  style={{ background: 'var(--color-holo-cyan)' }}
                  aria-hidden="true"
                />
                Van binderpagina naar overzicht
              </p>
            </Reveal>

            <Reveal delay={0.08}>
              <h1 className="mt-5 text-[clamp(2.6rem,7.5vw,4.6rem)] leading-[0.95] font-extrabold tracking-[-0.045em] text-balance">
                Ontdek wat er in je{' '}
                <span className="holo-text">Pokémon-binder</span> zit
              </h1>
            </Reveal>

            <Reveal delay={0.16}>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--text-muted)]">
                Upload foto’s van je kaarten en ontvang een transparante analyse
                met kaartnamen, geschatte marktwaarden en opvallende kaarten.
              </p>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/analyze">Analyseer mijn kaarten</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="#hoe-het-werkt">Bekijk hoe het werkt</Link>
                </Button>
              </div>

              <p className="mt-5 font-mono text-xs text-[var(--color-ink-500)]">
                Geen account nodig voor je eerste analyse. Maximaal 3 foto’s per
                gastanalyse.
              </p>
            </Reveal>
          </div>

          <HeroVisual />
        </div>
      </section>

      {/* Process -------------------------------------------------------- */}
      <section
        id="hoe-het-werkt"
        aria-labelledby="hoe-het-werkt-titel"
        className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-2 pb-16 sm:px-6 sm:pt-4 sm:pb-20"
      >
        <HoloRule className="mb-10" />

        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2
              id="hoe-het-werkt-titel"
              className="text-[clamp(1.9rem,4vw,2.9rem)] leading-[1.05] font-bold"
            >
              Zo werkt het
            </h2>
            <p className="max-w-sm text-sm text-[var(--text-muted)]">
              Drie stappen, in deze volgorde. De middelste is niet over te slaan
              — daar beslis jij wat klopt.
            </p>
          </div>
        </Reveal>

        {/* RevealItem, not a plain li: variants only pass through motion
            components, and a plain element in between would leave the cards
            stuck in their hidden state. */}
        {/* The connector carries light left to right across the three steps,
            restating "in deze volgorde" without another line of copy. Hidden
            below sm, where the cards stack and the direction changes. */}
        <div
          aria-hidden="true"
          className="mt-10 mb-4 hidden h-px sm:block"
          style={{
            backgroundImage:
              'linear-gradient(90deg, transparent, var(--color-holo-violet), var(--color-holo-cyan), transparent)',
            backgroundSize: '200% 100%',
            animation: 'flow-line 7s linear infinite',
          }}
        />

        <RevealGroup as="ol" className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <RevealItem key={step.title} as="li" className="h-full">
              <HoverLift className="h-full">
                <Panel className="group relative h-full overflow-hidden transition-colors hover:border-white/25">
                  {/* Each card breathes on its own offset, so the row never
                      pulses in unison - that would read as a loading state.
                      No negative z-index: the panel has a solid background,
                      which would paint straight over it. */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-24 -right-20 size-56 rounded-full opacity-40 blur-3xl"
                    style={{
                      background:
                        index === 1
                          ? 'radial-gradient(circle, var(--color-holo-cyan), transparent 70%)'
                          : 'radial-gradient(circle, var(--color-holo-violet), transparent 70%)',
                      animation: `aurora-drift ${11 + index * 2}s ease-in-out infinite`,
                      animationDelay: `${index * -3.5}s`,
                    }}
                  />

                  {/* Positioned, so the copy paints above the aurora. */}
                  <div className="relative">
                    <div className="flex items-start justify-between">
                      {/* The step number is the one thing that grows on hover:
                          it is what makes the sequence feel like a sequence. */}
                      <span className="origin-left font-mono text-3xl leading-none font-semibold text-[var(--color-ink-600)] transition-all duration-300 group-hover:scale-110 group-hover:text-[var(--color-holo-cyan)]">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      {/* The bob lives on the wrapper and the hover transform
                          on the icon. Both on one element and the running
                          animation would simply override the hover. */}
                      <span
                        className="block"
                        style={{
                          animation: 'icon-bob 4.5s ease-in-out infinite',
                          animationDelay: `${index * -1.5}s`,
                        }}
                      >
                        <step.icon
                          className="size-5 text-[var(--color-holo-cyan)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
                          aria-hidden="true"
                        />
                      </span>
                    </div>

                    <h3 className="mt-7 text-lg font-bold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                      {step.body}
                    </p>
                    <p className="mt-5 font-mono text-[11px] text-[var(--color-ink-500)]">
                      {step.meta}
                    </p>
                  </div>
                </Panel>
              </HoverLift>
            </RevealItem>
          ))}
        </RevealGroup>

        <Reveal className="mt-8">
          <DisclaimerNotice />
        </Reveal>
      </section>

      {/* Transparency --------------------------------------------------- */}
      <section
        aria-labelledby="transparantie-titel"
        className="mx-auto max-w-6xl px-4 pt-2 pb-16 sm:px-6 sm:pt-4 sm:pb-20"
      >
        <HoloRule className="mb-10" />

        <Reveal>
          <h2
            id="transparantie-titel"
            className="max-w-2xl text-[clamp(1.9rem,4vw,2.9rem)] leading-[1.05] font-bold text-balance"
          >
            Wat je bij elk resultaat te zien krijgt
          </h2>
          <p className="mt-4 max-w-xl text-[var(--text-muted)]">
            Geen enkel bedrag staat er zonder context. Ontbreekt de
            onderbouwing, dan tonen we geen bedrag.
          </p>
        </Reveal>

        {/* Six peers, so they arrive as a wave rather than one block. Each
            cell lights up on hover to show it is a distinct disclosure. */}
        <RevealGroup
          as="ul"
          className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--border-subtle)] sm:grid-cols-2 lg:grid-cols-3"
        >
          {DISCLOSURES.map((item, index) => (
            <RevealItem
              key={item.text}
              className="group relative flex items-start gap-3 overflow-hidden bg-[var(--color-ink-950)] px-5 py-6 transition-colors hover:bg-[var(--color-ink-900)]"
            >
              {/* One highlight walks the six cells in order on a 12s loop,
                  2s apart. It reads as the product checking each disclosure
                  in turn, which is exactly what the section claims. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(220px circle at 0% 50%, color-mix(in oklab, var(--color-holo-cyan) 14%, transparent), transparent 70%)',
                  // Invisible by default. During its `animation-delay` an
                  // element renders its own style, so without this the five
                  // cells still waiting their turn would all light up at once
                  // on load.
                  opacity: 0,
                  animation: 'cell-scan 12s linear infinite',
                  animationDelay: `${index * 2}s`,
                }}
              />
              {/* Scan pulse on the wrapper, hover scale on the icon: one
                  element cannot animate and transition the same property. */}
              <span
                className="relative mt-0.5 block shrink-0"
                style={{
                  animation: 'cell-scan-icon 12s linear infinite',
                  animationDelay: `${index * 2}s`,
                }}
              >
                <item.icon
                  className="size-4 text-[var(--color-holo-cyan)] transition-transform duration-300 group-hover:scale-125"
                  aria-hidden="true"
                />
              </span>
              <span className="relative text-sm leading-snug">{item.text}</span>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* FAQ + CTA ------------------------------------------------------ */}
      <section
        aria-labelledby="faq-titel"
        className="mx-auto max-w-3xl px-4 pt-2 pb-20 sm:px-6 sm:pt-4 sm:pb-28"
      >
        <HoloRule className="mb-10" />

        <Reveal>
          <h2
            id="faq-titel"
            className="text-[clamp(1.9rem,4vw,2.9rem)] leading-[1.05] font-bold"
          >
            Veelgestelde vragen
          </h2>
        </Reveal>

        <RevealGroup
          as="dl"
          className="mt-8 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]"
        >
          {FAQ.map((entry) => (
            <RevealItem key={entry.question} as="div" className="py-6">
              <dt className="font-[family-name:var(--font-display)] text-base font-semibold">
                {entry.question}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                {entry.answer}
              </dd>
            </RevealItem>
          ))}
        </RevealGroup>

        <Reveal>
          <div className="group relative mt-14 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] px-6 py-12 text-center transition-colors hover:border-white/25 sm:px-10">
            {/* The glow drifts upward as the panel comes into view, so the
                closing call to action arrives rather than simply being there. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 opacity-25 transition-opacity duration-500 group-hover:opacity-40"
              style={{
                background:
                  'radial-gradient(600px circle at 50% 120%, var(--color-holo-violet), transparent 65%)',
                animation: 'float-soft 9s ease-in-out infinite',
              }}
            />
            <h2 className="text-[clamp(1.6rem,3.5vw,2.3rem)] leading-tight font-bold">
              Klaar om te beginnen?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-[var(--text-muted)]">
              Je eerste analyse werkt zonder account. Bewaren kan later.
            </p>
            <Button asChild size="lg" className="mt-7">
              <Link href="/analyze">Analyseer mijn kaarten</Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </>
  );
}
