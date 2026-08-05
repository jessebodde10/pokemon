import type { NextConfig } from 'next';

const supabaseHost = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Lets a second Next process (the e2e dev server) use its own build output
  // instead of clobbering the production build that `next start` is serving.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    remotePatterns: [
      // Official Pokémon TCG API card artwork, used only when the real catalog
      // provider is enabled. Mock mode serves locally generated placeholders.
      { protocol: 'https', hostname: 'images.pokemontcg.io' },
      ...(supabaseHost
        ? ([{ protocol: 'https', hostname: supabaseHost }] as const)
        : []),
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), payment=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
