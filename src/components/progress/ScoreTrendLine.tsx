"use client";

import { motion } from "framer-motion";
import { useShouldAnimate } from "@/components/motion/useShouldAnimate";

const WIDTH = 320;
const HEIGHT = 96;
const PADDING = 8;

/**
 * Oldest run on the left. A sparkline, not a full chart — no axes, because the
 * only question it answers is "is this going up".
 */
export function ScoreTrendLine({
  series,
}: {
  series: { completedAt: string; score: number }[];
}) {
  const shouldAnimate = useShouldAnimate();

  if (series.length < 2) {
    return (
      <p className="text-sm leading-6 text-[var(--color-ink-soft)]">
        Two scored cases will start your trend line.
      </p>
    );
  }

  const stepX = (WIDTH - PADDING * 2) / (series.length - 1);
  const yFor = (score: number) =>
    HEIGHT - PADDING - ((score - 1) / 9) * (HEIGHT - PADDING * 2);

  const points = series.map((entry, index) => ({
    x: PADDING + index * stepX,
    y: yFor(entry.score),
    score: entry.score,
  }));

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Scores over ${series.length} cases, oldest first: ${series
          .map((entry) => entry.score)
          .join(", ")}`}
      >
        {/* Midpoint reference at 5.5, so a line can be read as above or below. */}
        <line
          x1={PADDING}
          y1={yFor(5.5)}
          x2={WIDTH - PADDING}
          y2={yFor(5.5)}
          stroke="var(--color-border)"
          strokeWidth={1}
          strokeDasharray="3 4"
        />

        {shouldAnimate ? (
          <motion.path
            d={path}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: [0.215, 0.61, 0.355, 1] }}
          />
        ) : (
          <path
            d={path}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {points.map((point, index) => (
          <circle
            key={`${series[index].completedAt}-${index}`}
            cx={point.x}
            cy={point.y}
            r={index === points.length - 1 ? 4 : 2.5}
            fill="var(--color-primary)"
          />
        ))}
      </svg>

      <figcaption className="mt-2 flex justify-between text-[0.8125rem] text-[var(--color-ink-soft)]">
        <span>Oldest</span>
        <span>Latest · {series[series.length - 1].score}/10</span>
      </figcaption>
    </figure>
  );
}
