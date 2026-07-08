"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type Tone = "slate" | "emerald" | "amber" | "rose" | "blue" | "indigo";

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
    chip: "bg-slate-100 text-slate-700",
    fill: "bg-[var(--color-surface-muted)] text-[var(--color-ink)]",
    progress: "bg-slate-500",
  },
  emerald: {
    card: "border-teal-200 bg-[var(--color-surface)]",
    label: "text-[var(--color-primary-strong)]",
    chip: "bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]",
    fill: "bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]",
    progress: "bg-[var(--color-primary)]",
  },
  amber: {
    card: "border-amber-200 bg-[var(--color-surface)]",
    label: "text-amber-700",
    chip: "bg-[var(--color-warning-soft)] text-amber-900",
    fill: "bg-[var(--color-warning-soft)] text-amber-950",
    progress: "bg-amber-500",
  },
  rose: {
    card: "border-rose-200 bg-[var(--color-surface)]",
    label: "text-rose-700",
    chip: "bg-[var(--color-danger-soft)] text-rose-900",
    fill: "bg-[var(--color-danger-soft)] text-rose-950",
    progress: "bg-rose-500",
  },
  blue: {
    card: "border-blue-200 bg-[var(--color-surface)]",
    label: "text-blue-700",
    chip: "bg-[var(--color-info-soft)] text-blue-900",
    fill: "bg-[var(--color-info-soft)] text-blue-950",
    progress: "bg-[var(--color-info)]",
  },
  indigo: {
    card: "border-indigo-200 bg-[var(--color-surface)]",
    label: "text-indigo-700",
    chip: "bg-indigo-100 text-indigo-900",
    fill: "bg-indigo-50 text-indigo-950",
    progress: "bg-indigo-500",
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
          className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-soft)] transition hover:text-[var(--color-ink)]"
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
      className={`card-hover rounded-2xl border p-4 shadow-[var(--shadow-card)] ${styles.card}`}
    >
      <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${styles.label}`}>{label}</p>
      {title ? <h3 className="mt-1 text-base font-semibold text-[var(--color-ink)]">{title}</h3> : null}
      <div className="mt-2 text-[var(--color-ink-muted)]">{children}</div>
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
      className={`inline-flex min-h-7 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-transform duration-200 hover:-translate-y-0.5 ${styles.chip}`}
    >
      <span>{label}</span>
      {value ? <span className="opacity-80">{value}</span> : null}
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
    <details className={`rounded-2xl border p-4 shadow-sm ${styles.card}`}>
      <summary className={`cursor-pointer text-sm font-semibold ${styles.label}`}>
        {title}
      </summary>
      <div className="mt-3 text-sm leading-6 text-[var(--color-ink-muted)]">{children}</div>
    </details>
  );
}

export function StepProgress({
  current,
  total,
  label = "Turn progress",
}: {
  current: number;
  total: number;
  label?: string;
}) {
  const safeTotal = Math.max(1, total);
  const progressPercent = Math.min(100, Math.round((current / safeTotal) * 100));

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">{label}</p>
        <p className="text-xs font-semibold text-[var(--color-ink-muted)]">
          {current} / {safeTotal}
        </p>
      </div>
      <div className="mt-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-strong)] transition-[width] duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
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
  const safeScore = Math.max(1, Math.min(10, score));

  return (
    <section className="relative overflow-hidden rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--color-primary-ink)] via-[var(--color-primary-strong)] to-[var(--color-primary-ink)] p-5 text-white shadow-[var(--shadow-soft)]">
      <div
        aria-hidden
        className="animate-pulse-glow pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-300/30 blur-3xl"
      />
      <p className="relative text-xs font-semibold uppercase tracking-[0.12em] text-teal-100">Score</p>
      <div className="relative mt-3 flex items-end gap-2">
        <span className="text-6xl font-semibold tracking-tight">{safeScore}</span>
        <span className="pb-2 text-lg font-semibold text-teal-100">/ 10</span>
      </div>
      <div className="relative mt-5 overflow-hidden rounded-full bg-white/20">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-teal-300 to-teal-100 transition-[width] duration-700 ease-out"
          style={{ width: `${safeScore * 10}%` }}
        />
      </div>
      <p className="relative mt-3 text-sm font-semibold text-teal-100">{label}</p>
    </section>
  );
}

