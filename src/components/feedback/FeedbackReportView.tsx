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

  return (
    <div className="space-y-5">
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
        <div className="grid gap-3 md:grid-cols-2">
          {report.betterResponses.map((item) => (
            <blockquote key={item} className="rounded-2xl bg-[var(--color-info-soft)] px-3 py-3 text-blue-950">
              <ReadMoreText text={item} maxLength={140} />
            </blockquote>
          ))}
        </div>
      </InfoCard>

      <InfoCard label="Final advice" title="Carry forward" tone="slate">
        <ReadMoreText text={report.finalAdvice} maxLength={170} />
      </InfoCard>
    </div>
  );
}
