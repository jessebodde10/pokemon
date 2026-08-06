import type { Metadata } from 'next';
import { BackLink } from '@/components/events/back-link';
import { VendorCard } from '@/components/events/vendor-card';
import { Panel, SectionHeading } from '@/components/ui/primitives';
import { getEventsRepository } from '@/features/events/repository';

export const metadata: Metadata = {
  title: 'Standhouders',
  description:
    'Alle standhouders op de Pokémon- en TCG-beurzen in Nederland en België, met hun specialisaties en komende beurzen.',
  alternates: { canonical: '/vendors' },
};

export default async function VendorsPage() {
  const repository = getEventsRepository();
  const [vendors, categories] = await Promise.all([
    repository.listVendors(),
    repository.listVendorCategories(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <BackLink href="/events">Alle evenementen</BackLink>

      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Standhouders
      </h1>
      <p className="mt-3 max-w-2xl text-base text-[var(--text-muted)]">
        {vendors.length} handelaren die op de beurzen in deze agenda staan.
        Premium-profielen staan bovenaan; dat is een betaalde plaatsing en
        verandert niets aan hun beoordeling.
      </p>

      <section className="mt-10">
        <SectionHeading
          title="Alle standhouders"
          description="Klik door voor specialisaties, beoordelingen en de beurzen waar ze staan."
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vendors.map((vendor) => (
            <li key={vendor.id} className="h-full min-w-0">
              <VendorCard vendor={vendor} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <SectionHeading
          title="Specialisaties"
          description="Waar de categorieën voor staan."
        />
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Panel key={category.id}>
              <dt className="font-medium">{category.label}</dt>
              <dd className="mt-1 text-sm text-[var(--text-muted)]">
                {category.description}
              </dd>
            </Panel>
          ))}
        </dl>
      </section>
    </div>
  );
}
