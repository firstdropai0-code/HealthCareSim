import type { Scenario } from "@/types/scenario";
import type { ScenarioSpeaker, SimulationMessage, SimulationState } from "@/types/simulation";

export function createMessage(
  role: SimulationMessage["role"],
  content: string,
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
    ...(speaker ? { speaker } : {}),
  };
}

// A generous safety cap so the roleplay can run long enough to actually reach
// the scenario's ending condition, rather than cutting off at the AI's
// suggestedTurns figure (which is only pacing guidance shown to the trainer).
export const HARD_TURN_LIMIT = 12;

export function createInitialSimulationState(scenario: Scenario): SimulationState {
  return {
    scenario,
    messages: [createMessage("scenario", scenario.firstPrompt, "narrator")],
    currentTurn: 0,
    maxTurns: HARD_TURN_LIMIT,
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
): SimulationState {
  const nextTurn = state.currentTurn + 1;
  const reachedMaxTurns = nextTurn >= state.maxTurns;

  return {
    ...state,
    messages: [
      ...state.messages,
      createMessage("trainee", traineeResponse),
      createMessage("scenario", scenarioMessage, scenarioSpeaker),
    ],
    currentTurn: nextTurn,
    tensionLevel,
    status: shouldEnd || reachedMaxTurns ? "completed" : "in_progress",
  };
}
