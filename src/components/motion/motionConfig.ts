import type { Transition, Variants } from "framer-motion";

/**
 * Shared motion vocabulary. Curves and durations mirror the CSS custom
 * properties in globals.css so JS-driven and CSS-driven motion feel identical.
 */

/** easeOutCubic — the workhorse curve for entrances and hovers. */
export const EASE_OUT_CUBIC = [0.215, 0.61, 0.355, 1] as const;

/** easeOutQuad — gentler tail, used for longer reveals. */
export const EASE_OUT_QUAD = [0.25, 0.46, 0.45, 0.94] as const;

/** Springs tuned to settle quickly without visible wobble. */
export const springSoft: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 30,
  mass: 0.8,
};

export const springSnappy: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.6,
};

export const revealTransition: Transition = {
  duration: 0.7,
  ease: EASE_OUT_CUBIC,
};

/** Distance a revealing element travels. Small — motion should be felt, not watched. */
const RISE = 18;

export const revealVariants: Variants = {
  hidden: { opacity: 0, y: RISE },
  visible: { opacity: 1, y: 0, transition: revealTransition },
};

/** Parent wrapper that walks its children in one after another. */
export function staggerContainer(stagger = 0.07, delayChildren = 0): Variants {
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger, delayChildren },
    },
  };
}

/**
 * Viewport config: fire a little before the element is fully on screen, once.
 *
 * The bottom margin is POSITIVE, which extends the observed area below the fold
 * so content animates in just before it is scrolled to. It was negative, which
 * shrinks the area and does the opposite — anything sitting just past the fold
 * stayed blank until the user scrolled it well into view, which reads as a
 * page that failed to load rather than one that is animating.
 */
export const viewportOnce = { once: true, amount: 0.15, margin: "0px 0px 15% 0px" };
