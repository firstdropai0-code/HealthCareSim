import {
  CollapsibleSection,
  InfoCard,
  MetricChip,
  ReadMoreText,
} from "@/components/common/VisualCards";
import type { Scenario } from "@/types/scenario";

const compactBriefCards = [
  { key: "patientProfile", label: "Patient", tone: "slate" as const },
  { key: "patientEmotion", label: "Emotion", tone: "amber" as const },
  { key: "familyEmotion", label: "Family/Bystander", tone: "blue" as const },
  { key: "traineeObjective", label: "Trainee Goal", tone: "emerald" as const },
  { key: "communicationChallenge", label: "Challenge", tone: "rose" as const },
  { key: "startingSituation", label: "Starting Situation", tone: "indigo" as const },
] satisfies Array<{
  key: keyof Scenario;
  label: string;
  tone: "slate" | "emerald" | "amber" | "rose" | "blue" | "indigo";
}>;

export function ScenarioPreview({ scenario }: { scenario: Scenario }) {
  return (
    <section className="space-y-4">
      <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
        <div className="bg-[var(--color-primary-ink)] px-5 py-5 text-white md:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-100">Scenario brief</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{scenario.title}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <MetricChip label="Setting" value={scenario.setting} tone="emerald" />
            <MetricChip label="Turns" value={`${scenario.suggestedTurns}`} tone="blue" />
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-teal-50">
            {scenario.summary}
          </p>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 lg:p-5">
          {compactBriefCards.map((card) => {
            const value = scenario[card.key];

            return (
              <InfoCard key={card.key} label={card.label} tone={card.tone}>
                <ReadMoreText text={String(value || "Not specified")} maxLength={105} />
              </InfoCard>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <InfoCard label="Starting line" title="Open with this situation" tone="emerald">
          <ReadMoreText text={scenario.firstPrompt} maxLength={140} />
        </InfoCard>

        <InfoCard label="Evaluation" title="Checklist" tone="blue">
          <div className="flex flex-wrap gap-2">
            {scenario.evaluationCriteria.map((item) => (
              <MetricChip key={item} label={item} tone="blue" />
            ))}
          </div>
        </InfoCard>
      </div>

      <CollapsibleSection title="View full scenario details" tone="slate">
        <dl className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-[var(--color-surface-muted)] p-3">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">Setting</dt>
            <dd className="mt-1 text-sm text-[var(--color-ink)]">{scenario.setting}</dd>
          </div>
          <div className="rounded-2xl bg-[var(--color-surface-muted)] p-3">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">Ending condition</dt>
            <dd className="mt-1 text-sm text-[var(--color-ink)]">{scenario.endingCondition}</dd>
          </div>
          <div className="rounded-2xl bg-[var(--color-surface-muted)] p-3 md:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">Full starting situation</dt>
            <dd className="mt-1 text-sm text-[var(--color-ink)]">{scenario.startingSituation}</dd>
          </div>
        </dl>
      </CollapsibleSection>
    </section>
  );
}
