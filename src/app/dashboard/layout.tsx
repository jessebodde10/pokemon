import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/features/auth/session';
import { Button } from '@/components/ui/button';
import { signOutAction } from '@/app/login/actions';

/**
 * Every dashboard route is guarded here *and* re-checks the user in its own
 * data loader, so a missed layout render can never expose another user's data.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {user.email ?? 'Ingelogd'}
          </p>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Uitloggen
          </Button>
        </form>
      </div>

      <nav aria-label="Dashboardnavigatie" className="mt-6">
        <ul className="flex flex-wrap gap-2">
          {[
            { href: '/dashboard', label: 'Overzicht' },
            { href: '/dashboard/analyses', label: 'Analyses' },
            { href: '/dashboard/collection', label: 'Collectie' },
          ].map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="inline-flex h-9 items-center rounded-full border border-[var(--border-subtle)] px-4 text-sm hover:bg-[var(--color-ink-850)]"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8">{children}</div>
    </div>
  );
}
