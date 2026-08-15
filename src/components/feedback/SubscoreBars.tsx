"use client";

import { motion } from "framer-motion";
import { EASE_OUT_CUBIC } from "@/components/motion/motionConfig";
import { useShouldAnimate } from "@/components/motion/useShouldAnimate";
import {
  subscoreDimensions,
  subscoreLabels,
  type SkillSubscores,
} from "@/types/feedback";

/** Matches `scoreLabel` in FeedbackReportView so the bands read consistently. */
function bandFor(score: number): { label: string; fill: string; ink: string } {
  if (score >= 8) {
    return {
      label: "Strong",
      fill: "bg-[var(--color-primary)]",
      ink: "text-[var(--color-primary-ink)]",
    };
  }

  if (score >= 6) {
    return {
      label: "Developing",
      fill: "bg-[var(--color-warning)]",
      ink: "text-[var(--color-warning)]",
    };
  }

  return {
    label: "Needs focus",
    fill: "bg-[var(--color-danger)]",
    ink: "text-[var(--color-danger)]",
  };
}

export function SubscoreBars({ subscores }: { subscores: SkillSubscores }) {
  const shouldAnimate = useShouldAnimate();

  return (
    <div className="grid gap-3">
      {subscoreDimensions.map((dimension, index) => {
        const score = Math.max(1, Math.min(10, subscores[dimension]));
        const band = bandFor(score);

        return (
          <div key={dimension}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[0.9375rem] font-medium text-[var(--color-ink)]">
                {subscoreLabels[dimension]}
              </p>
              <p className="text-xs font-semibold tabular-nums text-[var(--color-ink)]">
                {score}
                <span className="font-normal text-[var(--color-ink-soft)]"> / 10</span>
              </p>
            </div>

            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
              {/* Scales rather than animating width, and renders statically when
                  motion is off so the bar is never left at zero. */}
              {shouldAnimate ? (
                <motion.div
                  className={`h-full origin-left rounded-full ${band.fill}`}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: score / 10 }}
                  transition={{ duration: 0.8, delay: index * 0.06, ease: EASE_OUT_CUBIC }}
                />
              ) : (
                <div
                  className={`h-full origin-left rounded-full ${band.fill}`}
                  style={{ transform: `scaleX(${score / 10})` }}
                />
              )}
            </div>

            <p className={`eyebrow eyebrow-tight mt-1 ${band.ink}`}>{band.label}</p>
          </div>
        );
      })}
    </div>
  );
}
