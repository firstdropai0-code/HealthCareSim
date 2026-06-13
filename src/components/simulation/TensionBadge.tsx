import type { TensionLevel } from "@/types/simulation";

const styles: Record<TensionLevel, string> = {
  low: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-rose-100 text-rose-800",
};

export function TensionBadge({ level }: { level: TensionLevel }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${styles[level]}`}>
      {level} tension
    </span>
  );
}
