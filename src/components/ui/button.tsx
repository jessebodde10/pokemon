import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * The primary action carries the holo gradient - it is one of the three places
 * the sheen is allowed to appear. Every other variant stays flat so a screen
 * never has two things competing to be the obvious next step.
 */
const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: [
          'text-[var(--color-ink-950)]',
          'bg-[linear-gradient(100deg,var(--color-holo-violet),var(--color-holo-cyan)_32%,var(--color-gold)_58%,var(--color-holo-pink))]',
          'bg-[length:200%_100%] bg-[position:0%_0%]',
          'hover:bg-[position:100%_0%]',
          'shadow-[0_6px_24px_-8px_color-mix(in_oklab,var(--color-holo-violet)_80%,transparent)]',
          'hover:shadow-[0_10px_30px_-8px_color-mix(in_oklab,var(--color-holo-cyan)_70%,transparent)]',
        ].join(' '),
        secondary:
          'bg-white/[0.08] text-[var(--text-primary)] hover:bg-white/[0.14]',
        outline:
          'border border-[var(--border-subtle)] bg-transparent text-[var(--text-primary)] hover:border-white/30 hover:bg-white/[0.05]',
        ghost:
          'bg-transparent text-[var(--text-muted)] hover:bg-white/[0.06] hover:text-[var(--text-primary)]',
        danger:
          'border border-[color-mix(in_oklab,var(--color-critical)_45%,transparent)] bg-transparent text-[var(--color-critical)] hover:bg-[color-mix(in_oklab,var(--color-critical)_16%,transparent)]',
      },
      size: {
        // 40px rather than 36: `sm` carries real actions on a phone, including
        // the header call to action. A full 44 would force a density change
        // across every screen in the app.
        sm: 'h-10 px-4',
        md: 'h-11 px-6',
        lg: 'h-13 px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Component = asChild ? Slot : 'button';
    return (
      <Component
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
