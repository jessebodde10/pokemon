'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { serverConfig } from '@/config/env';
import { publicConfig, supabaseConfigured } from '@/config/public';
import {
  clearDevSessionCookie,
  devUserIdForEmail,
  setDevSessionCookie,
} from '@/features/auth/session';
import {
  actionFail,
  actionOk,
  type ActionResult,
} from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';
import { getRepository } from '@/repositories';
import { trackEvent } from '@/services/analytics';

const emailSchema = z.string().trim().email().max(254);

export type LoginOutcome =
  | { mode: 'magic_link'; email: string }
  | { mode: 'dev_fallback' };

/**
 * Sign-in.
 *
 * With Supabase configured this sends a magic link. Without it - and only
 * outside production - a signed local cookie is issued so the entire
 * logged-in experience remains testable with no mail provider.
 */
export async function signInAction(
  formData: FormData,
): Promise<ActionResult<LoginOutcome>> {
  try {
    const email = emailSchema.parse(formData.get('email'));
    trackEvent('signup_started');

    if (supabaseConfigured) {
      const client = await createSupabaseServerClient();
      if (!client) throw new Error('Supabase client unavailable');

      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${publicConfig.appUrl.replace(/\/$/, '')}/api/auth/callback`,
        },
      });
      if (error) {
        logger.error('Magic link request failed', error);
        throw new Error('Could not send magic link');
      }
      return actionOk({ mode: 'magic_link', email });
    }

    if (!serverConfig.auth.devFallbackEnabled) {
      throw new Error('Authentication is not configured');
    }

    const userId = devUserIdForEmail(email);
    await setDevSessionCookie({ id: userId, email });
    await getRepository().upsertProfile({
      id: userId,
      displayName: email.split('@')[0] ?? null,
      locale: 'nl',
    });
    trackEvent('signup_completed');
    return actionOk({ mode: 'dev_fallback' });
  } catch (error) {
    logger.error('signInAction failed', error);
    return actionFail(error);
  }
}

export async function signOutAction(): Promise<void> {
  if (supabaseConfigured) {
    const client = await createSupabaseServerClient();
    await client?.auth.signOut();
  }
  await clearDevSessionCookie();
  redirect('/');
}
