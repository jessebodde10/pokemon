import type {
  AnalysisImage,
  AnalysisSession,
  AnalysisStatus,
  AuditEvent,
  AuditEventType,
  CardMatchCandidate,
  CatalogCard,
  CollectionItem,
  DetectedCard,
  Profile,
  StoredPriceEstimate,
} from '@/types/domain';

/**
 * Data access contract.
 *
 * Two implementations exist: Supabase (production) and in-memory (local
 * development, unit and e2e tests). Services depend only on this interface.
 */

export type NewAnalysisSession = {
  userId: string | null;
  guestToken: string | null;
  ownerHash: string | null;
  expiresAt: string | null;
};

export type SessionPatch = Partial<
  Pick<
    AnalysisSession,
    | 'status'
    | 'statusDetail'
    | 'totalImages'
    | 'detectedCardsCount'
    | 'confirmedCardsCount'
    | 'unknownCardsCount'
    | 'errorMessage'
    | 'completedAt'
  >
>;

export type NewAnalysisImage = Omit<AnalysisImage, 'id' | 'createdAt'>;

export type NewDetectedCard = Omit<
  DetectedCard,
  'id' | 'createdAt' | 'updatedAt'
>;

export type DetectedCardPatch = Partial<
  Pick<
    DetectedCard,
    | 'selectedCatalogCardId'
    | 'reviewStatus'
    | 'userConfirmed'
    | 'conditionEstimate'
    | 'quantity'
    | 'visibleName'
    | 'visibleCardNumber'
  >
>;

export type NewMatchCandidate = Omit<CardMatchCandidate, 'id'>;

export type NewCollectionItem = Omit<
  CollectionItem,
  'id' | 'createdAt' | 'updatedAt'
>;

export type NewAuditEvent = {
  userId: string | null;
  analysisSessionId: string | null;
  eventType: AuditEventType;
  metadata: Record<string, unknown>;
};

export interface ValtivoRepository {
  readonly name: string;

  // --- sessions ---
  createSession(input: NewAnalysisSession): Promise<AnalysisSession>;
  getSession(sessionId: string): Promise<AnalysisSession | null>;
  updateSession(
    sessionId: string,
    patch: SessionPatch,
  ): Promise<AnalysisSession>;
  listSessionsForUser(userId: string): Promise<AnalysisSession[]>;
  deleteSession(sessionId: string): Promise<void>;
  /**
   * Counts analyses in a rolling window.
   *
   * `scope: 'productive'` counts only sessions that actually detected a card.
   * A run that failed, or that found nothing on a bad photo, gave the user no
   * value and must not consume their quota — otherwise one blurry first photo
   * locks a guest out for a full day.
   */
  countSessionsSince(
    owner: { userId: string } | { ownerHash: string },
    since: string,
    scope?: 'all' | 'productive',
  ): Promise<number>;
  listExpiredGuestSessions(now: string): Promise<AnalysisSession[]>;

  // --- images ---
  addImage(input: NewAnalysisImage): Promise<AnalysisImage>;
  listImages(sessionId: string): Promise<AnalysisImage[]>;
  updateImage(
    imageId: string,
    patch: Partial<
      Pick<
        AnalysisImage,
        'processingStatus' | 'qualityScore' | 'qualityWarnings'
      >
    >,
  ): Promise<void>;

  // --- detected cards ---
  replaceDetectedCards(
    sessionId: string,
    cards: NewDetectedCard[],
  ): Promise<DetectedCard[]>;
  listDetectedCards(sessionId: string): Promise<DetectedCard[]>;
  getDetectedCard(detectedCardId: string): Promise<DetectedCard | null>;
  updateDetectedCard(
    detectedCardId: string,
    patch: DetectedCardPatch,
  ): Promise<DetectedCard>;
  deleteDetectedCard(detectedCardId: string): Promise<void>;

  // --- match candidates ---
  replaceMatchCandidates(
    detectedCardId: string,
    candidates: NewMatchCandidate[],
  ): Promise<void>;
  listMatchCandidates(sessionId: string): Promise<CardMatchCandidate[]>;

  // --- catalog cache ---
  upsertCatalogCards(cards: CatalogCard[]): Promise<void>;
  getCatalogCard(catalogCardId: string): Promise<CatalogCard | null>;
  getCatalogCards(catalogCardIds: string[]): Promise<CatalogCard[]>;

  // --- prices ---
  savePriceEstimate(
    estimate: Omit<StoredPriceEstimate, 'id' | 'createdAt'>,
  ): Promise<StoredPriceEstimate>;
  listPriceEstimates(sessionId: string): Promise<StoredPriceEstimate[]>;

  // --- collection ---
  listCollection(userId: string): Promise<CollectionItem[]>;
  addCollectionItem(input: NewCollectionItem): Promise<CollectionItem>;
  updateCollectionItem(
    itemId: string,
    userId: string,
    patch: Partial<
      Pick<CollectionItem, 'quantity' | 'notes' | 'conditionEstimate'>
    >,
  ): Promise<CollectionItem>;
  deleteCollectionItem(itemId: string, userId: string): Promise<void>;

  // --- profiles ---
  getProfile(userId: string): Promise<Profile | null>;
  upsertProfile(
    profile: Omit<Profile, 'createdAt' | 'updatedAt'>,
  ): Promise<Profile>;

  // --- audit ---
  recordEvent(event: NewAuditEvent): Promise<AuditEvent>;
}

export const TERMINAL_STATUSES: AnalysisStatus[] = ['completed', 'failed'];
