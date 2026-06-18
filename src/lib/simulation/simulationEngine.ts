import type { Scenario } from "@/types/scenario";
import type { ScenarioSpeaker, SimulationMessage, SimulationState } from "@/types/simulation";
import type { VoiceMetrics } from "@/types/voice";

export function createMessage(
  role: SimulationMessage["role"],
  content: string,
  voiceMetrics?: VoiceMetrics,
  speaker?: ScenarioSpeaker,
): SimulationMessage {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    timestamp: new Date().toISOString(),
    ...(voiceMetrics ? { voiceMetrics } : {}),
    ...(speaker ? { speaker } : {}),
  };
}

export function createInitialSimulationState(scenario: Scenario): SimulationState {
  return {
    scenario,
    messages: [createMessage("scenario", scenario.firstPrompt, undefined, "narrator")],
    currentTurn: 0,
    maxTurns: Math.max(1, scenario.suggestedTurns || 5),
    tensionLevel: "low",
    status: "in_progress",
  };
}

export function appendSimulationTurn(
  state: SimulationState,
  traineeResponse: string,
  scenarioMessage: string,
  scenarioSpeaker: ScenarioSpeaker,
  tensionLevel: SimulationState["tensionLevel"],
  shouldEnd: boolean,
  voiceMetrics?: VoiceMetrics,
): SimulationState {
  const nextTurn = state.currentTurn + 1;
  const reachedMaxTurns = nextTurn >= state.maxTurns;

  return {
    ...state,
    messages: [
      ...state.messages,
      createMessage("trainee", traineeResponse, voiceMetrics),
      createMessage("scenario", scenarioMessage, undefined, scenarioSpeaker),
    ],
    currentTurn: nextTurn,
    tensionLevel,
    status: shouldEnd || reachedMaxTurns ? "completed" : "in_progress",
  };
}
