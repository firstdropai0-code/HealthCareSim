"use client";

import { useT, type StringKey } from "@/lib/i18n/strings";
import type { Role } from "@/types/user";

const options: { role: Role; label: StringKey; blurb: StringKey }[] = [
  { role: "trainee", label: "roleChoice.trainee", blurb: "roleChoice.traineeBlurb" },
  { role: "mentor", label: "roleChoice.mentor", blurb: "roleChoice.mentorBlurb" },
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
  const t = useT();

  return (
    <fieldset disabled={disabled}>
      <legend className="eyebrow text-[var(--color-ink)]">{t("roleChoice.legend")}</legend>
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
                {t(option.label)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--color-ink-soft)]">
                {t(option.blurb)}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
        {t("roleChoice.permanent")}
      </p>
    </fieldset>
  );
}
