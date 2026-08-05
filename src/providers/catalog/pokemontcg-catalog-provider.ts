import { serverConfig } from '@/config/env';
import { CatalogProviderError } from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';
import type {
  CardCatalogProvider,
  CardCatalogResult,
  CardSearchQuery,
} from '@/providers/types';
import type { CatalogCard } from '@/types/domain';
import { z } from 'zod';

/**
 * Adapter for the public Pokémon TCG API (https://pokemontcg.io).
 *
 * Read-only, documented, and usable without scraping. An API key is optional
 * but strongly recommended: anonymous requests are rate limited hard.
 */

const apiCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  number: z.string().optional(),
  rarity: z.string().nullish(),
  nationalPokedexNumbers: z.array(z.number()).nullish(),
  images: z
    .object({ small: z.string().nullish(), large: z.string().nullish() })
    .nullish(),
  set: z
    .object({
      id: z.string(),
      name: z.string(),
      ptcgoCode: z.string().nullish(),
      printedTotal: z.number().nullish(),
      releaseDate: z.string().nullish(),
    })
    .nullish(),
  tcgplayer: z.unknown().nullish(),
  cardmarket: z.unknown().nullish(),
});

const listResponseSchema = z.object({ data: z.array(apiCardSchema) });
const singleResponseSchema = z.object({ data: apiCardSchema });

type ApiCard = z.infer<typeof apiCardSchema>;

/** Backoff between retry attempts: 400ms, then 900ms. */
function delay(attempt: number): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, 400 + (attempt - 1) * 500),
  );
}

/** Treats "" as missing. `??` alone would happily return an empty string. */
function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return '';
}

function toCatalogCard(card: ApiCard): CatalogCard {
  const printedTotal = card.set?.printedTotal ?? null;
  const number = card.number ?? '';
  return {
    id: card.id,
    externalId: card.id,
    name: card.name,
    setId: card.set?.id ?? 'unknown',
    setName: card.set?.name ?? 'Onbekende set',
    // Several sets (Scarlet & Violet 151 among them) publish no ptcgoCode at
    // all, so the set id is the fallback the matcher scores against.
    setCode: firstNonEmpty(card.set?.ptcgoCode, card.set?.id),
    cardNumber: printedTotal ? `${number}/${printedTotal}` : number,
    rarity: card.rarity ?? null,
    variant: deriveVariant(card.rarity ?? null),
    // The API only publishes the English print run.
    language: 'en',
    imageSmallUrl: card.images?.small ?? null,
    imageLargeUrl: card.images?.large ?? null,
    releaseDate: card.set?.releaseDate?.replaceAll('/', '-') ?? null,
    pokedexNumber: card.nationalPokedexNumbers?.[0] ?? null,
    metadata: {
      cardmarket: card.cardmarket ?? null,
      tcgplayer: card.tcgplayer ?? null,
    },
  };
}

function deriveVariant(rarity: string | null): string | null {
  if (!rarity) return null;
  const lower = rarity.toLowerCase();
  if (lower.includes('illustration')) return 'special illustration rare';
  if (lower.includes('full art')) return 'full art';
  if (lower.includes('holo')) return 'holo';
  return lower;
}

function escapeQueryValue(value: string): string {
  return value.replace(/["\\]/g, '');
}

export class PokemonTcgCatalogProvider implements CardCatalogProvider {
  readonly name = 'pokemontcg-catalog';

  constructor(
    private readonly baseUrl = serverConfig.providers.catalog.baseUrl,
    private readonly apiKey = serverConfig.providers.catalog.apiKey,
  ) {}

  /**
   * Requests with a short backoff.
   *
   * The public API is generous but genuinely flaky without a key: a handful of
   * calls in quick succession start coming back as 429/502. Those are
   * transient, so retrying twice turns most of them into a normal response.
   * A 4xx that is not 429 is a real answer and is never retried.
   */
  private async request(path: string): Promise<unknown> {
    const url = `${this.baseUrl.replace(/\/$/, '')}${path}`;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.apiKey) headers['X-Api-Key'] = this.apiKey;

    const maxAttempts = 3;
    let lastStatus = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(12_000),
          next: { revalidate: 3600 },
        });
      } catch (error) {
        if (attempt === maxAttempts) {
          logger.error('Catalog request failed', error, {
            provider: this.name,
          });
          throw new CatalogProviderError('Catalog request failed');
        }
        await delay(attempt);
        continue;
      }

      if (response.ok) return response.json();

      lastStatus = response.status;
      const isTransient = response.status === 429 || response.status >= 500;
      if (!isTransient || attempt === maxAttempts) break;

      logger.warn('Catalog request transient failure, retrying', {
        provider: this.name,
        status: response.status,
        attempt,
      });
      await delay(attempt);
    }

    logger.warn('Catalog request returned non-OK status', {
      provider: this.name,
      status: lastStatus,
    });
    throw new CatalogProviderError(
      `Catalog responded with status ${lastStatus}`,
      { status: lastStatus },
    );
  }

  async searchCards(query: CardSearchQuery): Promise<CardCatalogResult[]> {
    const clauses: string[] = [];
    if (query.name) clauses.push(`name:"${escapeQueryValue(query.name)}*"`);
    if (query.cardNumber) {
      const left = query.cardNumber.split('/')[0]?.trim();
      if (left) clauses.push(`number:"${escapeQueryValue(left)}"`);
    }
    if (query.setCode) {
      clauses.push(`set.ptcgoCode:"${escapeQueryValue(query.setCode)}"`);
    }
    if (query.setName) {
      clauses.push(`set.name:"${escapeQueryValue(query.setName)}*"`);
    }
    if (query.pokedexNumber !== undefined) {
      clauses.push(`nationalPokedexNumbers:${query.pokedexNumber}`);
    }

    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const params = new URLSearchParams({
      pageSize: String(limit),
      orderBy: '-set.releaseDate',
    });
    if (clauses.length > 0) params.set('q', clauses.join(' '));

    const json = await this.request(`/cards?${params.toString()}`);
    const parsed = listResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new CatalogProviderError('Catalog returned an unexpected shape');
    }
    return parsed.data.data.map(toCatalogCard);
  }

  async getCardById(id: string): Promise<CatalogCard | null> {
    try {
      const json = await this.request(`/cards/${encodeURIComponent(id)}`);
      const parsed = singleResponseSchema.safeParse(json);
      if (!parsed.success) return null;
      return toCatalogCard(parsed.data.data);
    } catch (error) {
      if (
        error instanceof CatalogProviderError &&
        error.message.includes('404')
      ) {
        return null;
      }
      throw error;
    }
  }
}
