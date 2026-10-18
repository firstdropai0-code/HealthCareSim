"use client";

import { useState, type ReactNode } from "react";
import { MetricChip } from "@/components/common/VisualCards";
import { useT, type StringKey } from "@/lib/i18n/strings";
import { getPatientStatus } from "@/lib/scenarios/patientStatus";
import type { PatientStatus, Scenario } from "@/types/scenario";

type Tone = "slate" | "emerald" | "amber" | "rose" | "blue" | "indigo";

/**
 * The brief is the one screen a mentor reads closely before publishing, and a
 * trainee scans before a roleplay. It gets its own card rather than InfoCard so
 * the values can be set at reading size (15px ink) instead of the 13px muted
 * caption size InfoCard uses for supporting text elsewhere.
 */
const toneAccent: Record<Tone, { label: string; rule: string }> = {
  slate: { label: "text-[var(--color-ink-soft)]", rule: "border-l-[var(--color-border-strong)]" },
  emerald: { label: "text-[var(--color-primary)]", rule: "border-l-[var(--color-primary)]" },
  amber: { label: "text-[var(--color-warning)]", rule: "border-l-[var(--color-warning)]" },
  rose: { label: "text-[var(--color-danger)]", rule: "border-l-[var(--color-danger)]" },
  blue: { label: "text-[var(--color-info)]", rule: "border-l-[var(--color-info)]" },
  indigo: { label: "text-[var(--color-ink-muted)]", rule: "border-l-[var(--color-ink-muted)]" },
};

function BriefCard({
  label,
  title,
  tone,
  children,
  emphasis,
}: {
  label: string;
  title?: string;
  tone: Tone;
  children: ReactNode;
  /** Gives the card more presence for the fields that carry the most weight. */
  emphasis?: boolean;
}) {
  const accent = toneAccent[tone];

  return (
    <article
      className={`card-hover flex h-full flex-col rounded-[var(--radius-lg)] border border-l-[3px] border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] ${accent.rule} ${
        emphasis ? "p-5" : "p-4"
      }`}
    >
      <p className={`eyebrow text-[0.8125rem] tracking-[0.14em] ${accent.label}`}>{label}</p>
      {title ? <h3 className="display-sm mt-1.5">{title}</h3> : null}
      <div className="mt-2.5 flex-1">{children}</div>
    </article>
  );
}

const compactBriefCards = [
  { key: "patientProfile", label: "brief.patient", tone: "slate" as const },
  { key: "patientEmotion", label: "brief.emotion", tone: "amber" as const },
  { key: "familyEmotion", label: "brief.family", tone: "blue" as const },
  { key: "traineeObjective", label: "brief.goal", tone: "emerald" as const },
  { key: "communicationChallenge", label: "brief.challenge", tone: "rose" as const },
  { key: "startingSituation", label: "brief.startingSituation", tone: "indigo" as const },
] satisfies Array<{
  key: keyof Scenario;
  label: StringKey;
  tone: Tone;
}>;

const patientStatusOptions: Array<{ value: PatientStatus; label: StringKey; selected: string }> = [
  {
    value: "alive",
    label: "brief.alive",
    selected: "bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]",
  },
  {
    value: "deceased",
    label: "brief.deceased",
    selected: "bg-[var(--color-ink)] text-[var(--color-surface)]",
  },
];

/**
 * Alive or deceased, in the header row where it is read before anything else.
 * A toggle rather than a chip because the model decides it and can be wrong,
 * and the mentor is the one who knows. Selection is shown with aria-pressed
 * and a fill, not `disabled` — `.btn-editorial:disabled` repaints grey and a
 * disabled button cannot be focused to read which option is chosen.
 */
