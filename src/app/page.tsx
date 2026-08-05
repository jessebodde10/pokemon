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
      'Dat verschilt per foto. Valtivo AI toont bij iedere kaart een herkenningszekerheid en alternatieve matches. Niets wordt definitief opgeslagen voordat jij het hebt bevestigd of gecorrigeerd.',
  },
  {
    question: 'Krijg ik een exacte waarde van mijn kaarten?',
    answer:
      'Nee. Je krijgt een geschatte bandbreedte met een lage, midden- en hoge schatting, inclusief de gebruikte prijsbron, de datum van de laatste update en het aantal prijswaarnemingen. Bij te weinig data tonen we geen bedrag.',
  },
  {
    question: 'Kan Valtivo AI de conditie van mijn kaart beoordelen?',
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
          <div>
            <p className="label-mono flex items-center gap-2">
              <span
                className="inline-block size-1.5 rounded-full"
                style={{ background: 'var(--color-holo-cyan)' }}
                aria-hidden="true"
              />
              Van binderpagina naar overzicht
            </p>

            <h1 className="mt-5 text-[clamp(2.6rem,7.5vw,4.6rem)] leading-[0.95] font-extrabold tracking-[-0.045em] text-balance">
              Ontdek wat er in je{' '}
              <span className="holo-text">Pokémon-binder</span> zit
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--text-muted)]">
              Upload foto’s van je kaarten en ontvang een transparante analyse
              met kaartnamen, geschatte marktwaarden en opvallende kaarten.
            </p>

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
        <div className="holo-rule mb-10" />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2
            id="hoe-het-werkt-titel"
            className="text-[clamp(1.9rem,4vw,2.9rem)] leading-[1.05] font-bold"
          >
            Zo werkt het
          </h2>
          <p className="max-w-sm text-sm text-[var(--text-muted)]">
            Drie stappen, in deze volgorde. De middelste is niet over te slaan —
            daar beslis jij wat klopt.
          </p>
        </div>

        <ol className="mt-10 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <Panel className="group h-full transition-colors hover:border-white/25">
                <div className="flex items-start justify-between">
                  <span className="font-mono text-3xl leading-none font-semibold text-[var(--color-ink-600)] transition-colors group-hover:text-[var(--color-holo-cyan)]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <step.icon
                    className="size-5 text-[var(--color-holo-cyan)]"
                    aria-hidden="true"
                  />
                </div>

                <h3 className="mt-7 text-lg font-bold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                  {step.body}
                </p>
                <p className="mt-5 font-mono text-[11px] text-[var(--color-ink-500)]">
                  {step.meta}
                </p>
              </Panel>
            </li>
          ))}
        </ol>

        <div className="mt-8">
          <DisclaimerNotice />
        </div>
      </section>

      {/* Transparency --------------------------------------------------- */}
      <section
        aria-labelledby="transparantie-titel"
        className="mx-auto max-w-6xl px-4 pt-2 pb-16 sm:px-6 sm:pt-4 sm:pb-20"
      >
        <div className="holo-rule mb-10" />

        <h2
          id="transparantie-titel"
          className="max-w-2xl text-[clamp(1.9rem,4vw,2.9rem)] leading-[1.05] font-bold text-balance"
        >
          Wat je bij elk resultaat te zien krijgt
        </h2>
        <p className="mt-4 max-w-xl text-[var(--text-muted)]">
          Geen enkel bedrag staat er zonder context. Ontbreekt de onderbouwing,
          dan tonen we geen bedrag.
        </p>

        <ul className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--border-subtle)] sm:grid-cols-2 lg:grid-cols-3">
          {DISCLOSURES.map((item) => (
            <li
              key={item.text}
              className="flex items-start gap-3 bg-[var(--color-ink-950)] px-5 py-6"
            >
              <item.icon
                className="mt-0.5 size-4 shrink-0 text-[var(--color-holo-cyan)]"
                aria-hidden="true"
              />
              <span className="text-sm leading-snug">{item.text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ + CTA ------------------------------------------------------ */}
      <section
        aria-labelledby="faq-titel"
        className="mx-auto max-w-3xl px-4 pt-2 pb-20 sm:px-6 sm:pt-4 sm:pb-28"
      >
        <div className="holo-rule mb-10" />

        <h2
          id="faq-titel"
          className="text-[clamp(1.9rem,4vw,2.9rem)] leading-[1.05] font-bold"
        >
          Veelgestelde vragen
        </h2>

        <dl className="mt-8 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
          {FAQ.map((entry) => (
            <div key={entry.question} className="py-6">
              <dt className="font-[family-name:var(--font-display)] text-base font-semibold">
                {entry.question}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                {entry.answer}
              </dd>
            </div>
          ))}
        </dl>

        <div className="relative mt-14 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] px-6 py-12 text-center sm:px-10">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 opacity-25"
            style={{
              background:
                'radial-gradient(600px circle at 50% 120%, var(--color-holo-violet), transparent 65%)',
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
      </section>
    </>
  );
}
