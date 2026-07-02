import { safetyDisclaimer } from "@/lib/safety/disclaimer";

export function SafetyNotice({ compact = true }: { compact?: boolean }) {
  if (compact) {
    return (
      <details className="rounded-2xl border border-amber-200 bg-[var(--color-warning-soft)] px-4 py-3 text-sm text-amber-950 shadow-sm">
        <summary className="cursor-pointer font-semibold">
          Training simulation only. Not for diagnosis or treatment.
        </summary>
        <p className="mt-2 text-xs leading-5">{safetyDisclaimer}</p>
      </details>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-300 bg-[var(--color-warning-soft)] px-4 py-3 text-sm leading-6 text-amber-950 shadow-sm">
      <strong>Safety disclaimer:</strong> {safetyDisclaimer}
    </div>
  );
}
