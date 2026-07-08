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

function EditableEvaluationCard({
  criteria,
  onSave,
}: {
  criteria: string[];
  onSave: (next: string[]) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(criteria.join("\n"));

  function startEditing() {
    setDraft(criteria.join("\n"));
    setIsEditing(true);
  }

  function handleSave() {
    const next = draft
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    onSave(next);
    setIsEditing(false);
  }

  function handleCancel() {
    setDraft(criteria.join("\n"));
    setIsEditing(false);
  }

  return (
    <InfoCard label="Evaluation" title="Checklist" tone="blue">
      <div className="relative pr-6">
        {!isEditing ? <EditButton onClick={startEditing} label="Evaluation checklist" /> : null}

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={5}
              autoFocus
              placeholder="One item per line"
              className="w-full resize-y rounded-xl border border-[var(--color-border-strong)] bg-white p-2 text-sm leading-6 text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-teal-100"
            />
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
