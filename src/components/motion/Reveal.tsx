"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import {
  revealVariants,
  staggerContainer,
  viewportOnce,
} from "@/components/motion/motionConfig";
import { useShouldAnimate } from "@/components/motion/useShouldAnimate";

type As = "div" | "section" | "li" | "article" | "header" | "ul" | "ol";

/**
 * Fades and rises its children into view once. Wrap several in a
 * `RevealGroup` to stagger them instead of passing individual delays.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: As;
}) {
  const shouldAnimate = useShouldAnimate();
  const Tag = motion[as as "div"];

  // No animation: render the settled element. Content is never gated behind
  // an entrance that may not run.
  // Render a plain element, not the motion one. Framer Motion does not clear
  // inline styles it has already written, so reusing the motion component here
  // would leave the hydrated `opacity: 0` stuck on the node forever. Swapping
  // the element type forces React to mount a clean, unstyled node.
  if (!shouldAnimate) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <Tag
      className={className}
      variants={revealVariants}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      transition={delay ? { delay } : undefined}
    >
      {children}
    </Tag>
  );
}

/**
 * Staggers direct `RevealItem` children as the group scrolls into view.
 */
export function RevealGroup({
  children,
  className = "",
  stagger = 0.07,
  delayChildren = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delayChildren?: number;
  as?: As;
}) {
  const shouldAnimate = useShouldAnimate();
  const Tag = motion[as as "div"];

  // Render a plain element, not the motion one. Framer Motion does not clear
  // inline styles it has already written, so reusing the motion component here
  // would leave the hydrated `opacity: 0` stuck on the node forever. Swapping
  // the element type forces React to mount a clean, unstyled node.
  if (!shouldAnimate) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <Tag
      className={className}
      variants={staggerContainer(stagger, delayChildren)}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
    >
      {children}
    </Tag>
  );
}

/** A single item inside a `RevealGroup`. */
export function RevealItem({
  children,
  className = "",
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: As;
}) {
  const shouldAnimate = useShouldAnimate();
  const Tag = motion[as as "div"];

  // Render a plain element, not the motion one. Framer Motion does not clear
  // inline styles it has already written, so reusing the motion component here
  // would leave the hydrated `opacity: 0` stuck on the node forever. Swapping
  // the element type forces React to mount a clean, unstyled node.
  if (!shouldAnimate) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <Tag className={className} variants={revealVariants}>
      {children}
    </Tag>
  );
}
