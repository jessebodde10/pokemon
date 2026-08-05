import { z } from 'zod';
import type { PricingProvider, PricingRequest } from '@/providers/types';
import type { PriceEstimate } from '@/types/domain';

/**
 * Pricing adapter that reads the Cardmarket aggregates published alongside
 * each card by the Pokémon TCG API. No scraping is involved: the values are
 * part of the documented API response and are already denominated in EUR.
 *
 * Important limitation, surfaced to the user as a warning: the API publishes
 * aggregates, not individual observations, so `sampleSize` is unknown (0) and
 * the confidence score is capped accordingly.
 */

const cardmarketSchema = z.object({
  url: z.string().nullish(),
  updatedAt: z.string().nullish(),
  prices: z
    .object({
      lowPrice: z.number().nullish(),
      trendPrice: z.number().nullish(),
      averageSellPrice: z.number().nullish(),
      avg7: z.number().nullish(),
      avg30: z.number().nullish(),
      reverseHoloTrend: z.number().nullish(),
      reverseHoloLow: z.number().nullish(),
      reverseHoloAvg30: z.number().nullish(),
    })
    .nullish(),
});

export const CARDMARKET_SOURCE_NAME = 'Cardmarket (via Pokémon TCG API)';

const NO_DATA: Omit<PriceEstimate, 'conditionBasis'> = {
  currency: 'EUR',
  low: null,
  mid: null,
  high: null,
  sampleSize: 0,
  sourceName: CARDMARKET_SOURCE_NAME,
  lastUpdatedAt: '',
  confidence: 0,
  warnings: ['Onvoldoende marktdata voor deze kaart bij deze bron'],
};

export class PokemonTcgPricingProvider implements PricingProvider {
  readonly name = 'pokemontcg-pricing';

  async getPriceEstimate(input: PricingRequest): Promise<PriceEstimate> {
    const conditionBasis = input.conditionBasis ?? 'ungraded';
    const parsed = cardmarketSchema.safeParse(
      input.catalogCard.metadata.cardmarket,
    );
    if (!parsed.success || !parsed.data.prices) {
      return { ...NO_DATA, conditionBasis, lastUpdatedAt: nowIso() };
    }

    const isReverse = (input.catalogCard.variant ?? '').includes('reverse');
    const prices = parsed.data.prices;

    const low = isReverse
      ? (prices.reverseHoloLow ?? prices.lowPrice ?? null)
      : (prices.lowPrice ?? null);
    const mid = isReverse
      ? (prices.reverseHoloTrend ?? prices.trendPrice ?? null)
      : (prices.trendPrice ?? prices.averageSellPrice ?? null);
    const highCandidates = [
      isReverse ? prices.reverseHoloAvg30 : prices.avg30,
      prices.avg7,
      prices.averageSellPrice,
      mid,
    ].filter((value): value is number => typeof value === 'number');
    const high = highCandidates.length > 0 ? Math.max(...highCandidates) : null;

    if (mid === null) {
      return { ...NO_DATA, conditionBasis, lastUpdatedAt: nowIso() };
    }

    const warnings = [
      'Bron publiceert aggregaten; het exacte aantal waarnemingen is niet beschikbaar.',
    ];
    const lastUpdatedAt = parsed.data.updatedAt
      ? new Date(parsed.data.updatedAt.replaceAll('/', '-')).toISOString()
      : nowIso();

    const ageDays = (Date.now() - Date.parse(lastUpdatedAt)) / 86_400_000;
    if (Number.isFinite(ageDays) && ageDays > 14) {
      warnings.push('De prijsgegevens van deze bron zijn ouder dan 14 dagen.');
    }
    const spread =
      low !== null && high !== null && mid > 0 ? (high - low) / mid : null;
    if (spread !== null && spread > 0.6) {
      warnings.push('De gevonden prijsdata lopen sterk uiteen.');
    }

    // Capped at 0.7: without observation counts we cannot claim more.
    const confidence =
      Math.round(
        Math.max(
          0,
          Math.min(
            0.7,
            0.7 - (spread ?? 0.2) * 0.3 - Math.max(0, ageDays) / 200,
          ),
        ) * 100,
      ) / 100;

    return {
      currency: 'EUR',
      low: round(low),
      mid: round(mid),
      high: round(high),
      sampleSize: 0,
      sourceName: CARDMARKET_SOURCE_NAME,
      sourceUrl: parsed.data.url ?? undefined,
      lastUpdatedAt,
      conditionBasis,
      confidence,
      warnings,
    };
  }
}

function round(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}

function nowIso(): string {
  return new Date().toISOString();
}
