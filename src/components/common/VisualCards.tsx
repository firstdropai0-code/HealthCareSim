import type { ReactNode } from "react";

type Tone = "slate" | "emerald" | "amber" | "rose" | "blue" | "indigo";

const toneStyles: Record<
  Tone,
  {
    card: string;
    label: string;
    chip: string;
    fill: string;
  }
> = {
  slate: {
    card: "border-slate-200 bg-white",
    label: "text-slate-500",
    chip: "bg-slate-100 text-slate-700",
    fill: "bg-slate-50 text-slate-800",
  },
  emerald: {
    card: "border-emerald-200 bg-white",
    label: "text-emerald-700",
    chip: "bg-emerald-100 text-emerald-800",
    fill: "bg-emerald-50 text-emerald-950",
  },
  amber: {
    card: "border-amber-200 bg-white",
    label: "text-amber-700",
    chip: "bg-amber-100 text-amber-800",
    fill: "bg-amber-50 text-amber-950",
  },
  rose: {
    card: "border-rose-200 bg-white",
    label: "text-rose-700",
    chip: "bg-rose-100 text-rose-800",
    fill: "bg-rose-50 text-rose-950",
  },
  blue: {
    card: "border-blue-200 bg-white",
    label: "text-blue-700",
    chip: "bg-blue-100 text-blue-800",
    fill: "bg-blue-50 text-blue-950",
  },
  indigo: {
    card: "border-indigo-200 bg-white",
    label: "text-indigo-700",
    chip: "bg-indigo-100 text-indigo-800",
    fill: "bg-indigo-50 text-indigo-950",
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
        <summary className="cursor-pointer text-xs font-semibold uppercase text-slate-500 hover:text-slate-800">
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
    <article className={`rounded-lg border p-4 shadow-sm ${styles.card}`}>
      <p className={`text-xs font-semibold uppercase ${styles.label}`}>{label}</p>
      {title ? <h3 className="mt-1 text-base font-semibold text-slate-950">{title}</h3> : null}
      <div className="mt-2 text-slate-800">{children}</div>
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
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${styles.chip}`}>
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
    <details className={`rounded-lg border p-4 ${styles.card}`}>
      <summary className={`cursor-pointer text-sm font-semibold ${styles.label}`}>
        {title}
      </summary>
      <div className="mt-3 text-sm leading-6 text-slate-700">{children}</div>
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
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
        <p className="text-xs font-semibold text-slate-700">
          {current} / {safeTotal}
        </p>
      </div>
      <div className="mt-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-emerald-600 transition-all"
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
    <section className="rounded-lg bg-emerald-950 p-5 text-white shadow-sm">
      <p className="text-xs font-semibold uppercase text-emerald-200">Score</p>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-6xl font-semibold tracking-tight">{safeScore}</span>
        <span className="pb-2 text-lg font-semibold text-emerald-100">/ 10</span>
      </div>
      <div className="mt-5 overflow-hidden rounded-full bg-white/20">
        <div
          className="h-2 rounded-full bg-emerald-300"
          style={{ width: `${safeScore * 10}%` }}
        />
      </div>
      <p className="mt-3 text-sm font-semibold text-emerald-100">{label}</p>
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
          <div key={metric.label} className={`rounded-lg px-3 py-2 ${styles.fill}`}>
            <p className="text-[11px] font-semibold uppercase">{metric.label}</p>
            <p className="mt-1 text-sm font-semibold capitalize">{metric.value}</p>
          </div>
        );
      })}
    </div>
  );
}
