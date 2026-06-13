import type { SimulationState } from "@/types/simulation";
import {
  clearSimulationState,
  loadSimulationState,
  saveSimulationState,
} from "./localSimulationStorage";

export type SimulationStorageProvider = {
  save: (state: SimulationState) => void | Promise<void>;
  load: () => SimulationState | null | Promise<SimulationState | null>;
  clear: () => void | Promise<void>;
};

export const localStorageProvider: SimulationStorageProvider = {
  save: saveSimulationState,
  load: loadSimulationState,
  clear: clearSimulationState,
};
