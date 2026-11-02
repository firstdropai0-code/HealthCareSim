import type { Scenario } from "@/types/scenario";
import type {
  NextSimulationTurn,
  ScenarioSpeaker,
  SimulationMessage,
  SimulationState,
} from "@/types/simulation";
import type { TurnPresence } from "@/types/presence";
import type { VoiceMetrics } from "@/types/voice";

export function createMessage(
  role: SimulationMessage["role"],
  content: string,
  speaker?: ScenarioSpeaker,
  /** How this line should sound when read aloud. Empty or absent for none. */
  delivery?: string,
  spokenContent?: string,
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
    ...(spokenContent ? { spokenContent } : {}),
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

/**
 * The messages as they go to Firestore: everything except the camera's numbers.
 *
 * Those exist to write the tips, which happens before the save, and nothing reads
 * them back. A named person's head movements shouldn't sit in a database for no
 * reason, and leaving them out is what lets the opt-in promise that only the tips
 * are saved. They stay on the state in this browser, where generating the report
 * again still needs them.
 */
export function messagesForStorage(messages: SimulationMessage[]): SimulationMessage[] {
  return messages.map((message) => {
    const stored = { ...message };
    delete stored.presence;
    return stored;
  });
}

export type SimulationTurnInput = {
  traineeResponse: string;
  /** The generated turn, passed whole rather than unpacked into arguments. */
  turn: NextSimulationTurn;
  /** Present only when the trainee spoke this turn and analysis succeeded. */
  traineeVoiceMetrics?: VoiceMetrics | null;
  /** Present only when the camera was on and measured something this turn. */
  traineePresence?: TurnPresence | null;
};

export function appendSimulationTurn(
  state: SimulationState,
  { traineeResponse, turn, traineeVoiceMetrics, traineePresence }: SimulationTurnInput,
): SimulationState {
  const nextTurn = state.currentTurn + 1;
  const reachedMaxTurns = nextTurn >= state.maxTurns;

  // Conditional for the same reason as below: Firestore rejects undefined.
  const traineeMessage = {
    ...createMessage("trainee", traineeResponse),
    ...(traineeVoiceMetrics ? { voiceMetrics: traineeVoiceMetrics } : {}),
    ...(traineePresence ? { presence: traineePresence } : {}),
  };

  return {
    ...state,
    messages: [
      ...state.messages,
      traineeMessage,
      {
        ...createMessage("scenario", turn.message, turn.speaker, turn.delivery, turn.spokenMessage),
        // Conditional for the same reason createMessage's fields are: this
        // object is written to Firestore, which rejects undefined values.
        ...(turn.expression ? { expression: turn.expression } : {}),
        tensionLevel: turn.tensionLevel,
      },
    ],
    currentTurn: nextTurn,
    tensionLevel: turn.tensionLevel,
    status: turn.shouldEnd || reachedMaxTurns ? "completed" : "in_progress",
  };
}
