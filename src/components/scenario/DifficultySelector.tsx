"use client";

import {
  categoryOptions,
  difficultyMeta,
  difficultyOrder,
  type ScenarioDifficulty,
} from "@/lib/scenarios/scenarioLibrary";

/**
 * The track a case belongs to, which is the row it occupies on every trainee's
 * skill tree. Chosen explicitly rather than inferred: cases written from a
 * free-typed idea previously carried no track at all and disappeared from
 * progress entirely.
 */
export function CategorySelector({
  value,
  onChange,
  locked,
  disabled,
}: {
  value: string;
  onChange: (category: string) => void;
  /** True when the track came from a library case rather than a manual choice. */
  locked?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor="scenario-category" className="eyebrow text-[var(--color-ink)]">
        Track
      </label>
      <p className="mt-2 text-xs leading-5 text-[var(--color-ink-soft)]">
        {locked
          ? "Taken from the case you picked. Change it if you are adapting the case."
          : "The row this case sits in on your trainees' skill tree."}
      </p>
      <select
        id="scenario-category"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full max-w-sm border border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] px-3 py-2.5 text-[0.9375rem] text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)] focus:bg-white"
      >
        {categoryOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Every run needs a tier: it is the bucket progress and cohort comparison are
 * measured in. Library cases carry one already; a free-typed idea would have
 * none, so the trainer picks it here.
 */
export function DifficultySelector({
  value,
  onChange,
  locked,
  disabled,
}: {
  value: ScenarioDifficulty;
  onChange: (difficulty: ScenarioDifficulty) => void;
  /** True when the tier came from a library case rather than a manual choice. */
  locked?: boolean;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="eyebrow text-[var(--color-ink)]">Difficulty</legend>
      <p className="mt-2 text-xs leading-5 text-[var(--color-ink-soft)]">
        {locked
          ? "Taken from the case you picked. Change it if you are adapting the case."
          : "Shapes how demanding the generated roleplay is, and sets the level this counts towards on the trainee's progress."}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {difficultyOrder.map((difficulty) => {
          const meta = difficultyMeta[difficulty];
          const isActive = value === difficulty;

          return (
            <button
              key={difficulty}
              type="button"
              onClick={() => onChange(difficulty)}
              aria-pressed={isActive}
              title={meta.blurb}
              className={`eyebrow eyebrow-tight inline-flex min-h-7 items-center gap-1.5 rounded-full border px-3 py-1 transition-all duration-200 ${
                isActive
                  ? meta.chip
                  : "border-[var(--color-border-strong)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
              }`}
            >
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${isActive ? meta.dot : "bg-[var(--color-border-strong)]"}`} />
              {meta.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
