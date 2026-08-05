'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Panel } from '@/components/ui/primitives';
import { signInAction } from './actions';

export function LoginForm({ devMode }: { devMode: boolean }) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);

    const result = await signInAction(new FormData(event.currentTarget));
    if (!result.ok) {
      setError(result.message);
      setIsPending(false);
      return;
    }

    if (result.data.mode === 'magic_link') {
      setSentTo(result.data.email);
      setIsPending(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  if (sentTo) {
    return (
      <Panel>
        <h2 className="flex items-center gap-2 font-semibold">
          <Mail
            className="size-4 text-[var(--color-holo-cyan)]"
            aria-hidden="true"
          />
          Check je e-mail
        </h2>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          We hebben een inloglink gestuurd naar <strong>{sentTo}</strong>. De
          link is beperkt geldig. Zie je niets? Controleer je spammap.
        </p>
        <Button
          variant="outline"
          className="mt-5"
          onClick={() => setSentTo(null)}
        >
          Ander e-mailadres gebruiken
        </Button>
      </Panel>
    );
  }

  return (
    <Panel>
      <form onSubmit={handleSubmit} noValidate>
        <Label htmlFor="email">E-mailadres</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="jij@voorbeeld.nl"
          aria-describedby={error ? 'login-error' : 'login-help'}
        />

        <p id="login-help" className="mt-2 text-xs text-[var(--text-muted)]">
          {devMode
            ? 'Ontwikkelmodus: er wordt geen e-mail verstuurd. Je wordt direct lokaal ingelogd.'
            : 'We sturen je een inloglink. Geen wachtwoord nodig.'}
        </p>

        {error ? (
          <p
            id="login-error"
            role="alert"
            className="mt-3 text-sm text-[var(--color-critical)]"
          >
            {error}
          </p>
        ) : null}

        <Button type="submit" className="mt-5 w-full" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Bezig…
            </>
          ) : devMode ? (
            'Lokaal inloggen'
          ) : (
            'Stuur mij een inloglink'
          )}
        </Button>
      </form>
    </Panel>
  );
}
