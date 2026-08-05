import {
  AnalysisNotFoundError,
  UnauthorizedAnalysisAccessError,
} from '@/lib/errors/app-error';
import { getRepository } from '@/repositories';
import type { AnalysisSession } from '@/types/domain';

/**
 * Server-side authorisation for a single analysis.
 *
 * Rules:
 *  - a session owned by a user is only readable by that user;
 *  - a guest session is readable by whoever presents the matching guest token;
 *  - an expired guest session behaves as if it no longer exists.
 */

export type Requester = {
  userId: string | null;
  guestToken: string | null;
};

export function assertCanAccess(
  session: AnalysisSession,
  requester: Requester,
  now: Date = new Date(),
): void {
  if (
    session.userId === null &&
    session.expiresAt !== null &&
    Date.parse(session.expiresAt) <= now.getTime()
  ) {
    throw new AnalysisNotFoundError(session.id);
  }

  if (session.userId !== null) {
    if (requester.userId !== session.userId) {
      throw new UnauthorizedAnalysisAccessError(session.id);
    }
    return;
  }

  if (
    !session.guestToken ||
    !requester.guestToken ||
    session.guestToken !== requester.guestToken
  ) {
    throw new UnauthorizedAnalysisAccessError(session.id);
  }
}

export async function loadAuthorisedSession(
  sessionId: string,
  requester: Requester,
): Promise<AnalysisSession> {
  const session = await getRepository().getSession(sessionId);
  if (!session) throw new AnalysisNotFoundError(sessionId);
  assertCanAccess(session, requester);
  return session;
}
