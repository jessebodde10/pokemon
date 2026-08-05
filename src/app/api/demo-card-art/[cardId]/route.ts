import { NextResponse } from 'next/server';
import { DEMO_CATALOG_BY_ID } from '@/providers/catalog/fixtures';
import { hashString } from '@/lib/random/seeded';

/**
 * Placeholder artwork for demo catalog cards.
 *
 * Generated locally as an SVG so mock mode needs no external images and no
 * copyrighted artwork is reproduced. Each card gets a stable colour derived
 * from its id, and every image is visibly labelled as demo material.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await context.params;
  const card = DEMO_CATALOG_BY_ID.get(cardId);
  if (!card) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const hue = hashString(card.id) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 252 352" role="img" aria-label="Demo-illustratie voor ${escapeXml(card.name)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="hsl(${hue} 45% 32%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 40) % 360} 40% 16%)"/>
    </linearGradient>
  </defs>
  <rect width="252" height="352" rx="14" fill="url(#bg)"/>
  <rect x="10" y="10" width="232" height="332" rx="10" fill="none" stroke="hsl(${hue} 60% 70%)" stroke-opacity="0.45"/>
  <rect x="24" y="52" width="204" height="150" rx="8" fill="hsl(${hue} 35% 22%)" fill-opacity="0.75"/>
  <text x="126" y="34" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="#f5f5f4">${escapeXml(truncate(card.name, 22))}</text>
  <text x="126" y="132" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" fill="hsl(${hue} 30% 78%)">DEMO-AFBEELDING</text>
  <text x="126" y="150" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" fill="hsl(${hue} 25% 68%)">geen officiële kaartillustratie</text>
  <text x="24" y="242" font-family="system-ui, sans-serif" font-size="11" fill="#e7e5e4">${escapeXml(truncate(card.setName, 26))}</text>
  <text x="24" y="262" font-family="system-ui, sans-serif" font-size="11" fill="hsl(${hue} 25% 75%)">${escapeXml(card.cardNumber)}</text>
  <text x="24" y="282" font-family="system-ui, sans-serif" font-size="10" fill="hsl(${hue} 20% 68%)">${escapeXml(card.variant ?? 'onbekende variant')}</text>
  <text x="24" y="322" font-family="system-ui, sans-serif" font-size="9" fill="hsl(${hue} 20% 60%)">Valtivo AI demodata</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=86400, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
