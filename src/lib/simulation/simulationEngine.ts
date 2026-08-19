import type { Scenario } from "@/types/scenario";
import type {
  NextSimulationTurn,
  ScenarioSpeaker,
  SimulationMessage,
  SimulationState,
} from "@/types/simulation";
import type { VoiceMetrics } from "@/types/voice";

export function createMessage(
  role: SimulationMessage["role"],
  content: string,
  speaker?: ScenarioSpeaker,
  /** How this line should sound when read aloud. Empty or absent for none. */
  delivery?: string,
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
    // Conditional spread, never `delivery: undefined`: these messages are
    // written straight to Firestore, which rejects undefined values.
    ...(delivery ? { delivery } : {}),
  };
}

// A generous safety cap so the roleplay can run long enough to actually reach
// the scenario's ending condition, rather than cutting off at the AI's
// suggestedTurns figure (which is only pacing guidance shown to the trainer).
export const HARD_TURN_LIMIT = 12;

export function createInitialSimulationState(scenario: Scenario): SimulationState {
  return {
    // Minted here so the run has a stable identity from its first turn. It
    // becomes the Firestore document id, which is what makes re-generating a
    // report overwrite the same record instead of creating a duplicate.
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    startedAt: new Date().toISOString(),
    scenario,
    messages: [createMessage("scenario", scenario.firstPrompt, "narrator")],
    currentTurn: 0,
    maxTurns: HARD_TURN_LIMIT,
    tensionLevel: "low",
    status: "in_progress",
  };
}

export type SimulationTurnInput = {
  traineeResponse: string;
  /** The generated turn, passed whole rather than unpacked into arguments. */
  turn: NextSimulationTurn;
  /** Present only when the trainee spoke this turn and analysis succeeded. */
  traineeVoiceMetrics?: VoiceMetrics | null;
};

export function appendSimulationTurn(
  state: SimulationState,
  { traineeResponse, turn, traineeVoiceMetrics }: SimulationTurnInput,
): SimulationState {
  const nextTurn = state.currentTurn + 1;
  const reachedMaxTurns = nextTurn >= state.maxTurns;

  const traineeMessage = createMessage("trainee", traineeResponse);

  return {
    ...state,
    messages: [
      ...state.messages,
      traineeVoiceMetrics
        ? { ...traineeMessage, voiceMetrics: traineeVoiceMetrics }
        : traineeMessage,
      createMessage("scenario", turn.message, turn.speaker, turn.delivery),
    ],
    currentTurn: nextTurn,
    tensionLevel: turn.tensionLevel,
    status: turn.shouldEnd || reachedMaxTurns ? "completed" : "in_progress",
  };
}
