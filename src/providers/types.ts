import type {
  CardRegion,
  CatalogCard,
  ConditionBasis,
  PriceEstimate,
  SupportedLanguage,
} from '@/types/domain';

/**
 * Provider contracts. Everything that reaches outside the application - vision
 * models, card catalogs, price sources - is expressed as one of these four
 * interfaces so an adapter can be swapped without touching services.
 */

export type DetectedCardRegion = {
  region: CardRegion;
  /** 0..1 confidence that this region actually contains a card. */
  detectionConfidence: number;
  qualityWarnings: string[];
};

export interface CardDetectionProvider {
  readonly name: string;
  detectCards(imageUrl: string): Promise<DetectedCardRegion[]>;
}

export type CardRecognitionInput = {
  imageUrl: string;
  region?: CardRegion;
  /** Optional hint so a provider can prefer a language when ambiguous. */
  preferredLanguage?: SupportedLanguage;
};

export type CardRecognitionResult = {
  visibleName: string | null;
  visibleCardNumber: string | null;
  possibleSetCode: string | null;
  language: SupportedLanguage;
  variantHints: string[];
  recognitionConfidence: number;
  imageQualityWarnings: string[];
};

/**
 * Stable identity of the image being recognised.
 *
 * Storage paths are randomised for security, so they cannot be used as a
 * cache or seed key. This context gives providers something durable: real
 * adapters can use it for caching or tracing, and the mock uses it to stay
 * reproducible across runs.
 */
export type RecognitionContext = {
  imageId: string;
  /** Zero-based position of this image within the analysis. */
  imageIndex: number;
  /**
   * Reads the image bytes straight from storage.
   *
   * Without this a provider can only fetch the signed URL, which means the
   * image has to be reachable from the outside - so local development storage
   * would be unusable and a vision model would require a hosted bucket just to
   * see the photo. Providers should prefer this over fetching the URL.
   */
  loadImage?: () => Promise<{ bytes: Uint8Array; mediaType: string }>;
};

export interface CardRecognitionProvider {
  readonly name: string;
  recognizeCard(input: CardRecognitionInput): Promise<CardRecognitionResult>;
  /**
   * Optional single-pass detect + recognise. Vision models can do both at
   * once, which is cheaper and more accurate than cropping first.
   */
  recognizeImage?(
    imageUrl: string,
    context: RecognitionContext,
  ): Promise<Array<CardRecognitionResult & { region: CardRegion }>>;
}

export type CardSearchQuery = {
  name?: string;
  setName?: string;
  setCode?: string;
  cardNumber?: string;
  pokedexNumber?: number;
  language?: SupportedLanguage;
  limit?: number;
};

export type CardCatalogResult = CatalogCard;

export interface CardCatalogProvider {
  readonly name: string;
  searchCards(query: CardSearchQuery): Promise<CardCatalogResult[]>;
  getCardById(id: string): Promise<CatalogCard | null>;
}

export type PricingRequest = {
  catalogCard: CatalogCard;
  conditionBasis?: ConditionBasis;
};

export interface PricingProvider {
  readonly name: string;
  getPriceEstimate(input: PricingRequest): Promise<PriceEstimate>;
}

export type ProviderBundle = {
  detection: CardDetectionProvider;
  recognition: CardRecognitionProvider;
  catalog: CardCatalogProvider;
  pricing: PricingProvider;
};
