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
  speaker?: ScenarioSpeaker;
  /**
   * Stage direction for how this line sounds when spoken, written by the model
   * alongside the line itself. Persisted so re-reading an older message sounds
   * the way it did the first time, rather than regressing to the scenario's
   * static emotion. Absent on trainee turns and on anything generated before
   * this existed.
   */
  delivery?: string;
  /**
   * Delivery metrics for a spoken trainee turn. Absent when the turn was typed
   * rather than spoken, or when analysis was unavailable.
   */
  voiceMetrics?: VoiceMetrics;
};

export type SimulationState = {
  /**
   * Run identity. Optional so states already in localStorage from before this
   * existed still parse — the save path falls back to a fresh UUID.
   */
  id?: string;
  startedAt?: string;
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
  /**
   * How this line sounds when spoken. Empty string when there is none -- a
   * narrator turn, or a model that did not supply one.
   */
  delivery: string;
  tensionLevel: TensionLevel;
  shouldEnd: boolean;
};
