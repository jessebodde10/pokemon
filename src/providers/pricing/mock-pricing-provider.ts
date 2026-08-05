import { serverConfig } from '@/config/env';
import { PricingProviderError } from '@/lib/errors/app-error';
import {
  computePriceStatistics,
  type PriceObservation,
} from '@/features/pricing/statistics';
import { createSeededRandom, seededFloat } from '@/lib/random/seeded';
import {
  NO_PRICE_DATA_CARD_KEY,
  demoPriceAnchor,
} from '@/providers/catalog/fixtures';
import type { PricingProvider, PricingRequest } from '@/providers/types';
import type { CatalogCard, PriceEstimate } from '@/types/domain';

export const MOCK_PRICE_SOURCE_NAME = 'Pokora AI demodata';

/**
 * Simulated marketplace observations.
 *
 * The provider generates raw observations and then runs them through the exact
 * same statistics module the real adapters use, so "not enough data" behaves
 * identically in mock mode and in production.
 */
export class MockPricingProvider implements PricingProvider {
  readonly name = 'mock-pricing';

  async getPriceEstimate(input: PricingRequest): Promise<PriceEstimate> {
    if (serverConfig.devForceProviderError === 'pricing') {
      throw new PricingProviderError('Forced pricing failure (dev)');
    }

    const { catalogCard } = input;
    const observations = generateObservations(catalogCard);
    const stats = computePriceStatistics(observations);

    const warnings = [...stats.warnings];
    if (serverConfig.appMode === 'mock') {
      warnings.push('Demodata: geen echte marktwaarnemingen');
    }

    return {
      currency: 'EUR',
      low: stats.low,
      mid: stats.mid,
      high: stats.high,
      sampleSize: stats.sampleSize,
      sourceName: MOCK_PRICE_SOURCE_NAME,
      sourceUrl: undefined,
      lastUpdatedAt: stats.newestObservationAt ?? new Date().toISOString(),
      conditionBasis: input.conditionBasis ?? 'ungraded',
      confidence: stats.confidence,
      warnings,
    };
  }
}

/**
 * Deterministic observation generator.
 *
 * `NO_PRICE_DATA_CARD_KEY` intentionally produces too few observations so the
 * "Onvoldoende marktdata" path is always represented in the demo report.
 */
export function generateObservations(
  card: CatalogCard,
  now: Date = new Date(),
): PriceObservation[] {
  const anchor = demoPriceAnchor(card);
  if (!anchor) return [];

  const isThinMarketDemo = card.id === NO_PRICE_DATA_CARD_KEY;
  const count = isThinMarketDemo ? 2 : anchor.sampleSize;
  const random = createSeededRandom(`price:${card.id}`);

  const observations: PriceObservation[] = [];
  for (let i = 0; i < count; i += 1) {
    // Base spread widens for expensive, thinly traded cards.
    const spread = anchor.anchorEur > 100 ? 0.28 : 0.16;
    let price = anchor.anchorEur * seededFloat(random, 1 - spread, 1 + spread);

    // Occasional extreme listing so outlier filtering has something to remove.
    if (random() < 0.05) price *= seededFloat(random, 2.2, 3.4);

    const ageDays = seededFloat(random, 0, 110);
    observations.push({
      priceEur: Math.round(price * 100) / 100,
      observedAt: new Date(now.getTime() - ageDays * 86_400_000).toISOString(),
    });
  }
  return observations;
}
