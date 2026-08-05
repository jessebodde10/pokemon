import { headers } from 'next/headers';
import {
  getCurrentUser,
  getOrCreateGuestToken,
  readGuestToken,
} from './session';
import type { Requester } from '@/services/analysis-access';

/**
 * Resolves who is making the current request.
 *
 * A logged-in user is identified by their Supabase (or dev-fallback) id; a
 * guest by an httpOnly random token. The IP is only ever passed on to the rate
 * limiter, which stores a salted hash of it.
 */
export async function getRequester(): Promise<Requester> {
  const user = await getCurrentUser();
  if (user) return { userId: user.id, guestToken: null };
  return { userId: null, guestToken: await readGuestToken() };
}

export async function getOrCreateRequester(): Promise<Requester> {
  const user = await getCurrentUser();
  if (user) return { userId: user.id, guestToken: null };
  return { userId: null, guestToken: await getOrCreateGuestToken() };
}

/** Best-effort client IP; used only as rate-limit material, never stored raw. */
export async function getClientIp(): Promise<string | null> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headerList.get('x-real-ip');
}
