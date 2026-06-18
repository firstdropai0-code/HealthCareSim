import type { Scenario } from "./scenario";
import type { VoiceMetrics } from "./voice";

export type SimulationMessageRole = "system" | "scenario" | "trainee" | "feedback";
export type ScenarioSpeaker = "patient" | "family_member" | "nurse" | "bystander" | "narrator";
export type TensionLevel = "low" | "medium" | "high";
export type SimulationStatus = "not_started" | "in_progress" | "completed";

export type SimulationMessage = {
  id: string;
  role: SimulationMessageRole;
  content: string;
  timestamp: string;
  voiceMetrics?: VoiceMetrics;
  speaker?: ScenarioSpeaker;
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
  speaker: ScenarioSpeaker;
  message: string;
  tensionLevel: TensionLevel;
  shouldEnd: boolean;
};
