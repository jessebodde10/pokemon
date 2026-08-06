import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { publicConfig } from '@/config/public';
import { SiteFooter, SiteHeader } from '@/components/layout/site-shell';
import { MobileNav } from '@/components/layout/mobile-nav';
import { fontVariables } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(publicConfig.appUrl),
  title: {
    default: 'Pokora — ontdek wat er in je Pokémon-binder zit',
    template: '%s — Pokora',
  },
  description:
    'Upload foto’s van je Pokémon-kaarten en ontvang een transparante analyse met kaartnamen, geschatte marktwaarden en opvallende kaarten.',
  applicationName: 'Pokora',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'nl_NL',
    siteName: 'Pokora',
    title: 'Pokora — ontdek wat er in je Pokémon-binder zit',
    description:
      'Upload foto’s van je kaarten en ontvang een transparante collectieanalyse met geschatte marktwaarden en bronvermelding.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#12141a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl" className={fontVariables}>
      <body>
        <a href="#main" className="skip-link">
          Naar hoofdinhoud
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
        <MobileNav />
        <Toaster
          theme="dark"
          position="bottom-center"
          toastOptions={{ className: 'text-sm' }}
        />
      </body>
    </html>
  );
}
