'use client';

import * as React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, Info, Sparkles } from 'lucide-react';
import { EventCard } from './event-card';
import { Button } from '@/components/ui/button';
import { Badge, Label, Panel, Select } from '@/components/ui/primitives';
import { ORIGIN_CITIES } from '@/features/events/distance';
import { DISTANCE_OPTIONS } from '@/features/events/filtering';
import {
  ADVISOR_INTERESTS,
  ADVISOR_INTEREST_LABELS,
  type AdvisorInterest,
  type AdvisorResult,
} from '@/features/events/advisor';

/**
 * The advisor form.
 *
 * The advice is produced server-side by whichever `EventAdvisor` is installed,
 * so this component never knows whether a rule engine or a model answered. It
 * only knows how to render recommendations and their reasons.
 */
export function AdvisorForm({
  action,
}: {
  action: (input: {
    interests: AdvisorInterest[];
    originId: string | null;
    maxDistanceKm: number | null;
  }) => Promise<AdvisorResult>;
}) {
  const reduceMotion = useReducedMotion();
  const [interests, setInterests] = React.useState<AdvisorInterest[]>([]);
  const [originId, setOriginId] = React.useState<string | null>(null);
  const [maxDistanceKm, setMaxDistanceKm] = React.useState<number | null>(null);
  const [result, setResult] = React.useState<AdvisorResult | null>(null);
  const [pending, startTransition] = React.useTransition();

  function toggle(interest: AdvisorInterest) {
    setInterests((current) =>
      current.includes(interest)
        ? current.filter((entry) => entry !== interest)
        : [...current, interest],
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      setResult(await action({ interests, originId, maxDistanceKm }));
    });
  }

  return (
    <div className="space-y-8">
      <Panel raised>
        <form onSubmit={submit} className="space-y-6">
          <fieldset>
            <legend className="text-base font-semibold">Ik zoek</legend>
            <p className="mt-1 mb-3 text-sm text-[var(--text-muted)]">
              Kies alles wat van toepassing is. Hoe meer je aangeeft, hoe
              scherper het advies.
            </p>
            <div className="flex flex-wrap gap-2">
              {ADVISOR_INTERESTS.map((interest) => {
                const active = interests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggle(interest)}
                    className={
                      active
                        ? 'rounded-full border border-[var(--color-holo-cyan)] bg-[color-mix(in_oklab,var(--color-holo-cyan)_18%,transparent)] px-4 py-2 text-sm font-medium text-[var(--color-holo-cyan)]'
                        : 'rounded-full border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:border-white/30 hover:text-[var(--text-primary)]'
                    }
                  >
                    {ADVISOR_INTEREST_LABELS[interest]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="advisor-origin">Vertrek vanaf</Label>
              <Select
                id="advisor-origin"
                value={originId ?? ''}
                onChange={(event) => setOriginId(event.target.value || null)}
              >
                <option value="">Maakt niet uit</option>
                {ORIGIN_CITIES.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="advisor-distance">Maximale afstand</Label>
              <Select
                id="advisor-distance"
                value={maxDistanceKm ?? ''}
                onChange={(event) =>
                  setMaxDistanceKm(
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
                disabled={!originId}
              >
                <option value="">Geen limiet</option>
                {DISTANCE_OPTIONS.map((km) => (
                  <option key={km} value={km}>
                    Binnen {km} km
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <Button type="submit" size="lg" disabled={pending}>
            <Sparkles aria-hidden="true" />
            {pending ? 'Bezig met zoeken…' : 'Geef me een advies'}
          </Button>
        </form>
      </Panel>

      <AnimatePresence mode="wait">
        {result ? (
          <motion.section
            key="result"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            aria-live="polite"
            className="space-y-5"
          >
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {result.recommendations.length === 0
                ? 'Geen passende beurs gevonden'
                : `Top ${result.recommendations.length} voor jou`}
            </h2>

            {result.caveats.length > 0 ? (
              <ul className="space-y-2">
                {result.caveats.map((caveat) => (
                  <li
                    key={caveat}
                    className="flex items-start gap-2 rounded-xl border border-[color-mix(in_oklab,var(--color-caution)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-caution)_10%,transparent)] px-4 py-3 text-sm text-[var(--color-caution)]"
                  >
                    <AlertCircle
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    {caveat}
                  </li>
                ))}
              </ul>
            ) : null}

            <ol className="space-y-5">
              {result.recommendations.map((entry, index) => (
                <li key={entry.item.event.id}>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <EventCard
                      item={{ ...entry.item, distanceKm: entry.distanceKm }}
                      index={index}
                    />
                    <Panel className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <Badge tone="accent">#{index + 1}</Badge>
                        <h3 className="font-semibold">
                          Waarom deze beurs
                        </h3>
                      </div>
                      {entry.reasons.length === 0 ? (
                        <p className="mt-3 text-sm text-[var(--text-muted)]">
                          Niets in deze beurs sluit specifiek aan op je
                          voorkeuren. Hij staat hier alleen omdat hij als
                          eerstvolgende gepland staat.
                        </p>
                      ) : (
                        <ul className="mt-3 space-y-2">
                          {entry.reasons.map((reason) => (
                            <li
                              key={reason.label}
                              className="flex items-start gap-2 text-sm"
                            >
                              <Info
                                className="mt-0.5 size-3.5 shrink-0 text-[var(--color-holo-cyan)]"
                                aria-hidden="true"
                              />
                              <span>{reason.label}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="mt-auto self-start"
                      >
                        <Link href={`/events/${entry.item.event.slug}`}>
                          Bekijk de beurs
                        </Link>
                      </Button>
                    </Panel>
                  </div>
                </li>
              ))}
            </ol>

            <p className="text-xs text-[var(--text-muted)]">
              Dit advies komt van een regelgebaseerde vergelijking van
              standhouderprofielen, labels en beoordelingen. Er komt geen
              taalmodel aan te pas, en elke aanbeveling laat zien waarop hij
              gebaseerd is.
            </p>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
