'use client';

import * as React from 'react';
import { ArrowDownUp } from 'lucide-react';
import { Badge, Input, Panel, Select } from '@/components/ui/primitives';
import { formatEuro } from '@/features/report/totals';
import { formatPercent } from '@/lib/utils';
import type { ReportCard } from '@/types/report';

/**
 * Full card list. Responsive by design: a real table on wide screens, stacked
 * cards on narrow ones, with the same data and the same controls.
 */

type SortKey = 'value_desc' | 'value_asc' | 'name' | 'set' | 'confidence';
type FilterKey =
  | 'all'
  | 'confirmed'
  | 'uncertain'
  | 'unknown'
  | 'without_price';

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'Alle kaarten',
  confirmed: 'Bevestigd',
  uncertain: 'Onzeker',
  unknown: 'Onbekend',
  without_price: 'Zonder prijsdata',
};

const SORT_LABELS: Record<SortKey, string> = {
  value_desc: 'Hoogste waarde',
  value_asc: 'Laagste waarde',
  name: 'Naam (A-Z)',
  set: 'Set',
  confidence: 'Herkenningszekerheid',
};

const STATUS_LABELS: Record<ReportCard['reviewStatus'], string> = {
  pending: 'Nog te controleren',
  confirmed: 'Bevestigd',
  corrected: 'Gecorrigeerd',
  unknown: 'Onbekend',
  removed: 'Verwijderd',
};

function matchesFilter(card: ReportCard, filter: FilterKey): boolean {
  switch (filter) {
    case 'confirmed':
      return (
        card.reviewStatus === 'confirmed' || card.reviewStatus === 'corrected'
      );
    case 'uncertain':
      return (
        card.reviewStatus === 'pending' ||
        (card.recognitionConfidence !== null &&
          card.recognitionConfidence < 0.6)
      );
    case 'unknown':
      return card.reviewStatus === 'unknown';
    case 'without_price':
      return !card.hasPriceData;
    default:
      return true;
  }
}

