/**
 * Public configuration. Safe to import from client components.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only when the
 * property is referenced statically, so these must stay literal lookups.
 */

export const publicConfig = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
} as const;

export const supabaseConfigured =
  publicConfig.supabaseUrl.length > 0 &&
  publicConfig.supabaseAnonKey.length > 0;

/** Upload constraints mirrored on the client for instant feedback. */
export const uploadConstraints = {
  acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
  acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp'] as const,
  maxBytes: 10 * 1024 * 1024,
} as const;

export type AcceptedMimeType =
  (typeof uploadConstraints.acceptedMimeTypes)[number];

export function isAcceptedMimeType(value: string): value is AcceptedMimeType {
  return (uploadConstraints.acceptedMimeTypes as readonly string[]).includes(
    value,
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
