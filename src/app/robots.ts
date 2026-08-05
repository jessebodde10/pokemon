import type { MetadataRoute } from 'next';
import { publicConfig } from '@/config/public';

export default function robots(): MetadataRoute.Robots {
  const base = publicConfig.appUrl.replace(/\/$/, '');
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Analyses are private per user or guest token and must never be
        // crawled, even though they are already noindex at the page level.
        disallow: ['/api/', '/dashboard/', '/analyze/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
