import { serverConfig } from '@/config/env';
import { CatalogProviderError } from '@/lib/errors/app-error';
import { normaliseText, similarity } from '@/features/card-catalog/matching';
import type {
  CardCatalogProvider,
  CardCatalogResult,
  CardSearchQuery,
} from '@/providers/types';
import type { CatalogCard } from '@/types/domain';
import { DEMO_CATALOG_BY_ID, DEMO_CATALOG_CARDS } from './fixtures';

const DEFAULT_LIMIT = 20;

/** In-memory catalog backed by the deterministic demo fixture set. */
export class MockCardCatalogProvider implements CardCatalogProvider {
  readonly name = 'mock-catalog';

  private assertHealthy(): void {
    if (serverConfig.devForceProviderError === 'catalog') {
      throw new CatalogProviderError('Forced catalog failure (dev)');
    }
  }

  async searchCards(query: CardSearchQuery): Promise<CardCatalogResult[]> {
    this.assertHealthy();
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), 50);

    const scored = DEMO_CATALOG_CARDS.map((card) => ({
      card,
      score: scoreAgainstQuery(card, query),
    })).filter((entry) => entry.score > 0);

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.card.id.localeCompare(b.card.id);
    });

    return scored.slice(0, limit).map((entry) => entry.card);
  }

  async getCardById(id: string): Promise<CatalogCard | null> {
    this.assertHealthy();
    return DEMO_CATALOG_BY_ID.get(id) ?? null;
  }
}

function scoreAgainstQuery(card: CatalogCard, query: CardSearchQuery): number {
  const clauses: number[] = [];

  if (query.name) {
    const normalisedQuery = normaliseText(query.name);
    const normalisedName = normaliseText(card.name);
    const prefixHit = normalisedName.startsWith(normalisedQuery) ? 1 : 0;
    const containsHit = normalisedName.includes(normalisedQuery) ? 0.9 : 0;
    const fuzzy = similarity(query.name, card.name);
    clauses.push(Math.max(prefixHit, containsHit, fuzzy >= 0.6 ? fuzzy : 0));
  }

  if (query.cardNumber) {
    const wanted = query.cardNumber.trim().toUpperCase().replace(/\s+/g, '');
    const actual = card.cardNumber.toUpperCase();
    const wantedLeft = wanted.split('/')[0] ?? wanted;
    const actualLeft = actual.split('/')[0] ?? actual;
    const strippedWanted = wantedLeft.replace(/^0+(?=\d)/, '');
    const strippedActual = actualLeft.replace(/^0+(?=\d)/, '');
    clauses.push(strippedWanted === strippedActual ? 1 : 0);
  }

  if (query.setCode) {
    clauses.push(
      normaliseText(query.setCode) === normaliseText(card.setCode) ? 1 : 0,
    );
  }

  if (query.setName) {
    clauses.push(similarity(query.setName, card.setName) >= 0.5 ? 1 : 0);
  }

  if (query.pokedexNumber !== undefined) {
    clauses.push(card.pokedexNumber === query.pokedexNumber ? 1 : 0);
  }

  if (query.language && query.language !== 'unknown') {
    clauses.push(card.language === query.language ? 1 : 0);
  }

  // An empty query lists the catalog; a query with no matching clause is a miss.
  if (clauses.length === 0) return 0.1;
  if (clauses.some((score) => score === 0)) return 0;
  return clauses.reduce((sum, score) => sum + score, 0) / clauses.length;
}
