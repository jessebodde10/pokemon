import { z } from 'zod';

/**
 * Server-side configuration.
 *
 * Never import this module from a client component: it reads secrets. The
 * runtime guard below turns an accidental import into a loud failure instead
 * of a silently leaked key.
 */
if (typeof window !== 'undefined') {
  throw new Error('src/config/env.ts must not be imported on the client.');
}

const booleanish = z
  .enum(['true', 'false', '1', '0', ''])
  .transform((v) => v === 'true' || v === '1');

const positiveInt = (fallback: number) =>
  z.coerce.number().int().positive().catch(fallback);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).catch('development'),

  APP_MODE: z.enum(['mock', 'live']).catch('mock'),
  DEV_FORCE_PROVIDER_ERROR: z
    .enum(['none', 'detection', 'recognition', 'catalog', 'pricing'])
    .catch('none'),

  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).catch('valtivo-uploads'),

  GUEST_ANALYSIS_TTL_HOURS: positiveInt(24),
  GUEST_MAX_IMAGES: positiveInt(3),
  USER_MAX_IMAGES: positiveInt(10),
  USER_DAILY_ANALYSIS_LIMIT: positiveInt(5),
  GUEST_DAILY_ANALYSIS_LIMIT: positiveInt(1),
  // Ceiling on attempts that produced nothing. Keeps a failed photo free while
  // still bounding the cost of someone feeding the vision model garbage.
  GUEST_DAILY_ATTEMPT_LIMIT: positiveInt(5),
  USER_DAILY_ATTEMPT_LIMIT: positiveInt(25),
  MAX_UPLOAD_BYTES: positiveInt(10 * 1024 * 1024),
  ATTENTION_VALUE_THRESHOLD_EUR: z.coerce.number().positive().catch(25),

  AI_VISION_PROVIDER: z
    .enum(['mock', 'anthropic', 'openai-compatible'])
    .catch('mock'),
  AI_VISION_API_KEY: z.string().default(''),
  AI_VISION_MODEL: z.string().default(''),
  AI_VISION_BASE_URL: z.string().default(''),

  CARD_CATALOG_PROVIDER: z.enum(['mock', 'pokemontcg']).catch('mock'),
  CARD_CATALOG_API_KEY: z.string().default(''),
  CARD_CATALOG_BASE_URL: z.string().catch('https://api.pokemontcg.io/v2'),

  PRICING_PROVIDER: z.enum(['mock', 'pokemontcg']).catch('mock'),
  PRICING_API_KEY: z.string().default(''),

  RATE_LIMIT_SALT: z.string().default('valtivo-ai-development-salt'),
  RATE_LIMIT_ENABLED: booleanish.catch(true),

  DEV_AUTH_FALLBACK: booleanish.catch(true),
  ANALYTICS_ADAPTER: z.enum(['console', 'none']).catch('console'),
});

function readEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Should be unreachable: every field has a `.catch()` or `.default()`.
    // Keep the message free of values so secrets never reach the logs.
    const fields = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid environment configuration for: ${fields}`);
  }
  return parsed.data;
}

const env = readEnv();

export const serverConfig = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  appMode: env.APP_MODE,
  devForceProviderError: env.DEV_FORCE_PROVIDER_ERROR,

  supabase: {
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    storageBucket: env.SUPABASE_STORAGE_BUCKET,
  },

  limits: {
    guestTtlHours: env.GUEST_ANALYSIS_TTL_HOURS,
    guestMaxImages: env.GUEST_MAX_IMAGES,
    userMaxImages: env.USER_MAX_IMAGES,
    userDailyAnalyses: env.USER_DAILY_ANALYSIS_LIMIT,
    guestDailyAnalyses: env.GUEST_DAILY_ANALYSIS_LIMIT,
    guestDailyAttempts: env.GUEST_DAILY_ATTEMPT_LIMIT,
    userDailyAttempts: env.USER_DAILY_ATTEMPT_LIMIT,
    maxUploadBytes: env.MAX_UPLOAD_BYTES,
  },

  report: {
    attentionValueThresholdEur: env.ATTENTION_VALUE_THRESHOLD_EUR,
  },

  providers: {
    vision: {
      kind: env.AI_VISION_PROVIDER,
      apiKey: env.AI_VISION_API_KEY,
      model: env.AI_VISION_MODEL,
      baseUrl: env.AI_VISION_BASE_URL,
    },
    catalog: {
      kind: env.CARD_CATALOG_PROVIDER,
      apiKey: env.CARD_CATALOG_API_KEY,
      baseUrl: env.CARD_CATALOG_BASE_URL,
    },
    pricing: {
      kind: env.PRICING_PROVIDER,
      apiKey: env.PRICING_API_KEY,
    },
  },

  security: {
    rateLimitSalt: env.RATE_LIMIT_SALT,
    rateLimitEnabled: env.RATE_LIMIT_ENABLED,
  },

  auth: {
    devFallbackEnabled: env.DEV_AUTH_FALLBACK && env.NODE_ENV !== 'production',
  },

  analytics: {
    adapter: env.ANALYTICS_ADAPTER,
  },
} as const;

export type ServerConfig = typeof serverConfig;
