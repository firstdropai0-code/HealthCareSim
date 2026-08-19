import { normalizeBetterResponses } from "@/lib/feedback/betterResponses";
import type { FeedbackReport } from "@/types/feedback";
import type { SimulationState } from "@/types/simulation";

const STORAGE_KEY = "firstdrop.currentSimulation";
const FEEDBACK_KEY = "firstdrop.currentFeedbackReport";
const PENDING_FEEDBACK_KEY = "firstdrop.pendingFeedbackGeneration";
const AUTO_READ_KEY = "firstdrop.autoReadAloud";

export function saveSimulationState(state: SimulationState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadSimulationState(): SimulationState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawState = window.localStorage.getItem(STORAGE_KEY);

  if (!rawState) {
    return null;
  }

  try {
    return JSON.parse(rawState) as SimulationState;
  } catch {
    clearSimulationState();
    return null;
  }
}

export function clearSimulationState(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  clearFeedbackReport();
  clearPendingFeedbackGeneration();
}

export function saveFeedbackReport(report: FeedbackReport): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify(report));
}

export function loadFeedbackReport(): FeedbackReport | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawReport = window.localStorage.getItem(FEEDBACK_KEY);

  if (!rawReport) {
    return null;
  }

  try {
    const report = JSON.parse(rawReport) as FeedbackReport;

    // Reports cached before suggestions carried a turn stored plain strings.
    // Normalising on read means an old report still renders instead of
    // breaking on a missing `suggestion`.
    return {
      ...report,
      betterResponses: normalizeBetterResponses(report.betterResponses),
    };
  } catch {
    clearFeedbackReport();
    return null;
  }
}

export function clearFeedbackReport(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(FEEDBACK_KEY);
}

export function saveAutoRead(value: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTO_READ_KEY, value ? "true" : "false");
}

/**
 * Null when the trainee has never touched the toggle, which is what lets the
 * caller keep its own default rather than having one implied by storage.
 */
export function loadAutoRead(): boolean | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTO_READ_KEY);

  return raw === null ? null : raw === "true";
}

export function savePendingFeedbackGeneration(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PENDING_FEEDBACK_KEY, "true");
}

export function loadPendingFeedbackGeneration(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(PENDING_FEEDBACK_KEY) === "true";
}

export function clearPendingFeedbackGeneration(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PENDING_FEEDBACK_KEY);
}
