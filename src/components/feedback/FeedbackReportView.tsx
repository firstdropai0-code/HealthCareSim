import type { FeedbackReport } from "@/types/feedback";

type FeedbackCardTone = "green" | "amber" | "rose" | "blue";

const toneStyles: Record<
  FeedbackCardTone,
  { border: string; badge: string; title: string; panel: string }
> = {
  green: {
    border: "border-emerald-200",
    badge: "bg-emerald-100 text-emerald-800",
    title: "text-emerald-950",
    panel: "bg-emerald-50",
  },
  amber: {
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-800",
    title: "text-amber-950",
    panel: "bg-amber-50",
  },
  rose: {
    border: "border-rose-200",
    badge: "bg-rose-100 text-rose-800",
    title: "text-rose-950",
    panel: "bg-rose-50",
  },
  blue: {
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-800",
    title: "text-blue-950",
    panel: "bg-blue-50",
  },
};

function scoreLabel(score: number): string {
  if (score >= 8) {
    return "Strong";
  }

  if (score >= 6) {
    return "Developing";
  }

  return "Needs focus";
}

function FeedbackCard({
  title,
  label,
  items,
  tone,
}: {
  title: string;
  label: string;
  items: string[];
  tone: FeedbackCardTone;
}) {
  const styles = toneStyles[tone];
  const visibleItems = items.slice(0, 2);
  const hiddenItems = items.slice(2);

  return (
    <section className={`rounded-lg border ${styles.border} bg-white p-5 shadow-sm`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className={`text-base font-semibold ${styles.title}`}>{title}</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles.badge}`}>
          {label}
        </span>
      </div>
      <ul className="mt-4 space-y-3">
        {visibleItems.map((item) => (
          <li key={item} className={`rounded-md ${styles.panel} px-3 py-2 text-sm leading-6`}>
            {item}
          </li>
        ))}
      </ul>
      {hiddenItems.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase text-slate-500 hover:text-slate-800">
            Show {hiddenItems.length} more
          </summary>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
            {hiddenItems.map((item) => (
              <li key={item} className="rounded-md bg-slate-50 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

export function FeedbackReportView({ report }: { report: FeedbackReport }) {
  const score = Math.max(1, Math.min(10, report.overallScore));
  const scorePercent = score * 10;
  const topStrength = report.whatWentWell[0] || "The trainee stayed engaged in the scenario.";
  const topFocus =
    report.whatCouldImprove[0] ||
    report.communicationGaps[0] ||
    "Use clearer structure in the next response.";

  return (
    <div className="space-y-5">
      <section className="grid gap-5 rounded-lg border border-emerald-900/10 bg-white p-5 shadow-sm lg:grid-cols-[260px_1fr]">
        <div className="rounded-lg bg-emerald-950 p-5 text-white">
          <p className="text-xs font-semibold uppercase text-emerald-200">Overall score</p>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-6xl font-semibold tracking-tight">{score}</span>
            <span className="pb-2 text-lg font-semibold text-emerald-100">/ 10</span>
          </div>
          <div className="mt-5 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-2 rounded-full bg-emerald-300"
              style={{ width: `${scorePercent}%` }}
            />
          </div>
          <p className="mt-3 text-sm font-semibold text-emerald-100">{scoreLabel(score)}</p>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Quick read</p>
            <p className="mt-2 text-base leading-7 text-slate-800">{report.summary}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-800">Best moment</p>
              <p className="mt-2 text-sm leading-6 text-emerald-950">{topStrength}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase text-amber-800">Next focus</p>
              <p className="mt-2 text-sm leading-6 text-amber-950">{topFocus}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <FeedbackCard
          title="Strengths"
          label={`${report.whatWentWell.length} notes`}
          items={report.whatWentWell}
          tone="green"
        />
        <FeedbackCard
          title="Improve next"
          label={`${report.whatCouldImprove.length} notes`}
          items={report.whatCouldImprove}
          tone="amber"
        />
        <FeedbackCard
          title="Gaps to watch"
          label={`${report.communicationGaps.length} notes`}
          items={report.communicationGaps}
          tone="rose"
        />
      </div>

      <section className="rounded-lg border border-blue-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-blue-700">Practice responses</p>
            <h3 className="mt-1 text-lg font-semibold text-blue-950">
              Try these clearer alternatives
            </h3>
          </div>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
            Script bank
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {report.betterResponses.map((item) => (
            <blockquote
              key={item}
              className="rounded-lg bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950"
            >
              <span aria-hidden="true">&ldquo;</span>
              {item}
              <span aria-hidden="true">&rdquo;</span>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase text-slate-300">Final advice</p>
        <p className="mt-2 text-base leading-7 text-slate-50">{report.finalAdvice}</p>
      </section>
    </div>
  );
}
