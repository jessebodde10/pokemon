import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        Deze pagina bestaat niet
      </h1>
      <p className="mt-3 text-[var(--text-muted)]">
        Mogelijk is de analyse verlopen. Gastanalyses worden automatisch
        verwijderd na 24 uur.
      </p>
      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/analyze">Nieuwe analyse starten</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Naar de homepage</Link>
        </Button>
      </div>
    </div>
  );
}
