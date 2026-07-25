"use client";

import { animate, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { EASE_OUT_CUBIC } from "@/components/motion/motionConfig";
import { useShouldAnimate } from "@/components/motion/useShouldAnimate";

/**
 * Counts up to `value` the first time it scrolls into view. Purely
 * presentational — the number always lands on, and never reads below, `value`.
 */
export function AnimatedNumber({
  value,
  duration = 1.1,
  className = "",
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const shouldAnimate = useShouldAnimate();
  const [counted, setCounted] = useState(value);

  useEffect(() => {
    if (!shouldAnimate || !isInView) {
      return undefined;
    }

    const controls = animate(0, value, {
      duration,
      ease: EASE_OUT_CUBIC,
      onUpdate: (latest) => setCounted(Math.round(latest)),
    });

    return () => controls.stop();
  }, [duration, isInView, shouldAnimate, value]);

  // When not animating, render `value` directly rather than tracked state, so
  // a score is never briefly readable as the wrong number.
  const shown = shouldAnimate ? counted : value;

  return (
    <span ref={ref} className={className}>
      {shown}
    </span>
  );
}
