'use client';

import * as React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

/**
 * Scroll-reveal primitives.
 *
 * One easing curve and one distance across the whole site, so motion reads as
 * a property of the product rather than a per-section decision. The curve
 * matches the event cards: a quick start that settles, never a bounce.
 *
 * Everything collapses to a plain render under `prefers-reduced-motion`. That
 * is not a nicety: content that only appears on scroll must still appear for
 * someone who asked the system to stop moving things.
 */

const EASE = [0.22, 1, 0.36, 1] as const;
const DISTANCE = 16;

/**
 * Trigger margin, in pixels.
 *
 * Framer passes this straight to IntersectionObserver's `rootMargin`. Percent
 * values are not reliably accepted there, and a rejected margin means no
 * observer at all - which would leave revealed content stuck at opacity 0.
 */
const VIEWPORT = { once: true, margin: '0px 0px -80px 0px' } as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: DISTANCE },
  visible: { opacity: 1, y: 0 },
};

/** Reveals once, the first time it scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = 'div',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'span';
}) {
  const reduceMotion = useReducedMotion();
  const Component = motion[as];

  return (
    <Component
      className={className}
      variants={fadeUp}
      initial={reduceMotion ? false : 'hidden'}
      whileInView="visible"
      viewport={VIEWPORT}
      transition={{ duration: 0.5, delay: reduceMotion ? 0 : delay, ease: EASE }}
    >
      {children}
    </Component>
  );
}

const groupVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: DISTANCE },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/**
 * Staggers its `RevealItem` children.
 *
 * Variants only propagate through motion components, so every direct child
 * must be a `RevealItem`. A plain element in between silently breaks the chain
 * and those children never leave their hidden state.
 */
export function RevealGroup({
  children,
  className,
  as = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'ul' | 'ol' | 'dl';
}) {
  const reduceMotion = useReducedMotion();
  const Component = motion[as];

  return (
    <Component
      className={className}
      variants={groupVariants}
      initial={reduceMotion ? false : 'hidden'}
      whileInView="visible"
      viewport={VIEWPORT}
    >
      {children}
    </Component>
  );
}

export function RevealItem({
  children,
  className,
  as = 'li',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'li' | 'div';
}) {
  const Component = motion[as];
  return (
    <Component className={className} variants={itemVariants}>
      {children}
    </Component>
  );
}

/**
 * The holo rule, drawn in from the left as it scrolls into view.
 *
 * It is a section divider, so animating it is what signals a new section has
 * started - the one piece of motion here that carries meaning rather than
 * polish.
 */
export function HoloRule({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      aria-hidden="true"
      className={className}
      initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
      whileInView={{ scaleX: 1, opacity: 1 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.8, ease: EASE }}
      style={{ transformOrigin: 'left' }}
    >
      <div className="holo-rule" />
    </motion.div>
  );
}

/**
 * Lifts on hover, matching the event cards exactly so a hover feels the same
 * everywhere. Carries no reveal variants of its own: wrap it in a `RevealItem`
 * when it also needs to fade in.
 */
export function HoverLift({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      whileHover={reduceMotion ? undefined : { y: -5 }}
      transition={{ duration: 0.25, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
