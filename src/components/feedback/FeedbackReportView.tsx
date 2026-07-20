import {
  InfoCard,
  ReadMoreText,
  ScoreCard,
} from "@/components/common/VisualCards";
import type { FeedbackReport } from "@/types/feedback";

type FeedbackTone = "emerald" | "amber" | "rose" | "blue";

function scoreLabel(score: number): string {
  if (score >= 8) {
    return "Strong";
  }

  if (score >= 6) {
    return "Developing";
  }

  return "Needs focus";
}

function FeedbackItemGrid({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: FeedbackTone;
}) {
  return (
    <InfoCard label={label} title={`${items.length} notes`} tone={tone}>
      <div className="grid gap-2">
        {items.map((item) => (
          <div key={item} className="rounded-2xl bg-[var(--color-surface-muted)] px-3 py-2 text-[var(--color-ink)]">
            <ReadMoreText text={item} maxLength={115} />
          </div>
        ))}
      </div>
    </InfoCard>
  );
}

export function FeedbackReportView({ report }: { report: FeedbackReport }) {
  const score = Math.max(1, Math.min(10, report.overallScore));
  const topStrength = report.whatWentWell[0] || "Stayed engaged in the scenario.";
  const topFocus =
    report.whatCouldImprove[0] ||
    report.communicationGaps[0] ||
    "Use clearer structure in the next response.";
  const customCriteriaFeedback = report.customCriteriaFeedback || [];
  const deliveryFeedback = report.deliveryFeedback || [];

  return (
    <div className="animate-fade-up space-y-5">
      {report.source === "fallback" ? (
        <div className="rounded-2xl border border-amber-200 bg-[var(--color-warning-soft)] px-4 py-3 text-sm font-semibold text-amber-950">
          {report.fallbackReason || "Basic fallback feedback generated because Gemini feedback was unavailable."}
        </div>
      ) : null}
      <section className="grid gap-5 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] lg:grid-cols-[240px_1fr] lg:p-5">
        <ScoreCard score={score} label={scoreLabel(score)} />

        <div className="space-y-4">
          <InfoCard label="Summary" title="Quick read" tone="slate">
            <ReadMoreText text={report.summary} maxLength={170} />
          </InfoCard>
          <div className="grid gap-3 md:grid-cols-2">
            <InfoCard label="Strength" title="What worked" tone="emerald">
              <ReadMoreText text={topStrength} maxLength={120} />
            </InfoCard>
            <InfoCard label="Improve" title="Next focus" tone="amber">
              <ReadMoreText text={topFocus} maxLength={120} />
            </InfoCard>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <FeedbackItemGrid label="What went well" items={report.whatWentWell} tone="emerald" />
        <FeedbackItemGrid label="Improve next time" items={report.whatCouldImprove} tone="amber" />
        <FeedbackItemGrid label="Watch gaps" items={report.communicationGaps} tone="rose" />
      </div>

      <InfoCard label="Example" title="Better response examples" tone="blue">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-info-soft)] text-xs font-semibold text-blue-700">
            FD
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
            FirstDrop Coach
          </span>
        </div>
        <div className="mt-3 flex flex-col space-y-3">
          <div className="animate-fade-up flex justify-start">
            <div className="max-w-[92%] rounded-[1.25rem] rounded-bl-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-ink)] shadow-[var(--shadow-card)] sm:max-w-xl">
              <p className="text-sm leading-6">Here are a few lines you could&apos;ve used 👇</p>
            </div>
          </div>
          {report.betterResponses.map((item, index) => (
            <div key={`better-${index}`} className="animate-fade-up flex justify-start">
              <div className="max-w-[92%] rounded-[1.25rem] rounded-bl-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-ink)] shadow-[var(--shadow-card)] sm:max-w-xl">
                <ReadMoreText text={item} maxLength={140} />
              </div>
            </div>
          ))}
        </div>
      </InfoCard>

      {deliveryFeedback.length > 0 ? (
        <InfoCard label="Delivery" title="How you sounded" tone="blue">
          <p className="text-xs leading-5 text-[var(--color-ink-soft)]">
            Measured from your spoken turns. These are cues about delivery, not a score — the
            overall score above reflects what you said.
          </p>
          <div className="mt-3 grid gap-2">
            {deliveryFeedback.map((item, index) => (
              <div
                key={`delivery-${index}`}
                className="rounded-2xl bg-[var(--color-surface-muted)] px-3 py-2 text-[var(--color-ink)]"
              >
                <ReadMoreText text={item} maxLength={140} />
              </div>
            ))}
          </div>
        </InfoCard>
      ) : null}

      {customCriteriaFeedback.length > 0 ? (
        <InfoCard label="Custom criteria" title="Your added evaluation criteria" tone="indigo">
          <div className="grid gap-3 md:grid-cols-2">
            {customCriteriaFeedback.map((item) => (
              <div
                key={item.criterion}
                className="rounded-2xl border border-indigo-100 bg-indigo-50 px-3 py-3 text-indigo-950 transition-transform duration-300 hover:-translate-y-0.5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-indigo-700">
                  {item.criterion}
                </p>
                <div className="mt-1 text-sm leading-6">
                  <ReadMoreText text={item.assessment} maxLength={140} />
                </div>
              </div>
            ))}
          </div>
        </InfoCard>
      ) : null}

      <InfoCard label="Final advice" title="Carry forward" tone="slate">
        <ReadMoreText text={report.finalAdvice} maxLength={170} />
      </InfoCard>
    </div>
  );
}
