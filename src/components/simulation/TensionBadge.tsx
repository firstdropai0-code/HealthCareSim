import type { TensionLevel } from "@/types/simulation";

const styles: Record<TensionLevel, string> = {
  low: "bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]",
  medium: "bg-[var(--color-warning-soft)] text-amber-900",
  high: "bg-[var(--color-danger-soft)] text-rose-900",
};

export function TensionBadge({ level }: { level: TensionLevel }) {
  return (
    <span className={`inline-flex min-h-7 items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${styles[level]}`}>
      {level} tension
    </span>
  );
}
