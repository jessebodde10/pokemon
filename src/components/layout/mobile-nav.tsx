'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Layers, ScanLine, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Bottom navigation for phones.
 *
 * The header cannot hold four sections plus the account actions at 375px, and
 * a hamburger would bury the new Events section on the device most visitors
 * use. A bottom bar keeps every section one tap away.
 */
const ITEMS = [
  { href: '/analyze', label: 'Analyseren', icon: ScanLine },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/community', label: 'Community', icon: Users },
  { href: '/dashboard/collection', label: 'Collectie', icon: Layers },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secties"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-subtle)] bg-[color-mix(in_oklab,var(--surface-page)_94%,transparent)] backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                // 56px tall so the tap target clears the 44px minimum with
                // room for the label underneath.
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active
                    ? 'text-[var(--color-holo-cyan)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
