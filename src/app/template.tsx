"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { EASE_OUT_CUBIC } from "@/components/motion/motionConfig";
import { useShouldAnimate } from "@/components/motion/useShouldAnimate";

/**
 * App Router remounts a `template` on every navigation, so this gives each
 * route a short entrance. Deliberately brief and transform-only: a page
 * transition should smooth the change, not make the user wait for it.
 */
export default function Template({ children }: { children: ReactNode }) {
  const shouldAnimate = useShouldAnimate();

  // Never gate a whole page behind an animation that might not run.
  if (!shouldAnimate) {
    return <>{children}</>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_OUT_CUBIC }}
    >
      {children}
    </motion.div>
  );
}
