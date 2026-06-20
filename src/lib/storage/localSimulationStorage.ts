import type { FeedbackReport } from "@/types/feedback";
import type { SimulationState } from "@/types/simulation";

const STORAGE_KEY = "firstdrop.currentSimulation";
const FEEDBACK_KEY = "firstdrop.currentFeedbackReport";
const PENDING_FEEDBACK_KEY = "firstdrop.pendingFeedbackGeneration";

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
    return JSON.parse(rawReport) as FeedbackReport;
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
