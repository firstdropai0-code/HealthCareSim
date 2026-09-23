"use client";

import { useT } from "@/lib/i18n/strings";
import type { TensionLevel } from "@/types/simulation";

const styles: Record<TensionLevel, string> = {
  low: "border-[var(--color-primary)] text-[var(--color-primary)]",
  medium: "border-[var(--color-warning)] text-[var(--color-warning)]",
  high: "border-[var(--color-danger)] text-[var(--color-danger)]",
};

export function TensionBadge({ level }: { level: TensionLevel }) {
  const t = useT();

  return (
    <span
      className={`eyebrow eyebrow-tight inline-flex min-h-7 items-center border px-2.5 py-1 ${styles[level]}`}
    >
      {t("simulation.tension", { level: t(`tension.${level}`) })}
    </span>
  );
}
