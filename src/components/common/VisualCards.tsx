"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion } from "framer-motion";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { EASE_OUT_CUBIC } from "@/components/motion/motionConfig";
import { useShouldAnimate } from "@/components/motion/useShouldAnimate";

type Tone = "slate" | "emerald" | "amber" | "rose" | "blue" | "indigo";

// Every tone is a hairline-bordered paper panel; the tone shows only in the
// label ink and a left rule, never in a filled pastel background.
const toneStyles: Record<
  Tone,
  {
    card: string;
    label: string;
    chip: string;
    fill: string;
    progress: string;
  }
> = {
  slate: {
    card: "border-[var(--color-border)] bg-[var(--color-surface)]",
    label: "text-[var(--color-ink-soft)]",
    chip: "border-[var(--color-border-strong)] text-[var(--color-ink-muted)]",
    fill: "bg-[var(--color-surface-muted)] text-[var(--color-ink)]",
    progress: "bg-[var(--color-ink-muted)]",
  },
  emerald: {
    card: "border-[var(--color-border)] bg-[var(--color-surface)]",
    label: "text-[var(--color-primary)]",
    chip: "border-[var(--color-primary)] text-[var(--color-primary-ink)]",
    fill: "bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]",
    progress: "bg-[var(--color-primary)]",
  },
  amber: {
    card: "border-[var(--color-border)] bg-[var(--color-surface)]",
    label: "text-[var(--color-warning)]",
    chip: "border-[var(--color-warning)] text-[var(--color-warning)]",
    fill: "bg-[var(--color-warning-soft)] text-[var(--color-ink)]",
    progress: "bg-[var(--color-warning)]",
  },
  rose: {
    card: "border-[var(--color-border)] bg-[var(--color-surface)]",
    label: "text-[var(--color-danger)]",
    chip: "border-[var(--color-danger)] text-[var(--color-danger)]",
    fill: "bg-[var(--color-danger-soft)] text-[var(--color-ink)]",
    progress: "bg-[var(--color-danger)]",
  },
  blue: {
    card: "border-[var(--color-border)] bg-[var(--color-surface)]",
    label: "text-[var(--color-info)]",
    chip: "border-[var(--color-info)] text-[var(--color-info)]",
    fill: "bg-[var(--color-info-soft)] text-[var(--color-ink)]",
    progress: "bg-[var(--color-info)]",
  },
  indigo: {
    card: "border-[var(--color-border)] bg-[var(--color-surface)]",
    label: "text-[var(--color-ink-muted)]",
    chip: "border-[var(--color-border-strong)] text-[var(--color-ink-muted)]",
    fill: "bg-[var(--color-surface-muted)] text-[var(--color-ink)]",
    progress: "bg-[var(--color-ink-muted)]",
  },
};

export function compactText(text: string, maxLength = 150): string {
  const cleanText = text.trim();

  if (cleanText.length <= maxLength) {
    return cleanText;
  }

  return `${cleanText.slice(0, maxLength).trim()}...`;
}

const collapsedTextStyle: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 6,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