export function CardTable({ cards }: { cards: ReportCard[] }) {
  const [filter, setFilter] = React.useState<FilterKey>('all');
  const [sort, setSort] = React.useState<SortKey>('value_desc');
  const [query, setQuery] = React.useState('');
  const [selectedSet, setSelectedSet] = React.useState('all');

  const availableSets = React.useMemo(
    () =>
      [
        ...new Set(cards.map((card) => card.setName).filter(Boolean)),
      ].sort() as string[],
    [cards],
  );

  const visible = React.useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();

    const filtered = cards.filter((card) => {
      if (!matchesFilter(card, filter)) return false;
      if (selectedSet !== 'all' && card.setName !== selectedSet) return false;
      if (normalisedQuery) {
        const haystack = [card.name, card.setName, card.cardNumber]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(normalisedQuery)) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'value_asc':
          return (a.lineValue.mid ?? Infinity) - (b.lineValue.mid ?? Infinity);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'set':
          return (a.setName ?? '').localeCompare(b.setName ?? '');
        case 'confidence':
          return (
            (b.recognitionConfidence ?? 0) - (a.recognitionConfidence ?? 0)
          );
        default:
          return (b.lineValue.mid ?? -1) - (a.lineValue.mid ?? -1);
      }
    });
  }, [cards, filter, selectedSet, sort, query]);

  return (
    <Panel>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="table-search" className="sr-only">
            Zoek op naam of kaartnummer
          </label>
          <Input
            id="table-search"
            type="search"
            placeholder="Zoek op naam of nummer"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="table-filter" className="sr-only">
            Filter op status
          </label>
          <Select
            id="table-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value as FilterKey)}
          >
            {Object.entries(FILTER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="table-set" className="sr-only">
            Filter op set
          </label>
          <Select
            id="table-set"
            value={selectedSet}
            onChange={(event) => setSelectedSet(event.target.value)}
          >
            <option value="all">Alle sets</option>
            {availableSets.map((setName) => (
              <option key={setName} value={setName}>
                {setName}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="table-sort" className="sr-only">
            Sorteren
          </label>
          <Select
            id="table-sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <p aria-live="polite" className="mt-4 text-sm text-[var(--text-muted)]">
        {visible.length} van {cards.length} kaarten
      </p>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--text-muted)]">
          Geen kaarten die aan deze filters voldoen.
        </p>
      ) : (
        <>
          {/* Wide screens: a real table. */}
          <div className="mt-4 hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[64rem] border-collapse text-sm">
              <caption className="sr-only">
                Volledige kaartenlijst met set, aantal, geschatte bandbreedte,
                databron, herkenningszekerheid en status
              </caption>
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left">
                  <th scope="col" className="label-mono py-3 pr-3 text-left">
                    Kaart
                  </th>
                  <th scope="col" className="label-mono py-3 pr-3 text-left">
                    Set
                  </th>
                  <th scope="col" className="label-mono py-3 pr-3 text-left">
                    Nummer
                  </th>
                  <th scope="col" className="label-mono py-3 pr-3 text-left">
                    Variant
                  </th>
                  <th scope="col" className="label-mono py-3 pr-3 text-right">
                    Aantal
                  </th>
                  <th scope="col" className="label-mono py-3 pr-3 text-right">
                    <span className="inline-flex items-center gap-1">
                      <ArrowDownUp className="size-3" aria-hidden="true" />
                      Bandbreedte
                    </span>
                  </th>
                  <th scope="col" className="label-mono py-3 pr-3 text-left">
                    Databron
                  </th>
                  <th scope="col" className="label-mono py-3 pr-3 text-right">
                    Zekerheid
                  </th>
                  <th scope="col" className="label-mono py-3 text-left">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((card) => (
                  <tr
                    key={card.detectedCardId}
                    className="border-b border-[var(--border-subtle)] last:border-0"
                  >
                    <th scope="row" className="py-3 pr-3 text-left font-medium">
                      {card.name}
                    </th>
                    <td className="py-3 pr-3 text-[var(--text-muted)]">
                      {card.setName ?? '—'}
                    </td>
                    <td className="py-3 pr-3 text-[var(--text-muted)] tabular-nums">
                      {card.cardNumber ?? '—'}
                    </td>
                    <td className="py-3 pr-3 text-[var(--text-muted)]">
                      {card.variant ?? 'Onbekend'}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums">
                      {card.quantity}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums">
                      {card.hasPriceData ? (
                        <>
                          <span className="font-mono font-semibold text-[var(--color-gold)]">
                            {formatEuro(card.lineValue.mid)}
                          </span>
                          <span className="block font-mono text-[11px] text-[var(--text-muted)]">
                            {formatEuro(card.lineValue.low)} –{' '}
                            {formatEuro(card.lineValue.high)}
                          </span>
                        </>
                      ) : (
                        <span className="font-mono text-[var(--color-caution)]">
                          Onvoldoende marktdata
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-[var(--text-muted)]">
                      {card.priceSourceName ?? '—'}
                      {card.priceSampleSize > 0 ? (
                        <span className="block font-mono text-[11px]">
                          {card.priceSampleSize} waarnemingen
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums">
                      {formatPercent(card.recognitionConfidence)}
                    </td>
                    <td className="py-3">
                      <Badge
                        tone={
                          card.reviewStatus === 'confirmed' ||
                          card.reviewStatus === 'corrected'
                            ? 'positive'
                            : card.reviewStatus === 'pending'
                              ? 'caution'
                              : 'neutral'
                        }
                      >
                        {STATUS_LABELS[card.reviewStatus]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Narrow screens: stacked cards carrying the same fields. */}
          <ul className="mt-4 space-y-3 lg:hidden">
            {visible.map((card) => (
              <li
                key={card.detectedCardId}
                className="rounded-xl border border-[var(--border-subtle)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{card.name}</p>
                    <p className="truncate font-mono text-[11px] text-[var(--text-muted)]">
                      {card.setName ?? 'Onbekende set'} ·{' '}
                      {card.cardNumber ?? '—'} ·{' '}
                      {card.variant ?? 'variant onbekend'}
                    </p>
                  </div>
                  <Badge
                    tone={
                      card.reviewStatus === 'confirmed' ||
                      card.reviewStatus === 'corrected'
                        ? 'positive'
                        : card.reviewStatus === 'pending'
                          ? 'caution'
                          : 'neutral'
                    }
                  >
                    {STATUS_LABELS[card.reviewStatus]}
                  </Badge>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="label-mono !text-[10px]">Aantal</dt>
                    <dd className="font-mono tabular-nums">{card.quantity}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="label-mono !text-[10px]">Zekerheid</dt>
                    <dd className="tabular-nums">
                      {formatPercent(card.recognitionConfidence)}
                    </dd>
                  </div>
                  <div className="col-span-2 flex justify-between gap-2">
                    <dt className="label-mono !text-[10px]">Bandbreedte</dt>
                    <dd className="text-right font-mono tabular-nums">
                      {card.hasPriceData ? (
                        <>
                          {formatEuro(card.lineValue.low)} –{' '}
                          {formatEuro(card.lineValue.high)}
                        </>
                      ) : (
                        <span className="font-mono text-[var(--color-caution)]">
                          Onvoldoende marktdata
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="col-span-2 flex justify-between gap-2">
                    <dt className="label-mono !text-[10px]">Databron</dt>
                    <dd className="text-right">
                      {card.priceSourceName ?? '—'}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
