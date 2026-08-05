import { describe, expect, it } from 'vitest';
import { assertCanAccess } from './analysis-access';
import { AppError } from '@/lib/errors/app-error';
import type { AnalysisSession } from '@/types/domain';

const NOW = new Date('2026-08-05T12:00:00.000Z');

function session(overrides: Partial<AnalysisSession> = {}): AnalysisSession {
  return {
    id: 'session-1',
    userId: null,
    guestToken: 'guest-token-abc',
    ownerHash: 'hash',
    status: 'needs_review',
    statusDetail: null,
    totalImages: 1,
    detectedCardsCount: 0,
    confirmedCardsCount: 0,
    unknownCardsCount: 0,
    errorMessage: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    completedAt: null,
    expiresAt: new Date(NOW.getTime() + 3600_000).toISOString(),
    ...overrides,
  };
}

function codeOf(fn: () => void): string {
  try {
    fn();
    return 'NO_ERROR';
  } catch (error) {
    return error instanceof AppError ? error.code : 'UNEXPECTED';
  }
}

describe('assertCanAccess - user-owned sessions', () => {
  const owned = session({
    userId: 'user-1',
    guestToken: null,
    expiresAt: null,
  });

  it('allows the owner', () => {
    expect(
      codeOf(() =>
        assertCanAccess(owned, { userId: 'user-1', guestToken: null }, NOW),
      ),
    ).toBe('NO_ERROR');
  });

  it('denies a different user', () => {
    expect(
      codeOf(() =>
        assertCanAccess(owned, { userId: 'user-2', guestToken: null }, NOW),
      ),
    ).toBe('UNAUTHORIZED_ANALYSIS_ACCESS');
  });

  it('denies an anonymous requester', () => {
    expect(
      codeOf(() =>
        assertCanAccess(owned, { userId: null, guestToken: null }, NOW),
      ),
    ).toBe('UNAUTHORIZED_ANALYSIS_ACCESS');
  });

  it('denies a guest token holder', () => {
    expect(
      codeOf(() =>
        assertCanAccess(
          owned,
          { userId: null, guestToken: 'guest-token-abc' },
          NOW,
        ),
      ),
    ).toBe('UNAUTHORIZED_ANALYSIS_ACCESS');
  });
});

describe('assertCanAccess - guest sessions', () => {
  it('allows the matching guest token', () => {
    expect(
      codeOf(() =>
        assertCanAccess(
          session(),
          { userId: null, guestToken: 'guest-token-abc' },
          NOW,
        ),
      ),
    ).toBe('NO_ERROR');
  });

  it('denies a wrong guest token', () => {
    expect(
      codeOf(() =>
        assertCanAccess(session(), { userId: null, guestToken: 'other' }, NOW),
      ),
    ).toBe('UNAUTHORIZED_ANALYSIS_ACCESS');
  });

  it('denies a missing guest token', () => {
    expect(
      codeOf(() =>
        assertCanAccess(session(), { userId: null, guestToken: null }, NOW),
      ),
    ).toBe('UNAUTHORIZED_ANALYSIS_ACCESS');
  });

  it('reports an expired guest session as not found, not as forbidden', () => {
    const expired = session({
      expiresAt: new Date(NOW.getTime() - 1000).toISOString(),
    });
    expect(
      codeOf(() =>
        assertCanAccess(
          expired,
          { userId: null, guestToken: 'guest-token-abc' },
          NOW,
        ),
      ),
    ).toBe('ANALYSIS_NOT_FOUND');
  });

  it('does not let a logged-in user hijack a guest session by id alone', () => {
    expect(
      codeOf(() =>
        assertCanAccess(session(), { userId: 'user-9', guestToken: null }, NOW),
      ),
    ).toBe('UNAUTHORIZED_ANALYSIS_ACCESS');
  });
});
