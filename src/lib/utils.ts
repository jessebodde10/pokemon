import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value: string | null): string {
  if (!value) return 'Onbekend';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return 'Onbekend';
  return new Intl.DateTimeFormat('nl-NL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(parsed));
}

export function formatDate(value: string | null): string {
  if (!value) return 'Onbekend';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return 'Onbekend';
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium' }).format(
    new Date(parsed),
  );
}

export function formatPercent(value: number | null): string {
  if (value === null) return 'Onbekend';
  return `${Math.round(value * 100)}%`;
}

export function relativeDays(value: string | null): string {
  if (!value) return 'Onbekend';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return 'Onbekend';
  const days = Math.round((Date.now() - parsed) / 86_400_000);
  if (days <= 0) return 'vandaag';
  if (days === 1) return 'gisteren';
  return `${days} dagen geleden`;
}
