'use client';

import * as React from 'react';
import { Bell, BellRing, Check, Heart, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  isFollowed,
  isFavorite,
  toggleFollow,
  toggleFavorite,
} from '@/features/events/client-store';
import type { FavoriteKind } from '@/features/events/types';

/**
 * Favourite and follow buttons.
 *
 * State lives in localStorage until accounts back it. That is a deliberate
 * limit rather than a shortcut: it keeps the button honest on a single device
 * without pretending a server remembers the choice.
 */
export function FavoriteButton({
  kind,
  targetId,
  label,
}: {
  kind: FavoriteKind;
  targetId: string;
  label: string;
}) {
  // Starts false on the server and syncs after mount, so the markup the server
  // sent and the first client render always agree.
  const [active, setActive] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setActive(isFavorite(kind, targetId));
    setReady(true);
  }, [kind, targetId]);

  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'outline'}
      onClick={() => {
        const next = toggleFavorite(kind, targetId);
        setActive(next);
        toast.success(
          next ? `${label} opgeslagen` : `${label} niet meer opgeslagen`,
        );
      }}
      aria-pressed={ready ? active : undefined}
    >
      <Heart
        aria-hidden="true"
        className={
          active
            ? 'fill-[var(--color-holo-pink)] text-[var(--color-holo-pink)]'
            : undefined
        }
      />
      {active ? 'Opgeslagen' : 'Bewaren'}
    </Button>
  );
}

export function FollowButton({
  kind,
  targetId,
  label,
}: {
  kind: FavoriteKind;
  targetId: string;
  label: string;
}) {
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    setActive(isFollowed(kind, targetId));
  }, [kind, targetId]);

  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'outline'}
      onClick={() => {
        const next = toggleFollow(kind, targetId);
        setActive(next);
        toast.success(
          next
            ? `Je krijgt updates over ${label}`
            : `Je volgt ${label} niet meer`,
        );
      }}
      aria-pressed={active}
    >
      {active ? <BellRing aria-hidden="true" /> : <Bell aria-hidden="true" />}
      {active ? 'Gevolgd' : 'Volgen'}
    </Button>
  );
}

/**
 * Share button. Uses the native share sheet where it exists, which on a phone
 * is what people expect, and falls back to copying the link.
 */
export function ShareButton({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = React.useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // A cancelled share sheet is not an error worth reporting; fall
        // through to copying instead.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link gekopieerd');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Kopiëren is niet gelukt. Kopieer de link uit de adresbalk.');
    }
  }

  return (
    <Button type="button" variant="outline" onClick={share}>
      {copied ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}
      {copied ? 'Gekopieerd' : 'Delen'}
    </Button>
  );
}
