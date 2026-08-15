"use client";

import { motion } from "framer-motion";
import { useShouldAnimate } from "@/components/motion/useShouldAnimate";
import type { DimensionProgress } from "@/lib/progress/progressModel";
import { subscoreLabels } from "@/types/feedback";

const SIZE = 220;
const CENTER = SIZE / 2;
const RADIUS = 74;
const RINGS = [0.25, 0.5, 0.75, 1];

/** Angle for axis `index`, starting at the top and going clockwise. */
function pointAt(index: number, count: number, distance: number) {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;

  return {
    x: CENTER + Math.cos(angle) * distance,
    y: CENTER + Math.sin(angle) * distance,
  };
}

function polygon(values: number[], scale = 1): string {
  return values
    .map((value, index) => {
      const point = pointAt(index, values.length, (value / 10) * RADIUS * scale);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * Hand-rolled rather than pulling in a chart library: it is one polygon on a
 * fixed viewBox, it inherits the CSS-variable palette directly, and it can
 * render a static shape when motion is off without fighting a library's own
 * animation lifecycle.
 */
export function SubscoreRadar({ dimensions }: { dimensions: DimensionProgress[] }) {
  const shouldAnimate = useShouldAnimate();
  const rated = dimensions.filter((entry) => entry.mastery !== null);

  if (rated.length < 3) {
    return (
      <p className="text-sm leading-6 text-[var(--color-ink-soft)]">
        Complete a scored case to see your skill profile.
      </p>
    );
  }

  const values = rated.map((entry) => entry.mastery as number);
  const shape = polygon(values);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto h-auto w-full max-w-[260px]"
        role="img"
        aria-label={rated
          .map((entry) => `${subscoreLabels[entry.dimension]} ${(entry.mastery as number).toFixed(1)} out of 10`)
          .join(", ")}
      >
        {RINGS.map((ring) => (
          <polygon
            key={ring}
            points={polygon(rated.map(() => 10), ring)}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={1}
          />
        ))}

        {rated.map((entry, index) => {
          const outer = pointAt(index, rated.length, RADIUS);
          return (
            <line
              key={entry.dimension}
              x1={CENTER}
              y1={CENTER}
              x2={outer.x}
              y2={outer.y}
              stroke="var(--color-border)"
              strokeWidth={1}
            />
          );
        })}

        {shouldAnimate ? (
          <motion.polygon
            points={shape}
            fill="var(--color-primary-soft)"
            stroke="var(--color-primary)"
            strokeWidth={2}
            strokeLinejoin="round"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.215, 0.61, 0.355, 1] }}
            style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
          />
        ) : (
          <polygon
            points={shape}
            fill="var(--color-primary-soft)"
            stroke="var(--color-primary)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}

        {rated.map((entry, index) => {
          const point = pointAt(index, rated.length, (values[index] / 10) * RADIUS);
          return (
            <circle
              key={`${entry.dimension}-dot`}
              cx={point.x}
              cy={point.y}
              r={3}
              fill="var(--color-primary)"
            />
          );
        })}
      </svg>

      {/* Labels live outside the SVG so they wrap and scale with the page text.
          Trend sits here too rather than in a second card repeating the same
          five numbers with nothing added. */}
      <figcaption className="mt-4 grid gap-2">
        {rated.map((entry) => {
          const rising = entry.trend !== null && entry.trend > 0.25;
          const falling = entry.trend !== null && entry.trend < -0.25;

          return (
            <span
              key={entry.dimension}
              className="flex items-baseline justify-between gap-3 border-b border-[var(--color-border)] pb-1.5 text-[0.8125rem] last:border-b-0"
            >
              <span className="text-[var(--color-ink-muted)]">
                {subscoreLabels[entry.dimension]}
              </span>
              <span className="flex items-baseline gap-2">
                {entry.trend !== null ? (
                  <span
                    className={`text-xs tabular-nums ${
                      rising
                        ? "text-[var(--color-primary)]"
                        : falling
                          ? "text-[var(--color-danger)]"
                          : "text-[var(--color-ink-soft)]"
                    }`}
                  >
                    {rising ? "▲" : falling ? "▼" : "–"}{" "}
                    {Math.abs(entry.trend) < 0.05 ? "" : Math.abs(entry.trend).toFixed(1)}
                  </span>
                ) : null}
                <span className="font-semibold tabular-nums text-[var(--color-ink)]">
                  {(entry.mastery as number).toFixed(1)}
                </span>
              </span>
            </span>
          );
        })}
      </figcaption>

      <p className="mt-3 text-xs leading-5 text-[var(--color-ink-soft)]">
        {rated.some((entry) => entry.trend !== null)
          ? "Arrows compare your last 3 cases with the 3 before them."
          : "Movement arrows appear once you have 6 scored cases."}
      </p>
    </figure>
  );
}
