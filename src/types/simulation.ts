import type { Scenario } from "./scenario";
import type { VoiceMetrics } from "./voice";

export type SimulationMessageRole = "system" | "scenario" | "trainee" | "feedback";
export type TensionLevel = "low" | "medium" | "high";
export type SimulationStatus = "not_started" | "in_progress" | "completed";

export type SimulationMessage = {
  id: string;
  role: SimulationMessageRole;
  content: string;
  timestamp: string;
  voiceMetrics?: VoiceMetrics;
};

export type SimulationState = {
  scenario: Scenario;
  messages: SimulationMessage[];
  currentTurn: number;
  maxTurns: number;
  tensionLevel: TensionLevel;
  status: SimulationStatus;
};

export type NextSimulationTurn = {
  message: string;
  tensionLevel: TensionLevel;
  shouldEnd: boolean;
};
