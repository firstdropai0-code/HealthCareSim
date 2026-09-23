"use client";

import { useT } from "@/lib/i18n/strings";

export function SafetyNotice({ compact = true }: { compact?: boolean }) {
  const t = useT();
  const safetyDisclaimer = t("safety.disclaimer");

  if (compact) {
    return (
      <details className="rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-warning)] bg-[var(--color-warning-soft)] px-4 py-3 text-[var(--color-ink)]">
        <summary className="eyebrow eyebrow-tight cursor-pointer text-[var(--color-warning)]">
          {t("safety.summary")}
        </summary>
        <p className="mt-2 text-xs leading-5 text-[var(--color-ink-muted)]">{safetyDisclaimer}</p>
      </details>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-warning)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm leading-6 text-[var(--color-ink-muted)]">
      <strong className="eyebrow eyebrow-tight text-[var(--color-warning)]">
        {t("safety.label")}
      </strong>{" "}
      {safetyDisclaimer}
    </div>
  );
}