function PatientStatusToggle({
  status,
  onChange,
}: {
  status: PatientStatus;
  onChange?: (next: PatientStatus) => void;
}) {
  const t = useT();

  if (!onChange) {
    return (
      <MetricChip
        label={t("brief.patientStatus")}
        value={t(status === "deceased" ? "brief.deceased" : "brief.alive")}
        tone={status === "deceased" ? "slate" : "emerald"}
      />
    );
  }

  return (
    <div
      role="group"
      aria-label={t("brief.statusGroup")}
      className="eyebrow eyebrow-tight inline-flex min-h-6 items-center gap-1 rounded-full border border-[var(--color-border-strong)] py-0.5 pr-0.5 pl-2.5 text-[var(--color-ink-muted)]"
    >
      <span>{t("brief.patientStatus")}</span>
      {patientStatusOptions.map((option) => {
        const isSelected = status === option.value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(option.value)}
            className={`rounded-full px-2 py-0.5 text-[0.8125rem] font-semibold normal-case tracking-normal transition ${
              isSelected
                ? option.selected
                : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            }`}
          >
            {t(option.label)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Takes the emotion card's place for a death. It states the status in words
 * rather than leaving an empty "Patient emotion" — the brief's job is to make
 * alive and deceased impossible to confuse, and an empty card reads as an
 * omission. Not editable: there is nothing to edit; the toggle changes it.
 */
function DeceasedPatientCard() {
  const t = useT();

  return (
    <BriefCard label={t("brief.statusGroup")} tone="slate">
      <p className="text-[0.9375rem] font-semibold leading-7 text-[var(--color-ink)]">
        {t("brief.deceasedTitle")}
      </p>
      <p className="mt-1 text-sm leading-6 text-[var(--color-ink-soft)]">
        {t("brief.deceasedDetail")}
      </p>
    </BriefCard>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function EditButton({ onClick, label }: { onClick: () => void; label: string }) {
  const t = useT();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("brief.edit", { label })}
      className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
    >
      <PencilIcon />
    </button>
  );
}

function EditActions({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const t = useT();

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onSave}
        className="btn-editorial btn-editorial--accent min-h-8 px-3 py-1"
      >
        {t("common.save")}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="btn-editorial btn-editorial--quiet min-h-8 px-3 py-1"
      >
        {t("common.cancel")}
      </button>
    </div>
  );
}

function EditableTextCard({
  label,
  title,
  tone,
  value,
  onSave,
  emphasis,
  quoted,
}: {
  label: string;
  title?: string;
  tone: Tone;
  value: string;
  onSave: (next: string) => void;
  emphasis?: boolean;
  /** Renders as spoken words — used for the opening line. */
  quoted?: boolean;
}) {
  const t = useT();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function startEditing() {
    setDraft(value);
    setIsEditing(true);
  }

  function handleSave() {
    onSave(draft.trim());
    setIsEditing(false);
  }

  function handleCancel() {
    setDraft(value);
    setIsEditing(false);
  }

  return (
    <BriefCard label={label} title={title} tone={tone} emphasis={emphasis}>
      <div className="relative pr-7">
        {!isEditing ? <EditButton onClick={startEditing} label={label} /> : null}

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={4}
              autoFocus
              className="w-full resize-y border border-[var(--color-border-strong)] bg-white p-2 text-[0.9375rem] leading-7 text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]"
            />
            <EditActions onSave={handleSave} onCancel={handleCancel} />
          </div>
        ) : (
          <p
            className={`text-[var(--color-ink)] ${
              quoted
                ? "text-base leading-8"
                : emphasis
                  ? "text-[0.9375rem] leading-7"
                  : "text-[0.9375rem] leading-7"
            } ${value ? "" : "italic text-[var(--color-ink-soft)]"}`}
          >
            {value || t("common.notSpecified")}
          </p>
        )}
      </div>
    </BriefCard>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function EditableEvaluationCard({
  criteria,
  onSave,
}: {
  criteria: string[];
  onSave: (next: string[]) => void;
}) {
  const t = useT();
  const [isEditing, setIsEditing] = useState(false);
  const [draftItems, setDraftItems] = useState<string[]>(criteria);

  function startEditing() {
    setDraftItems(criteria.length > 0 ? criteria : [""]);
    setIsEditing(true);
  }

  function handleSave() {
    const next = draftItems.map((item) => item.trim()).filter(Boolean);
    onSave(next);
    setIsEditing(false);
  }

  function handleCancel() {
    setDraftItems(criteria);
    setIsEditing(false);
  }

  function updateItem(index: number, value: string) {
    setDraftItems((current) => current.map((item, i) => (i === index ? value : item)));
  }

  function removeItem(index: number) {
    setDraftItems((current) => current.filter((_, i) => i !== index));
  }

  function addItem() {
    setDraftItems((current) => [...current, ""]);
  }

  return (
    <BriefCard label={t("brief.evaluation")} title={t("brief.checklist")} tone="blue">
      <div className="relative pr-7">
        {!isEditing ? <EditButton onClick={startEditing} label={t("brief.editChecklist")} /> : null}

        {isEditing ? (
          <div className="space-y-2">
            <div className="space-y-2">
              {draftItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(event) => updateItem(index, event.target.value)}
                    autoFocus={index === draftItems.length - 1}
                    placeholder={t("brief.pointPlaceholder")}
                    className="w-full border border-[var(--color-border-strong)] bg-white px-3 py-2 text-sm leading-6 text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    aria-label={t("brief.removePoint")}
                    className="flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--color-border-strong)] text-[var(--color-ink-soft)] transition hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="eyebrow eyebrow-tight flex items-center gap-1.5 border border-dashed border-[var(--color-border-strong)] px-3 py-1.5 text-[var(--color-ink-soft)] transition hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
            >
              <PlusIcon />
              {t("brief.addPoint")}
            </button>
            <EditActions onSave={handleSave} onCancel={handleCancel} />
          </div>
        ) : (
          // A numbered list, not chips. MetricChip is eyebrow-styled, so each
          // criterion rendered as ALL CAPS wrapping over two lines — the least
          // readable thing on the page, for the content a mentor most needs to
          // check before publishing.
          <ol className="grid">
            {criteria.map((item, index) => (
              <li
                key={item}
                className="flex items-baseline gap-3 border-b border-[var(--color-border)] py-2 last:border-b-0"
              >
                <span className="section-num shrink-0">{String(index + 1).padStart(2, "0")}</span>
                <span className="text-[0.9375rem] leading-7 text-[var(--color-ink)]">{item}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </BriefCard>
  );
}

export function ScenarioPreview({
  scenario,
  onScenarioChange,
}: {
  scenario: Scenario;
  onScenarioChange?: (updates: Partial<Scenario>) => void;
}) {
  const t = useT();
  const patientStatus = getPatientStatus(scenario);

  function updateField<K extends keyof Scenario>(key: K, value: Scenario[K]) {
    onScenarioChange?.({ [key]: value } as Partial<Scenario>);
  }

  return (
    <section className="space-y-4">
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-canvas-soft)] px-5 py-6 md:px-7">
          <p className="eyebrow text-[var(--color-primary)]">{t("brief.eyebrow")}</p>
          <h2 className="display-xl mt-2 max-w-3xl">{scenario.title}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <MetricChip label={t("brief.setting")} value={scenario.setting} tone="emerald" />
            <PatientStatusToggle
              status={patientStatus}
              onChange={
                onScenarioChange ? (next) => updateField("patientStatus", next) : undefined
              }
            />
            {/* Pacing, not a limit. The roleplay ends on the scenario's ending
                condition, and the hard cap shown in the simulation is higher. */}
            <MetricChip
              label={t("brief.pacing")}
              value={t("brief.pacingValue", { n: scenario.suggestedTurns })}
              tone="blue"
            />
          </div>
          <p className="lede mt-4 max-w-3xl">{scenario.summary}</p>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 lg:p-5">
          {compactBriefCards.map((card) => {
            // Swapped in place, so the grid keeps its shape and the family card
            // stays beside it — for a death, theirs is the emotion that matters.
            if (card.key === "patientEmotion" && patientStatus === "deceased") {
              return <DeceasedPatientCard key="patientStatus" />;
            }

            const value = scenario[card.key];

            return (
              <EditableTextCard
                key={card.key}
                label={t(card.label)}
                tone={card.tone}
                value={String(value || "")}
                onSave={(next) => updateField(card.key, next as Scenario[typeof card.key])}
              />
            );
          })}
        </div>
      </div>

      {/* The opening line is what the trainee actually meets first, so it gets
          its own full-width row at reading size rather than competing for a
          third of a cramped one. */}
      <EditableTextCard
        label={t("brief.startingLine")}
        title={t("brief.openWith")}
        tone="emerald"
        value={scenario.firstPrompt}
        onSave={(next) => updateField("firstPrompt", next)}
        emphasis
        quoted
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <EditableEvaluationCard
          criteria={scenario.evaluationCriteria}
          onSave={(next) => updateField("evaluationCriteria", next)}
        />

        <EditableTextCard
          label={t("brief.ending")}
          title={t("brief.closeWhen")}
          tone="slate"
          value={scenario.endingCondition}
          onSave={(next) => updateField("endingCondition", next)}
          emphasis
        />
      </div>
    </section>
  );
}
