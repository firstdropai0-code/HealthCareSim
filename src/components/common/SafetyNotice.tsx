import { safetyDisclaimer } from "@/lib/safety/disclaimer";

export function SafetyNotice() {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
      <strong>Safety disclaimer:</strong> {safetyDisclaimer}
    </div>
  );
}
