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

/*
 * Whose run this is.
 *
 * The keys above are per browser, not per account, and a training lab's
 * computers are shared: without an owner the next person to sign in found the
 * last one's conversation and report waiting, and could finish that run and
 * save it as their own. The run is therefore tied to the account that was
 * signed in while it was made, and dropped when anyone else arrives.
 *
 * None of this applies without Firebase, where there are no accounts and the
 * browser's single run belongs to whoever is using it.
 */
const OWNER_KEY = "firstdrop.simulationOwner";

export function loadSimulationOwner(): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(OWNER_KEY);
}

/**
 * Called whenever a session resolves to a user, including one restored on a
 * reload. Drops a run stamped for somebody else, then stamps this user.
 *
 * A run with no stamp is kept: it predates the stamp, and on a restored session
 * it belongs to the person who is still signed in. A fresh sign-in is stricter
 * and handles that case itself -- see `signIn` in `authRepository.ts`.
 */
export function claimSimulationStorage(uid: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const owner = window.localStorage.getItem(OWNER_KEY);

  if (owner && owner !== uid) {
    clearSimulationState();
  }

  window.localStorage.setItem(OWNER_KEY, uid);
}

/** Signing out, or a different account signing in: nothing is carried over. */
export function releaseSimulationStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  clearSimulationState();
  window.localStorage.removeItem(OWNER_KEY);
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
