import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { serverConfig } from '@/config/env';
import { supabaseConfigured } from '@/config/public';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';
import { AuthRequiredError } from '@/lib/errors/app-error';

/**
 * Authentication.
 *
 * Production path: Supabase Auth magic links, read from the request cookie.
 * Development path: when no Supabase project is configured and
 * DEV_AUTH_FALLBACK is on, a signed local cookie stands in for a real session
 * so the whole logged-in experience can be exercised without an e-mail
 * provider. The fallback is force-disabled in production builds.
 */

export type AuthUser = {
  id: string;
  email: string | null;
  source: 'supabase' | 'dev-fallback';
};

export const DEV_SESSION_COOKIE = 'pokora_dev_session';
export const GUEST_TOKEN_COOKIE = 'pokora_guest_token';
const DEV_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function sign(payload: string): string {
  return createHmac('sha256', serverConfig.security.rateLimitSalt)
    .update(payload)
    .digest('hex');
}

export function encodeDevSession(user: { id: string; email: string }): string {
  const payload = Buffer.from(JSON.stringify(user), 'utf8').toString(
    'base64url',
  );
  return `${payload}.${sign(payload)}`;
}

export function decodeDevSession(raw: string): AuthUser | null {
  const [payload, signature] = raw.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (expected.length !== signature.length) return null;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as { id?: unknown; email?: unknown };
    if (typeof parsed.id !== 'string') return null;
    return {
      id: parsed.id,
      email: typeof parsed.email === 'string' ? parsed.email : null,
      source: 'dev-fallback',
    };
  } catch {
    return null;
  }
}

/** Deterministic user id per e-mail so a dev login is stable across restarts. */
export function devUserIdForEmail(email: string): string {
  const digest = createHmac('sha256', serverConfig.security.rateLimitSalt)
    .update(`dev-user:${email.trim().toLowerCase()}`)
    .digest('hex');
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(13, 16)}`,
    `a${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join('-');
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (supabaseConfigured) {
    const client = await createSupabaseServerClient();
    if (client) {
      const { data } = await client.auth.getUser();
      if (data.user) {
        return {
          id: data.user.id,
          email: data.user.email ?? null,
          source: 'supabase',
        };
      }
    }
    return null;
  }

  if (!serverConfig.auth.devFallbackEnabled) return null;
  const cookieStore = await cookies();
  const raw = cookieStore.get(DEV_SESSION_COOKIE)?.value;
  return raw ? decodeDevSession(raw) : null;
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthRequiredError();
  return user;
}

export async function setDevSessionCookie(user: {
  id: string;
  email: string;
}): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(DEV_SESSION_COOKIE, encodeDevSession(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: serverConfig.isProduction,
    path: '/',
    maxAge: DEV_SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearDevSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(DEV_SESSION_COOKIE);
}

/**
 * Guest identity. A high-entropy random token stored in an httpOnly cookie;
 * it is the only thing that grants access to a guest analysis.
 */
export async function getOrCreateGuestToken(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(GUEST_TOKEN_COOKIE)?.value;
  if (existing && existing.length >= 32) return existing;

  const token = `${randomUUID()}${randomUUID()}`.replaceAll('-', '');
  cookieStore.set(GUEST_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: serverConfig.isProduction,
    path: '/',
    maxAge: 60 * 60 * serverConfig.limits.guestTtlHours,
  });
  return token;
}

export async function readGuestToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(GUEST_TOKEN_COOKIE)?.value ?? null;
}
