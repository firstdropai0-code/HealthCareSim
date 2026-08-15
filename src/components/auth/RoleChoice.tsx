"use client";

import type { Role } from "@/types/user";

const options: { role: Role; label: string; blurb: string }[] = [
  {
    role: "trainee",
    label: "Trainee",
    blurb: "Run scenarios, get feedback, and track your progress.",
  },
  {
    role: "mentor",
    label: "Mentor",
    blurb: "Write scenarios, invite trainees, and review their performance.",
  },
];

/**
 * Two cards rather than a select — the choice is permanent (rules reject any
 * later change to `role`), so it deserves the weight and the explanation.
 */
export function RoleChoice({
  value,
  onChange,
  disabled,
}: {
  value: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="eyebrow text-[var(--color-ink)]">I am a</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const isActive = value === option.role;

          return (
            <button
              key={option.role}
              type="button"
              onClick={() => onChange(option.role)}
              aria-pressed={isActive}
              className={`rounded-[var(--radius-lg)] border p-3 text-left transition duration-200 ${
                isActive
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] shadow-[var(--shadow-accent)]"
                  : "border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] hover:border-[var(--color-ink)]"
              }`}
            >
              <span
                className={`text-sm font-semibold ${
                  isActive ? "text-[var(--color-primary)]" : "text-[var(--color-ink)]"
                }`}
              >
                {option.label}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--color-ink-soft)]">
                {option.blurb}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
        This cannot be changed later.
      </p>
    </fieldset>
  );
}
