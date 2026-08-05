import { NextResponse } from 'next/server';
import { publicConfig } from '@/config/public';
import { logger } from '@/lib/logging/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';
import { getRepository } from '@/repositories';
import { trackEvent } from '@/services/analytics';

export const dynamic = 'force-dynamic';

/** Magic-link landing route: exchanges the one-time code for a session. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const base = publicConfig.appUrl.replace(/\/$/, '');

  if (!code) {
    return NextResponse.redirect(`${base}/login?error=missing_code`);
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return NextResponse.redirect(`${base}/login?error=not_configured`);
  }

  const { data, error } = await client.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    logger.warn('Magic link exchange failed');
    return NextResponse.redirect(`${base}/login?error=invalid_code`);
  }

  await getRepository()
    .upsertProfile({
      id: data.user.id,
      displayName: data.user.email?.split('@')[0] ?? null,
      locale: 'nl',
    })
    .catch((profileError) =>
      logger.warn('Profile upsert after login failed', {
        error: String(profileError),
      }),
    );

  trackEvent('signup_completed');
  return NextResponse.redirect(`${base}/dashboard`);
}
