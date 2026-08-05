import { randomUUID } from 'node:crypto';
import type {
  AnalysisImage,
  AnalysisSession,
  AuditEvent,
  CardMatchCandidate,
  CatalogCard,
  CollectionItem,
  DetectedCard,
  Profile,
  StoredPriceEstimate,
} from '@/types/domain';
import type {
  ValtivoRepository,
  DetectedCardPatch,
  NewAnalysisImage,
  NewAnalysisSession,
  NewAuditEvent,
  NewCollectionItem,
  NewDetectedCard,
  NewMatchCandidate,
  SessionPatch,
} from './valtivo-repository';

/**
 * In-memory repository used when Supabase is not configured.
 *
 * Kept on `globalThis` so the Next.js dev server's module reloading does not
 * wipe an in-flight analysis. Data is intentionally not persisted to disk:
 * this is a development and test store, never a production one.
 */

type Store = {
  sessions: Map<string, AnalysisSession>;
  images: Map<string, AnalysisImage>;
  detectedCards: Map<string, DetectedCard>;
  candidates: Map<string, CardMatchCandidate>;
  catalog: Map<string, CatalogCard>;
  prices: Map<string, StoredPriceEstimate>;
  collection: Map<string, CollectionItem>;
  profiles: Map<string, Profile>;
  events: AuditEvent[];
};

const STORE_KEY = Symbol.for('valtivo-ai.in-memory-store');

function getStore(): Store {
  const globalRef = globalThis as unknown as Record<symbol, Store | undefined>;
  let store = globalRef[STORE_KEY];
  if (!store) {
    store = {
      sessions: new Map(),
      images: new Map(),
      detectedCards: new Map(),
      candidates: new Map(),
      catalog: new Map(),
      prices: new Map(),
      collection: new Map(),
      profiles: new Map(),
      events: [],
    };
    globalRef[STORE_KEY] = store;
  }
  return store;
}

/** Test helper: wipe every table. */
export function resetInMemoryStore(): void {
  const globalRef = globalThis as unknown as Record<symbol, Store | undefined>;
  globalRef[STORE_KEY] = undefined;
}

const nowIso = () => new Date().toISOString();

export class InMemoryValtivoRepository implements ValtivoRepository {
  readonly name = 'in-memory';

  private get store(): Store {
    return getStore();
  }

  // --- sessions ---

  async createSession(input: NewAnalysisSession): Promise<AnalysisSession> {
    const timestamp = nowIso();
    const session: AnalysisSession = {
      id: randomUUID(),
      userId: input.userId,
      guestToken: input.guestToken,
      ownerHash: input.ownerHash,
      status: 'created',
      statusDetail: null,
      totalImages: 0,
      detectedCardsCount: 0,
      confirmedCardsCount: 0,
      unknownCardsCount: 0,
      errorMessage: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      expiresAt: input.expiresAt,
    };
    this.store.sessions.set(session.id, session);
    return { ...session };
  }

  async getSession(sessionId: string): Promise<AnalysisSession | null> {
    const session = this.store.sessions.get(sessionId);
    return session ? { ...session } : null;
  }

  async updateSession(
    sessionId: string,
    patch: SessionPatch,
  ): Promise<AnalysisSession> {
    const session = this.store.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    const updated: AnalysisSession = {
      ...session,
      ...patch,
      updatedAt: nowIso(),
    };
    this.store.sessions.set(sessionId, updated);
    return { ...updated };
  }

