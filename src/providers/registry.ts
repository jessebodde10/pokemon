import { serverConfig } from '@/config/env';
import { logger } from '@/lib/logging/logger';
import { MockCardDetectionProvider } from './detection/mock-detection-provider';
import { MockCardRecognitionProvider } from './recognition/mock-recognition-provider';
import { VisionCardRecognitionProvider } from './recognition/vision-recognition-provider';
import { MockCardCatalogProvider } from './catalog/mock-catalog-provider';
import { PokemonTcgCatalogProvider } from './catalog/pokemontcg-catalog-provider';
import { MockPricingProvider } from './pricing/mock-pricing-provider';
import { PokemonTcgPricingProvider } from './pricing/pokemontcg-pricing-provider';
import type {
  CardCatalogProvider,
  CardDetectionProvider,
  CardRecognitionProvider,
  PricingProvider,
  ProviderBundle,
} from './types';

/**
 * Resolves the active provider bundle.
 *
 * Each provider falls back to its mock independently: a missing pricing key
 * must not take down recognition. APP_MODE=mock forces mocks everywhere.
 */

let cached: ProviderBundle | null = null;

function resolveRecognition(): CardRecognitionProvider {
  const { kind, apiKey } = serverConfig.providers.vision;
  if (serverConfig.appMode === 'mock' || kind === 'mock') {
    return new MockCardRecognitionProvider();
  }
  if (!apiKey) {
    logger.warn('Vision provider configured without API key; using mock', {
      kind,
    });
    return new MockCardRecognitionProvider();
  }
  return new VisionCardRecognitionProvider();
}

function resolveCatalog(): CardCatalogProvider {
  const { kind } = serverConfig.providers.catalog;
  if (serverConfig.appMode === 'mock' || kind === 'mock') {
    return new MockCardCatalogProvider();
  }
  return new PokemonTcgCatalogProvider();
}

function resolvePricing(): PricingProvider {
  const { kind } = serverConfig.providers.pricing;
  if (serverConfig.appMode === 'mock' || kind === 'mock') {
    return new MockPricingProvider();
  }
  return new PokemonTcgPricingProvider();
}

function resolveDetection(): CardDetectionProvider {
  // Vision models detect and recognise in a single pass, so a dedicated
  // detection provider is only used as a fallback path today.
  return new MockCardDetectionProvider();
}

export function getProviders(): ProviderBundle {
  if (cached) return cached;
  cached = {
    detection: resolveDetection(),
    recognition: resolveRecognition(),
    catalog: resolveCatalog(),
    pricing: resolvePricing(),
  };
  logger.info('Providers resolved', {
    appMode: serverConfig.appMode,
    detection: cached.detection.name,
    recognition: cached.recognition.name,
    catalog: cached.catalog.name,
    pricing: cached.pricing.name,
  });
  return cached;
}

/** Test seam: force a specific bundle (used by integration tests). */
export function setProviders(bundle: ProviderBundle | null): void {
  cached = bundle;
}

export function isMockCatalog(): boolean {
  return getProviders().catalog.name === 'mock-catalog';
}
