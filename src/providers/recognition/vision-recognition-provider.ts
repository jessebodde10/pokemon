import { serverConfig } from '@/config/env';
import { RecognitionProviderError } from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';
import {
  parseVisionResponse,
  type VisionCard,
} from '@/lib/validation/ai-output';
import type {
  CardRecognitionInput,
  CardRecognitionProvider,
  CardRecognitionResult,
  RecognitionContext,
} from '@/providers/types';
import type { CardRegion } from '@/types/domain';

/**
 * Generic multimodal vision adapter.
 *
 * Configured entirely through environment variables so a different model or a
 * self-hosted OpenAI-compatible endpoint can be swapped in without code
 * changes. The model is treated as untrusted: its output is only accepted
 * after passing the Zod contract in lib/validation/ai-output.
 */

export const VISION_SYSTEM_PROMPT = `You are a Pokémon trading card recognition system.
You receive one photo that may contain a single card or a binder page with multiple cards.

Return ONLY a JSON object with this exact shape:
{"cards":[{"region":{"x":0,"y":0,"width":0,"height":0},"visibleName":null,"visibleCardNumber":null,"possibleSetCode":null,"language":"en","variantHints":[],"recognitionConfidence":0,"imageQualityWarnings":[]}]}

Rules:
- region coordinates are normalised between 0 and 1, relative to the full image; x+width and y+height must not exceed 1.
- Only report what is actually legible. Use null when you cannot read a field. Never guess a card number.
- recognitionConfidence is your own calibrated certainty between 0 and 1.
- language is one of "en", "nl", "unknown".
- variantHints may contain terms such as "holo", "reverse holo", "full art", "special illustration rare".
- imageQualityWarnings may contain terms such as "glare", "blurry", "angle", "partially covered", "low resolution".
- Do not include prices, condition grades, or any commentary. Output JSON only.`;

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

type FetchedImage = { base64: string; mediaType: string };

async function fetchImageAsBase64(imageUrl: string): Promise<FetchedImage> {
  const response = await fetch(imageUrl, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new RecognitionProviderError(
      `Could not fetch image for recognition (status ${response.status})`,
    );
  }
  const mediaType = response.headers.get('content-type') ?? 'image/jpeg';
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new RecognitionProviderError('Image too large for recognition');
  }
  return {
    base64: buffer.toString('base64'),
    mediaType: mediaType.split(';')[0] ?? 'image/jpeg',
  };
}

async function loadFromBytes(
  load: () => Promise<{ bytes: Uint8Array; mediaType: string }>,
): Promise<FetchedImage> {
  const { bytes, mediaType } = await load();
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new RecognitionProviderError('Image too large for recognition');
  }
  return {
    base64: Buffer.from(bytes).toString('base64'),
    mediaType: mediaType.split(';')[0] ?? 'image/jpeg',
  };
}

interface VisionTransport {
  readonly label: string;
  complete(image: FetchedImage, instruction: string): Promise<string>;
}

class AnthropicTransport implements VisionTransport {
  readonly label = 'anthropic';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl: string,
  ) {}

  async complete(image: FetchedImage, instruction: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model: this.model,
        // Headroom, not an expected output size. On current Claude models
        // thinking is on by default and `max_tokens` caps thinking *plus* the
        // response together - a tight budget truncates the JSON mid-array on a
        // full binder page, which then fails Zod validation as malformed.
        max_tokens: 16_000,
        system: VISION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: image.mediaType,
                  data: image.base64,
                },
              },
              { type: 'text', text: instruction },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new RecognitionProviderError(
        `Vision provider responded with status ${response.status}`,
      );
    }
    const json = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    return (json.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('\n');
  }
}

class OpenAiCompatibleTransport implements VisionTransport {
  readonly label = 'openai-compatible';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl: string,
  ) {}

  async complete(image: FetchedImage, instruction: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: VISION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: instruction },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${image.mediaType};base64,${image.base64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new RecognitionProviderError(
        `Vision provider responded with status ${response.status}`,
      );
    }
    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content ?? '';
  }
}

function toRecognitionResult(card: VisionCard): CardRecognitionResult & {
  region: CardRegion;
} {
  return {
    region: card.region,
    visibleName: card.visibleName,
    visibleCardNumber: card.visibleCardNumber,
    possibleSetCode: card.possibleSetCode,
    language: card.language,
    variantHints: card.variantHints,
    recognitionConfidence: card.recognitionConfidence,
    imageQualityWarnings: card.imageQualityWarnings,
  };
}

export class VisionCardRecognitionProvider implements CardRecognitionProvider {
  readonly name: string;
  private readonly transport: VisionTransport;

  constructor(transport?: VisionTransport) {
    const config = serverConfig.providers.vision;
    if (transport) {
      this.transport = transport;
    } else if (config.kind === 'anthropic') {
      this.transport = new AnthropicTransport(
        config.apiKey,
        config.model || 'claude-opus-5',
        config.baseUrl || 'https://api.anthropic.com',
      );
    } else {
      this.transport = new OpenAiCompatibleTransport(
        config.apiKey,
        config.model || 'gpt-4o-mini',
        config.baseUrl || 'https://api.openai.com/v1',
      );
    }
    this.name = `vision-${this.transport.label}`;
  }

  async recognizeImage(
    imageUrl: string,
    context?: RecognitionContext,
  ): Promise<Array<CardRecognitionResult & { region: CardRegion }>> {
    // Prefer bytes handed over by the pipeline. Fetching the signed URL only
    // works when storage is reachable from the public internet, which rules
    // out local development storage entirely.
    const image = context?.loadImage
      ? await loadFromBytes(context.loadImage)
      : await fetchImageAsBase64(imageUrl);
    const raw = await this.transport.complete(
      image,
      'Identify every Pokémon card in this photo and return the JSON object described in your instructions.',
    );

    const parsed = parseVisionResponse(raw);
    if (!parsed.ok) {
      // Log the failure shape, never the model output itself: photos can
      // contain personal context and the payload may be large.
      logger.error('Vision output failed validation', undefined, {
        provider: this.name,
        imageId: context?.imageId ?? null,
        reason: parsed.reason,
        issues: parsed.issues.slice(0, 5),
      });
      throw new RecognitionProviderError('Vision output failed validation', {
        reason: parsed.reason,
      });
    }
    return parsed.data.cards.map(toRecognitionResult);
  }

  async recognizeCard(
    input: CardRecognitionInput,
  ): Promise<CardRecognitionResult> {
    const results = await this.recognizeImage(input.imageUrl, {
      imageId: 'single',
      imageIndex: 0,
    });
    const first = results[0];
    if (!first) {
      throw new RecognitionProviderError('Vision provider returned no cards');
    }
    const { region: _region, ...rest } = first;
    return rest;
  }
}
