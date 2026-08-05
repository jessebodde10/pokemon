import { Bricolage_Grotesque, Figtree, IBM_Plex_Mono } from 'next/font/google';

/**
 * Three roles, three faces.
 *
 * Display  - Bricolage Grotesque: a grotesque with slightly wonky joints. Gives
 *            the headlines personality without tipping into a toy font, which
 *            would undercut a product that shows people money estimates.
 * Body     - Figtree: friendly geometric, high x-height, reads well at 14-18px.
 * Utility  - IBM Plex Mono: used for card numbers, sample counts and amounts.
 *            Mono is not decoration here - "199/165" genuinely is printed data,
 *            and tabular figures keep amount columns aligned.
 */

export const displayFont = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['500', '600', '700', '800'],
});

export const bodyFont = Figtree({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

export const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['400', '500', '600'],
});

export const fontVariables = `${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`;
