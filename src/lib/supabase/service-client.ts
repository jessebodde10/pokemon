import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { serverConfig } from '@/config/env';
import { publicConfig } from '@/config/public';

/**
 * Service-role client. Bypasses RLS, so it must only ever be used from server
 * code that has already performed its own authorisation check.
 */
let client: SupabaseClient | null = null;

export function getServiceRoleClient(): SupabaseClient {
  if (client) return client;
  if (!publicConfig.supabaseUrl || !serverConfig.supabase.serviceRoleKey) {
    throw new Error(
      'Supabase service role client requested without configuration',
    );
  }
  client = createClient(
    publicConfig.supabaseUrl,
    serverConfig.supabase.serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return client;
}
