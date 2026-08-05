import type {
  CardRegion,
  ConditionEstimate,
  ReviewStatus,
  SupportedLanguage,
} from './domain';

export type ValueRange = {
  low: number | null;
  mid: number | null;
  high: number | null;
  currency: 'EUR';
};

export const ATTENTION_REASON_CODES = [
  'high_estimated_value',
  'wide_price_spread',
  'stale_price_data',
  'insufficient_price_data',
  'low_recognition_confidence',
  'possible_rare_variant',
  'needs_dedicated_photo',
  'set_or_number_unconfirmed',
] as const;
export type AttentionReasonCode = (typeof ATTENTION_REASON_CODES)[number];

export type AttentionReason = {
  code: AttentionReasonCode;
  /** Neutral, non-advisory message shown to the user. */
  message: string;
};

export type ReportCard = {
  detectedCardId: string;
  name: string;
  setName: string | null;
  setCode: string | null;
  cardNumber: string | null;
  variant: string | null;
  language: SupportedLanguage | null;
  imageUrl: string | null;
  cropUrl: string | null;
  region: CardRegion;
  quantity: number;
  reviewStatus: ReviewStatus;
  userConfirmed: boolean;
  recognitionConfidence: number | null;
  conditionEstimate: ConditionEstimate;
  /** Per-unit estimate as returned by the pricing provider. */
  unitValue: ValueRange;
  /** unitValue multiplied by quantity; null stays null, never 0. */
  lineValue: ValueRange;
  priceSourceName: string | null;
  priceSourceUrl: string | null;
  priceUpdatedAt: string | null;
  priceSampleSize: number;
  priceConfidence: number | null;
  priceWarnings: string[];
  hasPriceData: boolean;
  attentionReasons: AttentionReason[];
};

export type DataQualityFactor = {
  key:
    | 'recognition_confidence'
    | 'manual_confirmation'
    | 'price_sample_size'
    | 'price_recency'
    | 'source_agreement'
    | 'image_quality'
    | 'variant_known'
    | 'language_known';
  label: string;
  /** 0..1 */
  score: number;
  /** Relative weight used in the weighted average. */
  weight: number;
  detail: string;
};

export type DataQuality = {
  /** 0..100, rule-based; never produced by a language model. */
  score: number;
  band: 'low' | 'medium' | 'high';
  factors: DataQualityFactor[];
  explanation: string;
};

export type ReportSummary = {
  totalDetected: number;
  totalConfirmed: number;
  totalUnknown: number;
  totalRemoved: number;
  totalPending: number;
  cardsWithoutPriceData: number;
  /** Totals only ever include confirmed / corrected cards. */
  totalValue: ValueRange;
  lastUpdatedAt: string | null;
  generatedAt: string;
};

export type ReportNarrative = {
  headline: string;
  summary: string;
  highlights: string[];
  cautions: string[];
};

export type CollectionReport = {
  sessionId: string;
  status: string;
  summary: ReportSummary;
  dataQuality: DataQuality;
  topCards: ReportCard[];
  attentionCards: ReportCard[];
  allCards: ReportCard[];
  unknownCards: ReportCard[];
  warnings: string[];
  narrative: ReportNarrative;
};
