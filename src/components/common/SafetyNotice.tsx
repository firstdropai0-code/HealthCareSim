import { safetyDisclaimer } from "@/lib/safety/disclaimer";

export function SafetyNotice({ compact = true }: { compact?: boolean }) {
  if (compact) {
    return (
      <details className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <summary className="cursor-pointer font-semibold">
          Training simulation only. Not for diagnosis or treatment.
        </summary>
        <p className="mt-2 text-xs leading-5">{safetyDisclaimer}</p>
      </details>
    );
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
      <strong>Safety disclaimer:</strong> {safetyDisclaimer}
    </div>
  );
}
