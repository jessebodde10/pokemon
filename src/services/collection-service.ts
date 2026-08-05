import { getProviders } from '@/providers/registry';
import { getRepository } from '@/repositories';
import { loadAuthorisedSession } from '@/services/analysis-access';
import { trackEvent } from '@/services/analytics';
import {
  EMPTY_RANGE,
  multiplyRange,
  sumRanges,
} from '@/features/report/totals';
import type { CatalogCard, CollectionItem } from '@/types/domain';
import type { ValueRange } from '@/types/report';

/**
 * Collection service. Only logged-in users have a collection; guests get a
 * temporary report and an invitation to create an account.
 */

export type CollectionEntry = {
  item: CollectionItem;
  catalogCard: CatalogCard | null;
  unitValue: ValueRange;
  lineValue: ValueRange;
  priceSourceName: string | null;
  priceUpdatedAt: string | null;
  hasPriceData: boolean;
};

export type CollectionOverview = {
  entries: CollectionEntry[];
  totalValue: ValueRange;
  uniqueCards: number;
  totalCards: number;
  missingPriceData: number;
  bySet: Array<{ setName: string; cards: number; value: ValueRange }>;
  topCards: CollectionEntry[];
  lastUpdatedAt: string | null;
};

/** Copies every confirmed card of an analysis into the user's collection. */
export async function addConfirmedCardsToCollection(input: {
  sessionId: string;
  userId: string;
}): Promise<number> {
  const repository = getRepository();
  const session = await loadAuthorisedSession(input.sessionId, {
    userId: input.userId,
    guestToken: null,
  });

  const cards = await repository.listDetectedCards(session.id);
  const confirmed = cards.filter(
    (card) =>
      card.selectedCatalogCardId !== null &&
      (card.reviewStatus === 'confirmed' || card.reviewStatus === 'corrected'),
  );

  let added = 0;
  for (const card of confirmed) {
    if (!card.selectedCatalogCardId) continue;
    await repository.addCollectionItem({
      userId: input.userId,
      catalogCardId: card.selectedCatalogCardId,
      quantity: card.quantity,
      conditionEstimate: card.conditionEstimate,
      sourceAnalysisSessionId: session.id,
      notes: null,
    });
    added += 1;
  }

  if (added > 0) {
    await repository.recordEvent({
      userId: input.userId,
      analysisSessionId: session.id,
      eventType: 'collection_item_added',
      metadata: { count: added },
    });
    trackEvent('collection_item_added', { count: added });
  }
  return added;
}

export async function getCollectionOverview(
  userId: string,
): Promise<CollectionOverview> {
  const repository = getRepository();
  const providers = getProviders();
  const items = await repository.listCollection(userId);

  const catalogIds = [...new Set(items.map((item) => item.catalogCardId))];
  const catalogCards = await repository.getCatalogCards(catalogIds);
  const catalogById = new Map(catalogCards.map((card) => [card.id, card]));

  const entries: CollectionEntry[] = [];
  const priceCache = new Map<
    string,
    Awaited<ReturnType<typeof providers.pricing.getPriceEstimate>> | null
  >();

  for (const item of items) {
    const catalogCard = catalogById.get(item.catalogCardId) ?? null;
    let estimate = priceCache.get(item.catalogCardId);

    if (estimate === undefined) {
      estimate = catalogCard
        ? await providers.pricing
            .getPriceEstimate({ catalogCard, conditionBasis: 'ungraded' })
            .catch(() => null)
        : null;
      priceCache.set(item.catalogCardId, estimate);
    }

    const unitValue: ValueRange = estimate
      ? {
          currency: 'EUR',
          low: estimate.low,
          mid: estimate.mid,
          high: estimate.high,
        }
      : EMPTY_RANGE;

    entries.push({
      item,
      catalogCard,
      unitValue,
      lineValue: multiplyRange(unitValue, item.quantity),
      priceSourceName: estimate?.sourceName ?? null,
      priceUpdatedAt: estimate?.lastUpdatedAt ?? null,
      hasPriceData: estimate?.mid != null,
    });
  }

  const bySetMap = new Map<string, { cards: number; ranges: ValueRange[] }>();
  for (const entry of entries) {
    const setName = entry.catalogCard?.setName ?? 'Onbekende set';
    const bucket = bySetMap.get(setName) ?? { cards: 0, ranges: [] };
    bucket.cards += entry.item.quantity;
    bucket.ranges.push(entry.lineValue);
    bySetMap.set(setName, bucket);
  }

  return {
    entries,
    totalValue: sumRanges(entries.map((entry) => entry.lineValue)),
    uniqueCards: entries.length,
    totalCards: entries.reduce((sum, entry) => sum + entry.item.quantity, 0),
    missingPriceData: entries.filter((entry) => !entry.hasPriceData).length,
    bySet: [...bySetMap.entries()]
      .map(([setName, bucket]) => ({
        setName,
        cards: bucket.cards,
        value: sumRanges(bucket.ranges),
      }))
      .sort((a, b) => (b.value.mid ?? 0) - (a.value.mid ?? 0)),
    topCards: [...entries]
      .filter((entry) => entry.lineValue.mid !== null)
      .sort((a, b) => (b.lineValue.mid ?? 0) - (a.lineValue.mid ?? 0))
      .slice(0, 10),
    lastUpdatedAt:
      entries
        .map((entry) => entry.priceUpdatedAt)
        .filter((value): value is string => value !== null)
        .sort()
        .at(-1) ?? null,
  };
}

export async function removeCollectionItem(input: {
  itemId: string;
  userId: string;
}): Promise<void> {
  await getRepository().deleteCollectionItem(input.itemId, input.userId);
}
