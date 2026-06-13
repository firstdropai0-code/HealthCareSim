import type { Scenario } from "@/types/scenario";
import type { SimulationMessage, SimulationState } from "@/types/simulation";

export function createMessage(
  role: SimulationMessage["role"],
  content: string,
): SimulationMessage {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    timestamp: new Date().toISOString(),
  };
}

export function createInitialSimulationState(scenario: Scenario): SimulationState {
  return {
    scenario,
    messages: [createMessage("scenario", scenario.firstPrompt)],
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
  tensionLevel: SimulationState["tensionLevel"],
  shouldEnd: boolean,
): SimulationState {
  const nextTurn = state.currentTurn + 1;
  const reachedMaxTurns = nextTurn >= state.maxTurns;

  return {
    ...state,
    messages: [
      ...state.messages,
      createMessage("trainee", traineeResponse),
      createMessage("scenario", scenarioMessage),
    ],
    currentTurn: nextTurn,
    tensionLevel,
    status: shouldEnd || reachedMaxTurns ? "completed" : "in_progress",
  };
}
