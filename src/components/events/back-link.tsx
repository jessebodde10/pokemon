import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Breadcrumb back link.
 *
 * Text alone gave a 17px tap target, which is half of what a thumb needs. The
 * negative margin keeps the label optically aligned with the content below it
 * while the padding does the work of being tappable.
 */
export function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <nav aria-label="Kruimelpad" className={cn('mb-4 -ml-2', className)}>
      <Link
        href={href}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-white/[0.06] hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
        {children}
      </Link>
    </nav>
  );
}
