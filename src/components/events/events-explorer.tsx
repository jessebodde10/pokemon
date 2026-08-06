'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { EventCard } from './event-card';
import { Button } from '@/components/ui/button';
import {
  Badge,
  EmptyState,
  Input,
  Label,
  Select,
} from '@/components/ui/primitives';
import { ORIGIN_CITIES } from '@/features/events/distance';
import {
  DATE_RANGE_LABELS,
  DISTANCE_OPTIONS,
  EMPTY_FILTERS,
  countActiveFilters,
  filterEvents,
  type DateRange,
  type EventFilters,
} from '@/features/events/filtering';
import {
  COUNTRY_LABELS,
  EVENT_TAGS,
  EVENT_TAG_LABELS,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  type Country,
  type EventListItem,
  type EventTag,
  type EventType,
} from '@/features/events/types';

/**
 * The events overview.
 *
 * Filtering runs on the client over the full list the server rendered, so
 * changing a filter is instant and does not cost a round trip. That holds
 * comfortably at this catalogue size; once it does not, `filterEvents` moves
 * server-side unchanged, because it is already a pure function.
 */
export function EventsExplorer({
  items,
  provinces,
}: {
  items: EventListItem[];
  provinces: string[];
}) {
  const reduceMotion = useReducedMotion();
  const [filters, setFilters] = React.useState<EventFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = React.useState(false);

  const results = React.useMemo(
    () => filterEvents(items, filters),
    [items, filters],
  );
  const activeCount = countActiveFilters(filters);

  function update<K extends keyof EventFilters>(
    key: K,
    value: EventFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function toggleTag(tag: EventTag) {
    setFilters((current) => ({
      ...current,
      tags: current.tags.includes(tag)
        ? current.tags.filter((entry) => entry !== tag)
        : [...current.tags, tag],
    }));
  }

  // Provinces are scoped to the chosen country so the list never offers a
  // combination that cannot return anything.
  const visibleProvinces = React.useMemo(() => {
    if (filters.country === 'all') return provinces;
    return provinces.filter((province) =>
      items.some(
        (item) =>
          item.venue.province === province &&
          item.venue.country === filters.country,
      ),
    );
  }, [filters.country, items, provinces]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--color-ink-500)]"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={filters.query}
              onChange={(event) => update('query', event.target.value)}
              placeholder="Zoek op beurs, stad of provincie"
              aria-label="Zoek evenementen"
              className="pl-10"
            />
          </div>
          <Button
            type="button"
            variant={showFilters ? 'secondary' : 'outline'}
            onClick={() => setShowFilters((open) => !open)}
            aria-expanded={showFilters}
            aria-controls="event-filters"
            className="shrink-0"
          >
            <SlidersHorizontal aria-hidden="true" />
            <span className="hidden sm:inline">Filters</span>
            {activeCount > 0 ? (
              <span className="grid size-5 place-items-center rounded-full bg-[var(--color-holo-violet)] text-[11px] font-bold text-white">
                {activeCount}
              </span>
            ) : null}
          </Button>
        </div>

        <AnimatePresence initial={false}>
          {showFilters ? (
            <motion.div
              id="event-filters"
              initial={reduceMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="panel space-y-4 p-4 sm:p-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label htmlFor="filter-country">Land</Label>
                    <Select
                      id="filter-country"
                      value={filters.country}
                      onChange={(event) => {
                        update(
                          'country',
                          event.target.value as Country | 'all',
                        );
                        update('province', 'all');
                      }}
                    >
                      <option value="all">Alle landen</option>
                      {(['NL', 'BE'] as const).map((code) => (
                        <option key={code} value={code}>
                          {COUNTRY_LABELS[code]}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="filter-province">Provincie</Label>
                    <Select
                      id="filter-province"
                      value={filters.province}
                      onChange={(event) =>
                        update('province', event.target.value)
                      }
                    >
                      <option value="all">Alle provincies</option>
                      {visibleProvinces.map((province) => (
                        <option key={province} value={province}>
                          {province}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="filter-date">Datum</Label>
                    <Select
                      id="filter-date"
                      value={filters.dateRange}
                      onChange={(event) =>
                        update('dateRange', event.target.value as DateRange)
                      }
                    >
                      {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map(
                        (range) => (
                          <option key={range} value={range}>
                            {DATE_RANGE_LABELS[range]}
                          </option>
                        ),
                      )}
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="filter-type">Type evenement</Label>
                    <Select
                      id="filter-type"
                      value={filters.type}
                      onChange={(event) =>
                        update('type', event.target.value as EventType | 'all')
                      }
                    >
                      <option value="all">Alle types</option>
                      {EVENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {EVENT_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="filter-origin">Vertrek vanaf</Label>
                    <Select
                      id="filter-origin"
                      value={filters.originId ?? ''}
                      onChange={(event) =>
                        update('originId', event.target.value || null)
                      }
                    >
                      <option value="">Geen vertrekplaats</option>
                      {ORIGIN_CITIES.map((city) => (
                        <option key={city.id} value={city.id}>
                          {city.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="filter-distance">Maximale afstand</Label>
                    <Select
                      id="filter-distance"
                      value={filters.maxDistanceKm ?? ''}
                      onChange={(event) =>
                        update(
                          'maxDistanceKm',
                          event.target.value
                            ? Number(event.target.value)
                            : null,
                        )
                      }
                      disabled={!filters.originId}
                    >
                      <option value="">Geen limiet</option>
                      {DISTANCE_OPTIONS.map((km) => (
                        <option key={km} value={km}>
                          Binnen {km} km
                        </option>
                      ))}
                    </Select>
                    {!filters.originId ? (
                      <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                        Kies eerst een vertrekplaats.
                      </p>
                    ) : null}
                  </div>
                </div>

                <fieldset>
                  <legend className="mb-2 text-sm font-medium text-[var(--text-muted)]">
                    Wat moet er te vinden zijn
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {EVENT_TAGS.map((tag) => {
                      const active = filters.tags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          aria-pressed={active}
                          className={
                            active
                              ? 'rounded-full border border-[var(--color-holo-cyan)] bg-[color-mix(in_oklab,var(--color-holo-cyan)_18%,transparent)] px-3 py-1.5 text-xs font-medium text-[var(--color-holo-cyan)]'
                              : 'rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:border-white/30 hover:text-[var(--text-primary)]'
                          }
                        >
                          {EVENT_TAG_LABELS[tag]}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {activeCount > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilters(EMPTY_FILTERS)}
                  >
                    <X aria-hidden="true" />
                    Filters wissen
                  </Button>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm text-[var(--text-muted)]">
          {results.length === items.length
            ? `${results.length} evenementen`
            : `${results.length} van ${items.length} evenementen`}
        </p>
        {filters.originId && filters.maxDistanceKm ? (
          <Badge tone="accent">
            Binnen {filters.maxDistanceKm} km hemelsbreed
          </Badge>
        ) : null}
      </div>

      {results.length === 0 ? (
        <EmptyState
          title="Geen evenementen gevonden"
          description="Geen enkele beurs voldoet aan deze combinatie van filters. Verruim de afstand of laat een filter los."
          action={
            <Button
              type="button"
              variant="secondary"
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              Filters wissen
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((item, index) => (
            <li key={item.event.id} className="h-full">
              <EventCard item={item} index={index} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
