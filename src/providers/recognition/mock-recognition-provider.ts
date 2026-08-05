import { serverConfig } from '@/config/env';
import { RecognitionProviderError } from '@/lib/errors/app-error';
import { hashString } from '@/lib/random/seeded';
import type {
  CardRecognitionInput,
  CardRecognitionProvider,
  CardRecognitionResult,
  RecognitionContext,
} from '@/providers/types';
import type { CardRegion } from '@/types/domain';
import {
  MOCK_SCENARIO_DECK,
  scenarioForImage,
  type ScenarioEntry,
} from './mock-scenario';

/**
 * Scripted recognition provider.
 *
 * Implements the optional single-pass `recognizeImage` so the mock pipeline
 * exercises exactly the same code path a real vision model would.
 */
export class MockCardRecognitionProvider implements CardRecognitionProvider {
  readonly name = 'mock-recognition';

  private assertHealthy(): void {
    if (serverConfig.devForceProviderError === 'recognition') {
      throw new RecognitionProviderError('Forced recognition failure (dev)');
    }
  }

  async recognizeImage(
    _imageUrl: string,
    context: RecognitionContext,
  ): Promise<Array<CardRecognitionResult & { region: CardRegion }>> {
    this.assertHealthy();

    // Seeded on the image's position, not its URL: storage paths contain
    // random bytes, so seeding on them would make the mock non-reproducible.
    // The first image of every analysis is the full demo binder page.
    const isSingleCardPhoto = context.imageIndex % 3 === 2;
    const cardsPerImage = isSingleCardPhoto ? 1 : 9;

    const entries = scenarioForImage(context.imageIndex, cardsPerImage);
    if (isSingleCardPhoto) {
      return entries.map((entry) => ({
        ...entry,
        region: { x: 0.12, y: 0.08, width: 0.76, height: 0.84 },
        // A dedicated single-card photo is easier to read than a binder page.
        recognitionConfidence: Math.min(
          0.97,
          Number((entry.recognitionConfidence + 0.06).toFixed(2)),
        ),
      }));
    }
    return entries;
  }

  async recognizeCard(
    input: CardRecognitionInput,
  ): Promise<CardRecognitionResult> {
    this.assertHealthy();
    const seed = hashString(
      `${input.imageUrl}:${input.region?.x ?? 0}:${input.region?.y ?? 0}`,
    );
    const entry = MOCK_SCENARIO_DECK[
      seed % MOCK_SCENARIO_DECK.length
    ] as ScenarioEntry;
    const { region: _region, ...result } = entry;
    return result;
  }
}
