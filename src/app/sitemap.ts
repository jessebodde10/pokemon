import type { MetadataRoute } from 'next';
import { publicConfig } from '@/config/public';
import { getEventsRepository } from '@/features/events/repository';

/** Only publicly meaningful, indexable routes belong here. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicConfig.appUrl.replace(/\/$/, '');
  const lastModified = new Date();

  const repository = getEventsRepository();
  const [events, vendors] = await Promise.all([
    repository.listEvents(),
    repository.listVendors(),
  ]);

  // Event pages are the reason this section exists as far as search is
  // concerned, so they get a high priority and a short refresh interval:
  // dates, vendors and ticket status all change up to the day itself.
  const eventUrls: MetadataRoute.Sitemap = events.map((item) => ({
    url: `${base}/events/${item.event.slug}`,
    lastModified,
    changeFrequency: 'daily',
    priority: 0.9,
  }));

  const vendorUrls: MetadataRoute.Sitemap = vendors.map((vendor) => ({
    url: `${base}/vendors/${vendor.id}`,
    lastModified,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  return [
    {
      url: `${base}/events`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.95,
    },
    {
      url: `${base}/events/advisor`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${base}/vendors`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...eventUrls,
    ...vendorUrls,
    { url: `${base}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    {
      url: `${base}/analyze`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/login`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${base}/disclaimer`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/privacy`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/terms`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