  async listSessionsForUser(userId: string): Promise<AnalysisSession[]> {
    return [...this.store.sessions.values()]
      .filter((session) => session.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((session) => ({ ...session }));
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.store.sessions.delete(sessionId);
    for (const [id, image] of this.store.images) {
      if (image.analysisSessionId === sessionId) this.store.images.delete(id);
    }
    const removedCardIds = new Set<string>();
    for (const [id, card] of this.store.detectedCards) {
      if (card.analysisSessionId === sessionId) {
        removedCardIds.add(id);
        this.store.detectedCards.delete(id);
      }
    }
    for (const [id, candidate] of this.store.candidates) {
      if (removedCardIds.has(candidate.detectedCardId)) {
        this.store.candidates.delete(id);
      }
    }
    for (const [id, price] of this.store.prices) {
      if (removedCardIds.has(price.detectedCardId)) {
        this.store.prices.delete(id);
      }
    }
  }

  async countSessionsSince(
    owner: { userId: string } | { ownerHash: string },
    since: string,
    scope: 'all' | 'productive' = 'all',
  ): Promise<number> {
    return [...this.store.sessions.values()].filter((session) => {
      if (session.createdAt < since) return false;
      if (scope === 'productive' && session.detectedCardsCount <= 0) {
        return false;
      }
      return 'userId' in owner
        ? session.userId === owner.userId
        : session.ownerHash === owner.ownerHash;
    }).length;
  }

  async listExpiredGuestSessions(now: string): Promise<AnalysisSession[]> {
    return [...this.store.sessions.values()]
      .filter(
        (session) =>
          session.userId === null &&
          session.expiresAt !== null &&
          session.expiresAt < now,
      )
      .map((session) => ({ ...session }));
  }

  // --- images ---

  async addImage(input: NewAnalysisImage): Promise<AnalysisImage> {
    const image: AnalysisImage = {
      ...input,
      id: randomUUID(),
      createdAt: nowIso(),
    };
    this.store.images.set(image.id, image);
    return { ...image };
  }

  async listImages(sessionId: string): Promise<AnalysisImage[]> {
    return [...this.store.images.values()]
      .filter((image) => image.analysisSessionId === sessionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((image) => ({ ...image }));
  }

  async updateImage(
    imageId: string,
    patch: Partial<
      Pick<
        AnalysisImage,
        'processingStatus' | 'qualityScore' | 'qualityWarnings'
      >
    >,
  ): Promise<void> {
    const image = this.store.images.get(imageId);
    if (!image) return;
    this.store.images.set(imageId, { ...image, ...patch });
  }

  // --- detected cards ---

  async replaceDetectedCards(
    sessionId: string,
    cards: NewDetectedCard[],
  ): Promise<DetectedCard[]> {
    const removed = new Set<string>();
    for (const [id, card] of this.store.detectedCards) {
      if (card.analysisSessionId === sessionId) {
        removed.add(id);
        this.store.detectedCards.delete(id);
      }
    }
    for (const [id, candidate] of this.store.candidates) {
      if (removed.has(candidate.detectedCardId)) {
        this.store.candidates.delete(id);
      }
    }
    for (const [id, price] of this.store.prices) {
      if (removed.has(price.detectedCardId)) this.store.prices.delete(id);
    }

    const timestamp = nowIso();
    const created = cards.map((card) => {
      const record: DetectedCard = {
        ...card,
        id: randomUUID(),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      this.store.detectedCards.set(record.id, record);
      return { ...record };
    });
    return created;
  }

  async listDetectedCards(sessionId: string): Promise<DetectedCard[]> {
    return [...this.store.detectedCards.values()]
      .filter((card) => card.analysisSessionId === sessionId)
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
      .map((card) => ({ ...card }));
  }

  async getDetectedCard(detectedCardId: string): Promise<DetectedCard | null> {
    const card = this.store.detectedCards.get(detectedCardId);
    return card ? { ...card } : null;
  }

  async updateDetectedCard(
    detectedCardId: string,
    patch: DetectedCardPatch,
  ): Promise<DetectedCard> {
    const card = this.store.detectedCards.get(detectedCardId);
    if (!card) throw new Error(`Detected card ${detectedCardId} not found`);
    const updated: DetectedCard = { ...card, ...patch, updatedAt: nowIso() };
    this.store.detectedCards.set(detectedCardId, updated);
    return { ...updated };
  }

  async deleteDetectedCard(detectedCardId: string): Promise<void> {
    this.store.detectedCards.delete(detectedCardId);
    for (const [id, candidate] of this.store.candidates) {
      if (candidate.detectedCardId === detectedCardId) {
        this.store.candidates.delete(id);
      }
    }
    for (const [id, price] of this.store.prices) {
      if (price.detectedCardId === detectedCardId) this.store.prices.delete(id);
    }
  }

  // --- match candidates ---

  async replaceMatchCandidates(
    detectedCardId: string,
    candidates: NewMatchCandidate[],
  ): Promise<void> {
    for (const [id, candidate] of this.store.candidates) {
      if (candidate.detectedCardId === detectedCardId) {
        this.store.candidates.delete(id);
      }
    }
    for (const candidate of candidates) {
      const id = randomUUID();
      this.store.candidates.set(id, { ...candidate, id });
    }
  }

  async listMatchCandidates(sessionId: string): Promise<CardMatchCandidate[]> {
    const cardIds = new Set(
      [...this.store.detectedCards.values()]
        .filter((card) => card.analysisSessionId === sessionId)
        .map((card) => card.id),
    );
    return [...this.store.candidates.values()]
      .filter((candidate) => cardIds.has(candidate.detectedCardId))
      .sort((a, b) => a.rank - b.rank)
      .map((candidate) => ({ ...candidate }));
  }

  // --- catalog ---

  async upsertCatalogCards(cards: CatalogCard[]): Promise<void> {
    for (const card of cards) this.store.catalog.set(card.id, { ...card });
  }

  async getCatalogCard(catalogCardId: string): Promise<CatalogCard | null> {
    const card = this.store.catalog.get(catalogCardId);
    return card ? { ...card } : null;
  }

  async getCatalogCards(catalogCardIds: string[]): Promise<CatalogCard[]> {
    return catalogCardIds
      .map((id) => this.store.catalog.get(id))
      .filter((card): card is CatalogCard => card !== undefined)
      .map((card) => ({ ...card }));
  }

  // --- prices ---

  async savePriceEstimate(
    estimate: Omit<StoredPriceEstimate, 'id' | 'createdAt'>,
  ): Promise<StoredPriceEstimate> {
    for (const [id, existing] of this.store.prices) {
      if (existing.detectedCardId === estimate.detectedCardId) {
        this.store.prices.delete(id);
      }
    }
    const record: StoredPriceEstimate = {
      ...estimate,
      id: randomUUID(),
      createdAt: nowIso(),
    };
    this.store.prices.set(record.id, record);
    return { ...record };
  }

  async listPriceEstimates(sessionId: string): Promise<StoredPriceEstimate[]> {
    const cardIds = new Set(
      [...this.store.detectedCards.values()]
        .filter((card) => card.analysisSessionId === sessionId)
        .map((card) => card.id),
    );
    return [...this.store.prices.values()]
      .filter((price) => cardIds.has(price.detectedCardId))
      .map((price) => ({ ...price }));
  }

  // --- collection ---

  async listCollection(userId: string): Promise<CollectionItem[]> {
    return [...this.store.collection.values()]
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => ({ ...item }));
  }

  async addCollectionItem(input: NewCollectionItem): Promise<CollectionItem> {
    const existing = [...this.store.collection.values()].find(
      (item) =>
        item.userId === input.userId &&
        item.catalogCardId === input.catalogCardId &&
        item.conditionEstimate === input.conditionEstimate,
    );
    if (existing) {
      const merged: CollectionItem = {
        ...existing,
        quantity: existing.quantity + input.quantity,
        updatedAt: nowIso(),
      };
      this.store.collection.set(existing.id, merged);
      return { ...merged };
    }
    const timestamp = nowIso();
    const item: CollectionItem = {
      ...input,
      id: randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.store.collection.set(item.id, item);
    return { ...item };
  }

  async updateCollectionItem(
    itemId: string,
    userId: string,
    patch: Partial<
      Pick<CollectionItem, 'quantity' | 'notes' | 'conditionEstimate'>
    >,
  ): Promise<CollectionItem> {
    const item = this.store.collection.get(itemId);
    if (!item || item.userId !== userId) {
      throw new Error(`Collection item ${itemId} not found`);
    }
    const updated: CollectionItem = { ...item, ...patch, updatedAt: nowIso() };
    this.store.collection.set(itemId, updated);
    return { ...updated };
  }

  async deleteCollectionItem(itemId: string, userId: string): Promise<void> {
    const item = this.store.collection.get(itemId);
    if (item && item.userId === userId) this.store.collection.delete(itemId);
  }

  // --- profiles ---

  async getProfile(userId: string): Promise<Profile | null> {
    const profile = this.store.profiles.get(userId);
    return profile ? { ...profile } : null;
  }

  async upsertProfile(
    profile: Omit<Profile, 'createdAt' | 'updatedAt'>,
  ): Promise<Profile> {
    const existing = this.store.profiles.get(profile.id);
    const timestamp = nowIso();
    const record: Profile = {
      ...profile,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    this.store.profiles.set(record.id, record);
    return { ...record };
  }

  // --- audit ---

  async recordEvent(event: NewAuditEvent): Promise<AuditEvent> {
    const record: AuditEvent = {
      ...event,
      id: randomUUID(),
      createdAt: nowIso(),
    };
    this.store.events.push(record);
    // Bound the buffer so a long-running dev server cannot leak memory.
    if (this.store.events.length > 5000) this.store.events.splice(0, 1000);
    return { ...record };
  }
}