export function ReadMoreText({
  text,
  maxLength: _maxLength = 150,
}: {
  text: string;
  maxLength?: number;
}) {
  const cleanText = text.trim();
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasClampedOverflow, setHasClampedOverflow] = useState(false);

  useEffect(() => {
    const element = textRef.current;

    if (!element) {
      return undefined;
    }

    setIsExpanded(false);

    const measureOverflow = () => {
      const originalStyle = element.getAttribute("style");

      element.style.display = "-webkit-box";
      element.style.setProperty("-webkit-line-clamp", "6");
      element.style.setProperty("-webkit-box-orient", "vertical");
      element.style.overflow = "hidden";
      setHasClampedOverflow(element.scrollHeight > element.clientHeight + 1);

      if (originalStyle === null) {
        element.removeAttribute("style");
      } else {
        element.setAttribute("style", originalStyle);
      }
    };

    const frame = window.requestAnimationFrame(measureOverflow);
    window.addEventListener("resize", measureOverflow);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measureOverflow);
    };
  }, [cleanText]);

  return (
    <div className="space-y-2">
      <p
        ref={textRef}
        className="text-sm leading-6"
        style={isExpanded ? undefined : collapsedTextStyle}
      >
        {cleanText}
      </p>
      {hasClampedOverflow ? (
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="link-editorial eyebrow eyebrow-tight text-[var(--color-ink-soft)] transition hover:text-[var(--color-ink)]"
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}

export function InfoCard({
  label,
  title,
  children,
  tone = "slate",
}: {
  label: string;
  title?: string;
  children: ReactNode;
  tone?: Tone;
}) {
  const styles = toneStyles[tone];

  return (
    <article
      className={`card-hover rounded-[var(--radius-lg)] border p-4 shadow-[var(--shadow-card)] ${styles.card}`}
    >
      <p className={`eyebrow ${styles.label}`}>{label}</p>
      {title ? <h3 className="display-sm mt-1.5">{title}</h3> : null}
      <div className="mt-2 text-[0.8125rem] leading-6 text-[var(--color-ink-muted)]">{children}</div>
    </article>
  );
}

export function MetricChip({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value?: string;
  tone?: Tone;
}) {
  const styles = toneStyles[tone];

  return (
    <span
      className={`eyebrow eyebrow-tight inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-0.5 transition-all duration-[350ms] ease-[cubic-bezier(0.215,0.61,0.355,1)] hover:-translate-y-px hover:shadow-[var(--shadow-card)] ${styles.chip}`}
    >
      <span>{label}</span>
      {value ? (
        <span className="text-[0.6875rem] font-semibold normal-case tracking-normal">{value}</span>
      ) : null}
    </span>
  );
}

export function CollapsibleSection({
  title,
  children,
  tone = "slate",
}: {
  title: string;
  children: ReactNode;
  tone?: Tone;
}) {
  const styles = toneStyles[tone];

  return (
    <details className={`rounded-[var(--radius-lg)] border p-4 ${styles.card}`}>
      <summary className={`eyebrow cursor-pointer ${styles.label}`}>{title}</summary>
      <div className="mt-3 text-sm leading-6 text-[var(--color-ink-muted)]">{children}</div>
    </details>
  );
}

export function StepProgress({
  current,
  total,
  label = "Turn progress",
  hint,
}: {
  current: number;
  total: number;
  label?: string;
  /** Small caption under the bar, for explaining what the total means. */
  hint?: string;
}) {
  const safeTotal = Math.max(1, total);
  const progressPercent = Math.min(100, Math.round((current / safeTotal) * 100));

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow text-[var(--color-ink-soft)]">{label}</p>
        <p className="text-xs font-semibold tabular-nums text-[var(--color-ink)]">
          {current} / {safeTotal}
        </p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
        <motion.div
          className="h-full origin-left rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[#3fb3a6]"
          initial={false}
          animate={{ scaleX: progressPercent / 100 }}
          transition={{ duration: 0.6, ease: EASE_OUT_CUBIC }}
          style={{ width: "100%" }}
        />
      </div>
      {hint ? (
        <p className="mt-2 text-[0.6875rem] leading-4 text-[var(--color-ink-soft)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function ScoreCard({
  score,
  label,
}: {
  score: number;
  label: string;
}) {
  const shouldAnimate = useShouldAnimate();
  const safeScore = Math.max(1, Math.min(10, score));

  return (
    <section className="accent-edge rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
      <p className="eyebrow text-[var(--color-ink-soft)]">Score</p>
      <div className="mt-2 flex items-baseline gap-1.5">
        <AnimatedNumber
          value={safeScore}
          className="text-4xl font-semibold tabular-nums leading-none text-[var(--color-primary)]"
        />
        <span className="text-base font-medium text-[var(--color-ink-soft)]">/ 10</span>
      </div>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
        {/* Scales rather than animating width, so the fill stays on the GPU. */}
        {shouldAnimate ? (
          <motion.div
            className="h-full origin-left rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[#3fb3a6]"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: safeScore / 10 }}
            transition={{ duration: 1.1, ease: EASE_OUT_CUBIC }}
          />
        ) : (
          <div
            className="h-full origin-left rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[#3fb3a6]"
            style={{ transform: `scaleX(${safeScore / 10})` }}
          />
        )}
      </div>
      <p className="eyebrow mt-3 text-[var(--color-primary-ink)]">{label}</p>
    </section>
  );
}

