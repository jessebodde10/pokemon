import { serverConfig } from '@/config/env';
import { RecognitionProviderError } from '@/lib/errors/app-error';
import { createSeededRandom, hashString } from '@/lib/random/seeded';
import type {
  CardDetectionProvider,
  DetectedCardRegion,
} from '@/providers/types';
import { binderSlot } from '@/providers/recognition/mock-scenario';

/**
 * Deterministic stand-in for a real card-localisation model.
 *
 * The number of regions is derived from a hash of the image identifier, so the
 * same upload always yields the same layout, while different uploads produce
 * a believable mix of single cards and full binder pages.
 */
export class MockCardDetectionProvider implements CardDetectionProvider {
  readonly name = 'mock-detection';

  async detectCards(imageUrl: string): Promise<DetectedCardRegion[]> {
    if (serverConfig.devForceProviderError === 'detection') {
      throw new RecognitionProviderError('Forced detection failure (dev)');
    }

    const random = createSeededRandom(`detect:${imageUrl}`);
    const seed = hashString(imageUrl);
    // Roughly a third of images are treated as a single-card photo.
    const cardCount = seed % 3 === 0 ? 1 : 4 + (seed % 5);

    const regions: DetectedCardRegion[] = [];
    for (let index = 0; index < cardCount; index += 1) {
      const region =
        cardCount === 1
          ? { x: 0.12, y: 0.08, width: 0.76, height: 0.84 }
          : binderSlot(index);
      const warnings: string[] = [];
      if (random() < 0.25) warnings.push('glare');
      if (random() < 0.15) warnings.push('angle');
      regions.push({
        region,
        detectionConfidence: Number((0.7 + random() * 0.29).toFixed(2)),
        qualityWarnings: warnings,
      });
    }
    return regions;
  }
}
