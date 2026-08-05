/* eslint-disable @next/next/no-img-element --
 * Card artwork comes from three very different sources: short-lived signed
 * storage URLs, an external catalog CDN, and locally generated demo SVGs. The
 * Next image optimiser cannot handle expiring URLs without leaking them into
 * its cache key, so a plain <img> with explicit dimensions and lazy loading is
 * the correct trade-off here. */
import { cn } from '@/lib/utils';
import type { CardRegion } from '@/types/domain';

export function CardImage({
  src,
  alt,
  className,
  aspect = 'portrait',
}: {
  src: string | null;
  alt: string;
  className?: string;
  aspect?: 'portrait' | 'square';
}) {
  const base = cn(
    'w-full overflow-hidden rounded-xl bg-[var(--color-ink-800)] object-cover',
    aspect === 'portrait' ? 'aspect-[63/88]' : 'aspect-square',
    className,
  );

  if (!src) {
    return (
      <div
        className={cn(base, 'flex items-center justify-center')}
        role="img"
        aria-label={`${alt} (geen afbeelding beschikbaar)`}
      >
        <span className="px-2 text-center text-[10px] leading-tight text-[var(--color-ink-500)]">
          Geen afbeelding
        </span>
      </div>
    );
  }

  return <img src={src} alt={alt} loading="lazy" className={base} />;
}

/**
 * Shows the detected region of a source photo. The image is scaled up and
 * translated so the requested region fills the frame - a CSS-only crop that
 * avoids generating and storing a separate cropped file per card.
 */
export function RegionCrop({
  src,
  alt,
  region,
  className,
}: {
  src: string | null;
  alt: string;
  region: CardRegion;
  className?: string;
}) {
  if (!src) return <CardImage src={null} alt={alt} className={className} />;

  const scaleX = region.width > 0 ? 1 / region.width : 1;
  const scaleY = region.height > 0 ? 1 / region.height : 1;

  return (
    <div
      className={cn(
        'relative aspect-[63/88] w-full overflow-hidden rounded-xl bg-[var(--color-ink-800)]',
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="absolute top-0 left-0 h-full w-full origin-top-left object-cover"
        style={{
          width: `${scaleX * 100}%`,
          height: `${scaleY * 100}%`,
          transform: `translate(${-region.x * scaleX * 100}%, ${-region.y * scaleY * 100}%)`,
        }}
      />
    </div>
  );
}
