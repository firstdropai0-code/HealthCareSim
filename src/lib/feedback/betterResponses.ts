import type { BetterResponse } from "@/types/feedback";
import type { SimulationMessage, SimulationState } from "@/types/simulation";

/**
 * Accepts either the current object form or the bare strings that older reports
 * (and any model reply that ignores the schema) produce, so a report saved
 * before suggestions were anchored to a turn still renders.
 */
export function normalizeBetterResponses(value: unknown): BetterResponse[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): BetterResponse | null => {
      if (typeof item === "string") {
        return item.trim() ? { suggestion: item.trim() } : null;
      }

      if (!item || typeof item !== "object") {
        return null;
      }

      const entry = item as Record<string, unknown>;
      const suggestion = typeof entry.suggestion === "string" ? entry.suggestion.trim() : "";

      if (!suggestion) {
        return null;
      }

      const turn = Number(entry.respondsToTurn);
      const inResponseTo =
        typeof entry.inResponseTo === "string" ? entry.inResponseTo.trim() : "";

      return {
        suggestion,
        ...(Number.isInteger(turn) && turn > 0 ? { respondsToTurn: turn } : {}),
        ...(inResponseTo ? { inResponseTo } : {}),
      };
    })
    .filter((item): item is BetterResponse => item !== null);
}

/** The scenario-side messages, in order. Index + 1 is `respondsToTurn`. */
export function getScenarioMessages(state: SimulationState): SimulationMessage[] {
  return state.messages.filter((message) => message.role === "scenario");
}

/**
 * The actual message a suggestion answers. Resolved from the transcript rather
 * than trusting the model's own quote, so what is shown is always something
 * that was really said; returns null when the index is missing or out of range.
 */
export function resolveRespondedMessage(
  entry: BetterResponse,
  scenarioMessages: SimulationMessage[],
): SimulationMessage | null {
  if (!entry.respondsToTurn) {
    return null;
  }

  return scenarioMessages[entry.respondsToTurn - 1] ?? null;
}
