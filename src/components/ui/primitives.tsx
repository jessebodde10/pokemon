import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Small shared primitives. Kept in one file because each is a handful of
 * lines; anything that grows its own behaviour moves to a dedicated module.
 */

export function Panel({
  className,
  raised = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { raised?: boolean }) {
  return (
    <div
      className={cn(raised ? 'panel-raised' : 'panel', 'p-5 sm:p-6', className)}
      {...props}
    />
  );
}

export function SectionHeading({
  title,
  description,
  action,
  id,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2
          id={id}
          className="text-xl font-semibold tracking-tight sm:text-2xl"
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-white/[0.07] text-[var(--color-ink-100)]',
        accent:
          'bg-[color-mix(in_oklab,var(--color-holo-violet)_26%,transparent)] text-[color-mix(in_oklab,var(--color-holo-cyan)_70%,white)]',
        positive:
          'bg-[color-mix(in_oklab,var(--color-positive)_20%,transparent)] text-[var(--color-positive)]',
        caution:
          'bg-[color-mix(in_oklab,var(--color-caution)_20%,transparent)] text-[var(--color-caution)]',
        critical:
          'bg-[color-mix(in_oklab,var(--color-critical)_20%,transparent)] text-[var(--color-critical)]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--color-ink-950)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--color-ink-500)] disabled:opacity-60',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--color-ink-950)] px-3 text-sm text-[var(--text-primary)]',
      className,
    )}
    {...props}
  />
));
Select.displayName = 'Select';

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        'mb-1.5 block text-sm font-medium text-[var(--text-muted)]',
        className,
      )}
      {...props}
    />
  );
}

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('skeleton rounded-xl', className)}
      {...props}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icon ? (
        <div className="text-[var(--color-holo-cyan)]">{icon}</div>
      ) : null}
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-md text-sm text-[var(--text-muted)]">{description}</p>
      {action}
    </div>
  );
}

/**
 * Confidence meter. Always shown with its numeric value so the colour is a
 * secondary cue rather than the only information carrier.
 */
export function ConfidenceMeter({
  value,
  label = 'Herkenningszekerheid',
}: {
  value: number | null;
  label?: string;
}) {
  if (value === null) {
    return (
      <span className="text-xs text-[var(--text-muted)]">
        {label}: onbekend
      </span>
    );
  }
  const percent = Math.round(value * 100);
  const tone =
    percent >= 80
      ? 'var(--color-positive)'
      : percent >= 60
        ? 'var(--color-caution)'
        : 'var(--color-critical)';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <div
        className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-ink-800)]"
        role="img"
        aria-label={`${label}: ${percent} procent`}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${percent}%`, backgroundColor: tone }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums">{percent}%</span>
    </div>
  );
}
