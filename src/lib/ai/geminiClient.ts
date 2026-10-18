import { localizeServerError } from "@/lib/i18n/strings";
import type { AppLanguage } from "@/types/language";
import { buildSimulationPrompt } from "@/lib/prompts/simulationPrompt";
import type { ScenarioDifficulty } from "@/lib/scenarios/scenarioLibrary";
import type { FeedbackReport } from "@/types/feedback";
import type { Scenario } from "@/types/scenario";
import type { NextSimulationTurn, SimulationState } from "@/types/simulation";

type GeminiAction = "generateScenario" | "castScenario" | "nextTurn" | "feedback";

async function callGemini<T>(action: GeminiAction, payload: unknown): Promise<T> {
  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, payload }),
  });

  const data = (await response.json()) as { result?: T; error?: string };

  if (!response.ok || !data.result) {
    throw new Error(localizeServerError(data.error, "error.aiFailed"));
  }

  return data.result;
}

export function generateScenarioFromIdea(
  input: string,
  difficulty: ScenarioDifficulty,
  language: AppLanguage = "en",
): Promise<Scenario> {
  return callGemini<Scenario>("generateScenario", { input, difficulty, language });
}

/**
 * The cast, and voices recast to fit it, for a scenario published before
 * casts existed. Call it before the run's first line, never mid-run: it
 * recasts every voice, and a character must not change voice partway through.
 */
export function castScenario(scenario: Scenario): Promise<Pick<Scenario, "cast" | "characterVoices">> {
  return callGemini<Pick<Scenario, "cast" | "characterVoices">>("castScenario", { scenario });
}

export function generateNextSimulationTurn(
  state: SimulationState,
  traineeResponse: string,
): Promise<NextSimulationTurn> {
  const prompt = buildSimulationPrompt(state, traineeResponse);

  return callGemini<NextSimulationTurn>("nextTurn", {
    state,
    traineeResponse,
    systemInstruction: prompt.systemInstruction,
    messages: prompt.messages,
  });
}

export function generateFeedbackReport(
  state: SimulationState,
): Promise<FeedbackReport> {
  return callGemini<FeedbackReport>("feedback", { state });
}
