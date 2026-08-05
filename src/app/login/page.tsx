import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { serverConfig } from '@/config/env';
import { supabaseConfigured } from '@/config/public';
import { getCurrentUser } from '@/features/auth/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Inloggen',
  description:
    'Log in met een magic link om je analyses te bewaren en je collectie op te bouwen.',
  alternates: { canonical: '/login' },
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  const devMode = !supabaseConfigured && serverConfig.auth.devFallbackEnabled;

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Inloggen</h1>
      <p className="mt-3 text-[var(--text-muted)]">
        Bewaar je analyses, corrigeer kaarten en bouw je digitale collectie op.
      </p>

      <div className="mt-8">
        <LoginForm devMode={devMode} />
      </div>

      {devMode ? (
        <p className="mt-5 rounded-xl border border-[color-mix(in_oklab,var(--color-caution)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-caution)_10%,transparent)] px-4 py-3 text-xs text-[var(--color-caution)]">
          Er is geen Supabase-project geconfigureerd. Valtivo AI draait nu in
          ontwikkelmodus met een lokale inlogfallback. Deze fallback is
          uitgeschakeld in productiebuilds.
        </p>
      ) : null}
    </div>
  );
}
