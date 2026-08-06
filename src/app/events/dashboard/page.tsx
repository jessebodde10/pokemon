import type { Metadata } from 'next';
import { BackLink } from '@/components/events/back-link';
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
      <BackLink href="/events">Alle evenementen</BackLink>

      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Mijn events
      </h1>
      <p className="mt-3 max-w-2xl text-base text-[var(--text-muted)]">
        Wat je hebt bewaard en volgt. Dit staat op dit apparaat en niet in een
        account. Leeg je je browser, dan is het weg.
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
