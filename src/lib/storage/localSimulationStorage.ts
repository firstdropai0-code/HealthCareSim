import type { SimulationState } from "@/types/simulation";

const STORAGE_KEY = "firstdrop.currentSimulation";

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
}
