/**
 * Core domain types shared by providers, repositories, services and the UI.
 * These are storage-agnostic on purpose: the Supabase and in-memory
 * repositories both map onto them.
 */

export const ANALYSIS_STATUSES = [
  'created',
  'uploading',
  'processing',
  'needs_review',
  'completed',
  'failed',
] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const REVIEW_STATUSES = [
  'pending',
  'confirmed',
  'corrected',
  'unknown',
  'removed',
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const CONDITION_ESTIMATES = [
  'unknown',
  'possibly_near_mint',
  'possibly_lightly_played',
  'visibly_damaged',
  'needs_better_photo',
] as const;
export type ConditionEstimate = (typeof CONDITION_ESTIMATES)[number];

export const CONDITION_BASES = [
  'ungraded',
  'near_mint_assumed',
  'unknown',
] as const;
export type ConditionBasis = (typeof CONDITION_BASES)[number];

export const IMAGE_PROCESSING_STATUSES = [
  'pending',
  'processing',
  'processed',
  'failed',
  'needs_manual_review',
] as const;
export type ImageProcessingStatus = (typeof IMAGE_PROCESSING_STATUSES)[number];

export const SUPPORTED_LANGUAGES = ['en', 'nl', 'unknown'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Normalised bounding box; every value lies between 0 and 1. */
export type CardRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AnalysisSession = {
  id: string;
  userId: string | null;
  guestToken: string | null;
  /** Salted hash of the requester identity; used for rate limiting only. */
  ownerHash: string | null;
  status: AnalysisStatus;
  statusDetail: string | null;
  totalImages: number;
  detectedCardsCount: number;
  confirmedCardsCount: number;
  unknownCardsCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  expiresAt: string | null;
};

export type AnalysisImage = {
  id: string;
  analysisSessionId: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  processingStatus: ImageProcessingStatus;
  qualityScore: number | null;
  qualityWarnings: string[];
  createdAt: string;
};

export type DetectedCard = {
  id: string;
  analysisSessionId: string;
  analysisImageId: string;
  /**
   * Stable display order within the analysis. Rows inserted in one batch share
   * a timestamp and carry random ids, so an explicit ordinal is the only way
   * to keep the review list in a predictable order.
   */
  position: number;
  cropStoragePath: string | null;
  region: CardRegion;
  visibleName: string | null;
  visibleCardNumber: string | null;
  detectedLanguage: SupportedLanguage | null;
  variantHints: string[];
  recognitionConfidence: number | null;
  selectedCatalogCardId: string | null;
  reviewStatus: ReviewStatus;
  userConfirmed: boolean;
  conditionEstimate: ConditionEstimate;
  quantity: number;
  createdAt: string;
  updatedAt: string;
};

export type CatalogCard = {
  id: string;
  externalId: string;
  name: string;
  setId: string;
  setName: string;
  setCode: string;
  cardNumber: string;
  rarity: string | null;
  variant: string | null;
  language: SupportedLanguage;
  imageSmallUrl: string | null;
  imageLargeUrl: string | null;
  releaseDate: string | null;
  pokedexNumber: number | null;
  metadata: Record<string, unknown>;
};

export type MatchReason = {
  factor:
    | 'card_number'
    | 'name'
    | 'set'
    | 'variant'
    | 'language'
    | 'release_date';
  weight: number;
  score: number;
  detail: string;
};

export type CardMatchCandidate = {
  id: string;
  detectedCardId: string;
  catalogCardId: string;
  matchScore: number;
  matchReasons: MatchReason[];
  rank: number;
};

export type PriceEstimate = {
  currency: 'EUR';
  low: number | null;
  mid: number | null;
  high: number | null;
  sampleSize: number;
  sourceName: string;
  sourceUrl?: string;
  lastUpdatedAt: string;
  conditionBasis: ConditionBasis;
  confidence: number;
  warnings: string[];
};

export type StoredPriceEstimate = PriceEstimate & {
  id: string;
  detectedCardId: string;
  catalogCardId: string | null;
  createdAt: string;
};

export type CollectionItem = {
  id: string;
  userId: string;
  catalogCardId: string;
  quantity: number;
  conditionEstimate: ConditionEstimate;
  sourceAnalysisSessionId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Profile = {
  id: string;
  displayName: string | null;
  locale: string;
  createdAt: string;
  updatedAt: string;
};

export const AUDIT_EVENT_TYPES = [
  'analysis_started',
  'image_uploaded',
  'analysis_completed',
  'analysis_failed',
  'card_match_confirmed',
  'card_match_corrected',
  'card_removed',
  'card_marked_unknown',
  'report_viewed',
  'prices_refreshed',
  'signup_started',
  'signup_completed',
  'collection_item_added',
  'analysis_deleted',
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export type AuditEvent = {
  id: string;
  userId: string | null;
  analysisSessionId: string | null;
  eventType: AuditEventType;
  metadata: Record<string, unknown>;
  createdAt: string;
};

/** A detected card joined with everything the UI needs to render it. */
export type DetectedCardView = {
  card: DetectedCard;
  image: Pick<AnalysisImage, 'id' | 'storagePath' | 'originalFilename'> | null;
  selectedCatalogCard: CatalogCard | null;
  candidates: Array<{
    candidate: CardMatchCandidate;
    catalogCard: CatalogCard | null;
  }>;
  priceEstimate: StoredPriceEstimate | null;
};
