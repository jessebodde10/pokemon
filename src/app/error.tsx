'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Global error boundary. Users see a plain explanation and a way forward;
 * the technical detail stays in the server logs. Next.js already strips
 * messages and stack traces from production error objects.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        Er ging iets mis
      </h1>
      <p className="mt-3 text-[var(--text-muted)]">
        We konden deze pagina niet laden. Probeer het opnieuw; als het blijft
        gebeuren, start dan een nieuwe analyse.
      </p>
      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <Button onClick={reset}>Opnieuw proberen</Button>
        <Button asChild variant="outline">
          <Link href="/">Naar de homepage</Link>
        </Button>
      </div>
    </div>
  );
}
