import type { Metadata } from 'next';
import Link from 'next/link';
import { Lightbulb } from 'lucide-react';
import { UploadFlow } from '@/components/upload/upload-flow';
import { DisclaimerNotice } from '@/components/layout/site-shell';
import { Panel } from '@/components/ui/primitives';
import { serverConfig } from '@/config/env';
import { getCurrentUser } from '@/features/auth/session';

export const metadata: Metadata = {
  title: 'Kaarten analyseren',
  description:
    'Upload foto’s van losse kaarten of binderpagina’s en start een transparante analyse.',
  alternates: { canonical: '/analyze' },
  robots: { index: false, follow: true },
};

const UPLOAD_TIPS = [
  'Gebruik voldoende licht.',
  'Vermijd reflecties.',
  'Fotografeer recht van boven.',
  'Zorg dat kaartnummers leesbaar zijn.',
  'Maak bij waardevolle kaarten ook een losse foto.',
];

export default async function AnalyzePage() {
  const user = await getCurrentUser();
  const maxImages = user
    ? serverConfig.limits.userMaxImages
    : serverConfig.limits.guestMaxImages;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Upload je foto’s
      </h1>
      <p className="mt-3 max-w-2xl text-[var(--text-muted)]">
        Fotografeer losse kaarten of hele binderpagina’s. Na de analyse
        controleer je zelf welke kaarten correct zijn herkend.
      </p>

      {!user ? (
        <p className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--color-ink-900)] px-4 py-3 text-sm text-[var(--text-muted)]">
          Je werkt nu als gast: maximaal {maxImages} foto’s en één analyse. De
          analyse wordt na {serverConfig.limits.guestTtlHours} uur automatisch
          verwijderd.{' '}
          <Link
            href="/login"
            className="text-[var(--color-holo-cyan)] underline"
          >
            Maak een gratis account
          </Link>{' '}
          om analyses te bewaren.
        </p>
      ) : null}

      <div className="mt-8">
        <UploadFlow maxImages={maxImages} />
      </div>

      <Panel className="mt-8">
        <h2 className="flex items-center gap-2 font-semibold">
          <Lightbulb
            className="size-4 text-[var(--color-holo-cyan)]"
            aria-hidden="true"
          />
          Tips voor bruikbare foto’s
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
          {UPLOAD_TIPS.map((tip) => (
            <li key={tip} className="flex gap-2">
              <span
                aria-hidden="true"
                className="text-[var(--color-holo-cyan)]"
              >
                •
              </span>
              {tip}
            </li>
          ))}
        </ul>
      </Panel>

      <div className="mt-6">
        <DisclaimerNotice />
      </div>
    </div>
  );
}
