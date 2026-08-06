import type { Metadata } from 'next';
import Link from 'next/link';
import { EventsDashboard } from '@/components/events/dashboard-view';
import { getEventsRepository } from '@/features/events/repository';

export const metadata: Metadata = {
  title: 'Mijn events',
  description:
    'Je bewaarde beurzen, opgeslagen standhouders, wishlist en meldingen op één plek.',
  alternates: { canonical: '/events/dashboard' },
  // Personal, per-device state; there is nothing meaningful to index.
  robots: { index: false, follow: true },
};

export default async function EventsDashboardPage() {
  const repository = getEventsRepository();
  const [allEvents, allVendors, notifications, wishlist] = await Promise.all([
    repository.listEvents(),
    repository.listVendors(),
    repository.listNotifications(),
    repository.listWishlist(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <nav aria-label="Kruimelpad" className="mb-5 text-sm">
        <Link
          href="/events"
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          ← Alle evenementen
        </Link>
      </nav>

      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Mijn events
      </h1>
      <p className="mt-3 max-w-2xl text-base text-[var(--text-muted)]">
        Wat je hebt bewaard en volgt. Dit wordt op dit apparaat opgeslagen, niet
        in een account — leeg je je browser, dan is het weg.
      </p>

      <div className="mt-10">
        <EventsDashboard
          allEvents={allEvents}
          allVendors={allVendors}
          notifications={notifications}
          wishlist={wishlist}
        />
      </div>
    </div>
  );
}
