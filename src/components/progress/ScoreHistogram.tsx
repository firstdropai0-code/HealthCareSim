"use client";

import { motion } from "framer-motion";
import { useShouldAnimate } from "@/components/motion/useShouldAnimate";
import { useT } from "@/lib/i18n/strings";
import { scoreHistogram } from "@/lib/progress/cohortStats";

const WIDTH = 320;
const HEIGHT = 120;
const BASELINE = HEIGHT - 18;

/** Distribution of overall scores across a group. Hand-rolled, same as the rest. */
export function ScoreHistogram({ scores }: { scores: number[] }) {
  const shouldAnimate = useShouldAnimate();
  const t = useT();

  if (scores.length === 0) {
    return (
      <p className="text-sm leading-6 text-[var(--color-ink-soft)]">
        {t("histogram.empty")}
      </p>
    );
  }

  const bins = scoreHistogram(scores);
  const peak = Math.max(...bins.map((bin) => bin.count), 1);
  const slot = WIDTH / bins.length;
  const barWidth = slot * 0.62;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={bins
          .filter((bin) => bin.count > 0)
          .map((bin) => t("histogram.barAria", { count: bin.count, score: bin.score }))
          .join(", ")}
      >
        <line
          x1={0}
          y1={BASELINE}
          x2={WIDTH}
          y2={BASELINE}
          stroke="var(--color-border)"
          strokeWidth={1}
        />

        {bins.map((bin, index) => {
          const height = (bin.count / peak) * (BASELINE - 8);
          const x = index * slot + (slot - barWidth) / 2;

          return (
            <g key={bin.score}>
              {shouldAnimate ? (
                <motion.rect
                  x={x}
                  width={barWidth}
                  rx={2}
                  fill="var(--color-primary)"
                  initial={{ y: BASELINE, height: 0 }}
                  animate={{ y: BASELINE - height, height }}
                  transition={{ duration: 0.6, delay: index * 0.03, ease: [0.215, 0.61, 0.355, 1] }}
                />
              ) : (
                <rect
                  x={x}
                  y={BASELINE - height}
                  width={barWidth}
                  height={height}
                  rx={2}
                  fill="var(--color-primary)"
                />
              )}
              <text
                x={x + barWidth / 2}
                y={HEIGHT - 5}
                textAnchor="middle"
                fontSize={9}
                fill="var(--color-ink-soft)"
              >
                {bin.score}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 text-[0.8125rem] text-[var(--color-ink-soft)]">
        {t.plural("histogram.caption", scores.length)}
      </figcaption>
    </figure>
  );
}
