"use client";

import { useState } from "react";
import {
  InfoCard,
  MetricChip,
  ReadMoreText,
} from "@/components/common/VisualCards";
import type { Scenario } from "@/types/scenario";

type Tone = "slate" | "emerald" | "amber" | "rose" | "blue" | "indigo";

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
  tone: Tone;
}>;

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
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Edit ${label}`}
      className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:text-[var(--color-primary-ink)]"
    >
      <PencilIcon />
    </button>
  );
}

function EditActions({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onSave}
        className="rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs font-semibold text-white transition hover:bg-[var(--color-primary-strong)]"
      >
        Save
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-full border border-[var(--color-border-strong)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)] transition hover:border-slate-500"
      >
        Cancel
      </button>
    </div>
  );
}

function EditableTextCard({
  label,
  title,
  tone,
  value,
  maxLength,
  onSave,
}: {
  label: string;
  title?: string;
  tone: Tone;
  value: string;
  maxLength?: number;
  onSave: (next: string) => void;
}) {
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
    <InfoCard label={label} title={title} tone={tone}>
      <div className="relative pr-6">
        {!isEditing ? <EditButton onClick={startEditing} label={label} /> : null}

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={4}
              autoFocus
              className="w-full resize-y rounded-xl border border-[var(--color-border-strong)] bg-white p-2 text-sm leading-6 text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-teal-100"
            />
            <EditActions onSave={handleSave} onCancel={handleCancel} />
          </div>
        ) : (
          <ReadMoreText text={value || "Not specified"} maxLength={maxLength ?? 150} />
        )}
      </div>
    </InfoCard>
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
    <InfoCard label="Evaluation" title="Checklist" tone="blue">
      <div className="relative pr-6">
        {!isEditing ? <EditButton onClick={startEditing} label="Evaluation checklist" /> : null}

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
                    placeholder="Describe one evaluation point"
                    className="w-full rounded-xl border border-[var(--color-border-strong)] bg-white px-3 py-2 text-sm leading-6 text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-teal-100"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    aria-label="Remove this evaluation point"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-strong)] text-[var(--color-ink-soft)] transition hover:border-rose-300 hover:text-rose-600"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1.5 rounded-full border border-dashed border-[var(--color-border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink-soft)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary-ink)]"
            >
              <PlusIcon />
              Add point
            </button>
            <EditActions onSave={handleSave} onCancel={handleCancel} />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {criteria.map((item) => (
              <MetricChip key={item} label={item} tone="blue" />
            ))}
          </div>
        )}
      </div>
    </InfoCard>
  );
}

export function ScenarioPreview({
  scenario,
  onScenarioChange,
}: {
  scenario: Scenario;
  onScenarioChange?: (updates: Partial<Scenario>) => void;
}) {
  function updateField<K extends keyof Scenario>(key: K, value: Scenario[K]) {
    onScenarioChange?.({ [key]: value } as Partial<Scenario>);
  }

  return (
    <section className="animate-fade-up space-y-4">
      <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[var(--color-primary-ink)] via-[var(--color-primary-strong)] to-[var(--color-primary-ink)] px-5 py-5 text-white md:px-6">
          <div
            aria-hidden
            className="animate-pulse-glow pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-300/25 blur-3xl"
          />
          <p className="relative text-xs font-semibold uppercase tracking-[0.14em] text-teal-100">Scenario brief</p>
          <h2 className="relative mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{scenario.title}</h2>
          <div className="relative mt-4 flex flex-wrap gap-2">
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
              <EditableTextCard
                key={card.key}
                label={card.label}
                tone={card.tone}
                value={String(value || "")}
                maxLength={105}
                onSave={(next) => updateField(card.key, next as Scenario[typeof card.key])}
              />
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px_320px]">
        <EditableTextCard
          label="Starting line"
          title="Open with this situation"
          tone="emerald"
          value={scenario.firstPrompt}
          maxLength={140}
          onSave={(next) => updateField("firstPrompt", next)}
        />

        <EditableEvaluationCard
          criteria={scenario.evaluationCriteria}
          onSave={(next) => updateField("evaluationCriteria", next)}
        />

        <EditableTextCard
          label="Ending condition"
          title="Close when"
          tone="slate"
          value={scenario.endingCondition}
          maxLength={140}
          onSave={(next) => updateField("endingCondition", next)}
        />
      </div>
    </section>
  );
}
