import { createHmac } from 'node:crypto';
import { serverConfig } from '@/config/env';
import { RateLimitedError } from '@/lib/errors/app-error';
import { getRepository } from '@/repositories';

/**
 * Rate limiting.
 *
 * Two separate ceilings, because "how much value did you get" and "how much
 * did you cost us" are different questions:
 *
 *  - **Quota** counts only analyses that actually detected a card. A run that
 *    failed, or that found nothing on a dark photo, gave the user nothing and
 *    must not consume it. Without this, one bad first photo locks a guest out
 *    for a full day — on the single flow the product is built around.
 *  - **Attempts** counts every analysis regardless of outcome. Each one costs a
 *    vision-model call, so retries have to stay bounded.
 *
 * IP addresses are never stored: only a salted HMAC of the (guest token, IP)
 * pair is persisted, and the salt lives in the environment.
 */

export function hashOwner(parts: {
  guestToken?: string | null;
  ip?: string | null;
  userId?: string | null;
}): string {
  const material = [
    parts.userId ?? '',
    parts.guestToken ?? '',
    parts.ip ?? '',
  ].join('|');
  return createHmac('sha256', serverConfig.security.rateLimitSalt)
    .update(material)
    .digest('hex');
}

export type RateLimitDecision = {
  allowed: boolean;
  /** Which ceiling blocked the request, if any. */
  blockedBy: 'none' | 'quota' | 'attempts';
  /** Analyses that produced at least one card. */
  used: number;
  limit: number;
  /** Analyses started regardless of outcome. */
  attempts: number;
  attemptLimit: number;
  windowHours: number;
};

const WINDOW_HOURS = 24;

function windowStart(now: Date): string {
  return new Date(now.getTime() - WINDOW_HOURS * 3600_000).toISOString();
}

export async function checkAnalysisRateLimit(input: {
  userId: string | null;
  ownerHash: string;
  now?: Date;
}): Promise<RateLimitDecision> {
  const limit = input.userId
    ? serverConfig.limits.userDailyAnalyses
    : serverConfig.limits.guestDailyAnalyses;
  const attemptLimit = input.userId
    ? serverConfig.limits.userDailyAttempts
    : serverConfig.limits.guestDailyAttempts;

  if (!serverConfig.security.rateLimitEnabled) {
    return {
      allowed: true,
      blockedBy: 'none',
      used: 0,
      limit,
      attempts: 0,
      attemptLimit,
      windowHours: WINDOW_HOURS,
    };
  }

  const now = input.now ?? new Date();
  const since = windowStart(now);
  const owner = input.userId
    ? ({ userId: input.userId } as const)
    : ({ ownerHash: input.ownerHash } as const);

  const repository = getRepository();
  const [used, attempts] = await Promise.all([
    repository.countSessionsSince(owner, since, 'productive'),
    repository.countSessionsSince(owner, since, 'all'),
  ]);

  const blockedBy =
    used >= limit ? 'quota' : attempts >= attemptLimit ? 'attempts' : 'none';

  return {
    allowed: blockedBy === 'none',
    blockedBy,
    used,
    limit,
    attempts,
    attemptLimit,
    windowHours: WINDOW_HOURS,
  };
}

export function assertWithinRateLimit(
  decision: RateLimitDecision,
  isGuest: boolean,
): void {
  if (decision.allowed) return;

  if (decision.blockedBy === 'attempts') {
    throw new RateLimitedError(
      `Je hebt de afgelopen ${decision.windowHours} uur veel analyses gestart die niets opleverden. Probeer het later opnieuw met een scherpere foto.`,
      { attempts: decision.attempts, attemptLimit: decision.attemptLimit },
    );
  }

  throw new RateLimitedError(
    isGuest
      ? `Als gast kun je ${decision.limit} geslaagde analyse per ${decision.windowHours} uur uitvoeren. Maak een gratis account aan om meer analyses te doen.`
      : `Je hebt het maximum van ${decision.limit} analyses per ${decision.windowHours} uur bereikt. Probeer het later opnieuw.`,
    { used: decision.used, limit: decision.limit },
  );
}

export function maxImagesFor(userId: string | null): number {
  return userId
    ? serverConfig.limits.userMaxImages
    : serverConfig.limits.guestMaxImages;
}
