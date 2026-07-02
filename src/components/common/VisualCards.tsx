import type { ReactNode } from "react";

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

export function ReadMoreText({
  text,
  maxLength = 150,
}: {
  text: string;
  maxLength?: number;
}) {
  const cleanText = text.trim();

  if (cleanText.length <= maxLength) {
    return <p className="text-sm leading-6">{cleanText}</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm leading-6">{compactText(cleanText, maxLength)}</p>
      <details>
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-soft)] transition hover:text-[var(--color-ink)]">
          Show more
        </summary>
        <p className="mt-2 text-sm leading-6">{cleanText}</p>
      </details>
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
    <article className={`rounded-2xl border p-4 shadow-[var(--shadow-card)] ${styles.card}`}>
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
    <span className={`inline-flex min-h-7 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${styles.chip}`}>
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
          className="h-2 rounded-full bg-[var(--color-primary)] transition-all"
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
    <section className="rounded-[var(--radius-lg)] bg-[var(--color-primary-ink)] p-5 text-white shadow-[var(--shadow-soft)]">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-100">Score</p>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-6xl font-semibold tracking-tight">{safeScore}</span>
        <span className="pb-2 text-lg font-semibold text-teal-100">/ 10</span>
      </div>
      <div className="mt-5 overflow-hidden rounded-full bg-white/20">
        <div
          className="h-2 rounded-full bg-teal-200"
          style={{ width: `${safeScore * 10}%` }}
        />
      </div>
      <p className="mt-3 text-sm font-semibold text-teal-100">{label}</p>
    </section>
  );
}

export function VoiceMetricCard({
  metrics,
}: {
  metrics: Array<{ label: string; value: string; tone?: Tone }>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {metrics.map((metric) => {
        const styles = toneStyles[metric.tone ?? "indigo"];

        return (
          <div key={metric.label} className={`rounded-2xl px-3 py-2 ${styles.fill}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em]">{metric.label}</p>
            <p className="mt-1 text-sm font-semibold capitalize">{metric.value}</p>
          </div>
        );
      })}
    </div>
  );
}
