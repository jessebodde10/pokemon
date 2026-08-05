import { beforeEach, describe, expect, it } from 'vitest';
import {
  assertWithinRateLimit,
  checkAnalysisRateLimit,
  hashOwner,
  maxImagesFor,
  type RateLimitDecision,
} from './rate-limit';
import { AppError } from '@/lib/errors/app-error';
import {
  InMemoryValtivoRepository,
  resetInMemoryStore,
} from '@/repositories/in-memory-repository';
import { getRepository, setRepository } from '@/repositories';

beforeEach(() => {
  resetInMemoryStore();
  setRepository(new InMemoryValtivoRepository());
});

/**
 * Creates an analysis for an owner. `detectedCards` decides whether it counts
 * as a productive run (consumes quota) or a wasted attempt (does not).
 */
async function createAnalysis(input: {
  userId?: string | null;
  ownerHash: string;
  detectedCards: number;
}) {
  const repository = getRepository();
  const session = await repository.createSession({
    userId: input.userId ?? null,
    guestToken: input.userId ? null : `token-${Math.random()}`,
    ownerHash: input.ownerHash,
    expiresAt: input.userId
      ? null
      : new Date(Date.now() + 3600_000).toISOString(),
  });
  if (input.detectedCards > 0) {
    await repository.updateSession(session.id, {
      status: 'needs_review',
      detectedCardsCount: input.detectedCards,
    });
  }
  return session;
}

function decision(
  overrides: Partial<RateLimitDecision> = {},
): RateLimitDecision {
  return {
    allowed: false,
    blockedBy: 'quota',
    used: 1,
    limit: 1,
    attempts: 1,
    attemptLimit: 3,
    windowHours: 24,
    ...overrides,
  };
}

describe('hashOwner', () => {
  it('never returns the raw material', () => {
    const hash = hashOwner({ ip: '203.0.113.7', guestToken: 'abc' });
    expect(hash).not.toContain('203.0.113.7');
    expect(hash).not.toContain('abc');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is stable for identical input', () => {
    const input = { ip: '203.0.113.7', guestToken: 'abc', userId: null };
    expect(hashOwner(input)).toBe(hashOwner(input));
  });

  it('separates different IPs behind the same guest token', () => {
    expect(hashOwner({ guestToken: 'abc', ip: '1.1.1.1' })).not.toBe(
      hashOwner({ guestToken: 'abc', ip: '2.2.2.2' }),
    );
  });

  it('separates different guest tokens behind the same IP', () => {
    expect(hashOwner({ guestToken: 'abc', ip: '1.1.1.1' })).not.toBe(
      hashOwner({ guestToken: 'xyz', ip: '1.1.1.1' }),
    );
  });
});

describe('maxImagesFor', () => {
  it('gives guests fewer images than signed-in users', () => {
    expect(maxImagesFor(null)).toBe(3);
    expect(maxImagesFor('user-1')).toBe(10);
  });
});

describe('checkAnalysisRateLimit - quota counts value, not attempts', () => {
  it('allows a guest their first analysis', async () => {
    const result = await checkAnalysisRateLimit({
      userId: null,
      ownerHash: 'guest-hash',
    });
    expect(result.allowed).toBe(true);
    expect(result.blockedBy).toBe('none');
    expect(result.limit).toBe(1);
    expect(result.used).toBe(0);
  });

  it('does not consume quota for an analysis that found nothing', async () => {
    await createAnalysis({ ownerHash: 'guest-hash', detectedCards: 0 });

    const result = await checkAnalysisRateLimit({
      userId: null,
      ownerHash: 'guest-hash',
    });
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(0);
    expect(result.attempts).toBe(1);
  });

  it('consumes quota once an analysis detected a card', async () => {
    await createAnalysis({ ownerHash: 'guest-hash', detectedCards: 9 });

    const result = await checkAnalysisRateLimit({
      userId: null,
      ownerHash: 'guest-hash',
    });
    expect(result.allowed).toBe(false);
    expect(result.blockedBy).toBe('quota');
    expect(result.used).toBe(1);
  });

  it('lets a guest retry after two failed photos', async () => {
    await createAnalysis({ ownerHash: 'guest-hash', detectedCards: 0 });
    await createAnalysis({ ownerHash: 'guest-hash', detectedCards: 0 });

    const result = await checkAnalysisRateLimit({
      userId: null,
      ownerHash: 'guest-hash',
    });
    expect(result.allowed).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it('stops runaway retries at the attempt ceiling', async () => {
    for (let i = 0; i < 3; i += 1) {
      await createAnalysis({ ownerHash: 'guest-hash', detectedCards: 0 });
    }

    const result = await checkAnalysisRateLimit({
      userId: null,
      ownerHash: 'guest-hash',
    });
    expect(result.allowed).toBe(false);
    expect(result.blockedBy).toBe('attempts');
    expect(result.attempts).toBe(3);
  });

  it("does not let one guest consume another guest's quota", async () => {
    await createAnalysis({ ownerHash: 'guest-a', detectedCards: 9 });

    const result = await checkAnalysisRateLimit({
      userId: null,
      ownerHash: 'guest-b',
    });
    expect(result.allowed).toBe(true);
  });

  it('allows a signed-in user more productive analyses than a guest', async () => {
    for (let i = 0; i < 4; i += 1) {
      await createAnalysis({
        userId: 'user-1',
        ownerHash: 'user-hash',
        detectedCards: 5,
      });
    }

    const result = await checkAnalysisRateLimit({
      userId: 'user-1',
      ownerHash: 'user-hash',
    });
    expect(result.limit).toBe(5);
    expect(result.allowed).toBe(true);
  });

  it('blocks a signed-in user at their quota', async () => {
    for (let i = 0; i < 5; i += 1) {
      await createAnalysis({
        userId: 'user-1',
        ownerHash: 'user-hash',
        detectedCards: 5,
      });
    }

    const result = await checkAnalysisRateLimit({
      userId: 'user-1',
      ownerHash: 'user-hash',
    });
    expect(result.allowed).toBe(false);
    expect(result.blockedBy).toBe('quota');
  });
});

describe('assertWithinRateLimit', () => {
  it('passes through an allowed decision', () => {
    expect(() =>
      assertWithinRateLimit(
        decision({ allowed: true, blockedBy: 'none', used: 0 }),
        true,
      ),
    ).not.toThrow();
  });

  it('tells a guest that only successful analyses count', () => {
    try {
      assertWithinRateLimit(decision({ blockedBy: 'quota' }), true);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe('RATE_LIMITED');
      expect(appError.httpStatus).toBe(429);
      expect(appError.userMessage).toContain('geslaagde analyse');
      expect(appError.userMessage).toContain('gratis account');
    }
  });

  it('uses a different message when the attempt ceiling is hit', () => {
    try {
      assertWithinRateLimit(
        decision({ blockedBy: 'attempts', used: 0, attempts: 3 }),
        true,
      );
      throw new Error('should have thrown');
    } catch (error) {
      const appError = error as AppError;
      expect(appError.userMessage).toContain('niets opleverden');
      expect(appError.userMessage).not.toContain('gratis account');
    }
  });

  it('uses a different message for signed-in users', () => {
    try {
      assertWithinRateLimit(
        decision({ blockedBy: 'quota', used: 5, limit: 5 }),
        false,
      );
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as AppError).userMessage).toContain('maximum van 5');
    }
  });
});
