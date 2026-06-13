import { NextResponse } from "next/server";
import { buildFeedbackPrompt } from "@/lib/prompts/feedbackPrompt";
import { buildScenarioPrompt } from "@/lib/prompts/scenarioPrompt";
import { buildSimulationPrompt } from "@/lib/prompts/simulationPrompt";
import type { FeedbackReport } from "@/types/feedback";
import type { Scenario } from "@/types/scenario";
import type { NextSimulationTurn, SimulationState } from "@/types/simulation";

type GeminiRequest =
  | { action: "generateScenario"; payload: { input: string } }
  | {
      action: "nextTurn";
      payload: { state: SimulationState; traineeResponse: string };
    }
  | { action: "feedback"; payload: { state: SimulationState } };

const GEMINI_MODELS = [
  process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-3.5-flash",
];

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const firstBrace = withoutFence.indexOf("{");
    const lastBrace = withoutFence.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("AI response did not include valid JSON.");
    }

    return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
  }
}

type GeminiHttpError = Error & {
  status?: number;
  model?: string;
};

function isRetryableGeminiStatus(status?: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function callGeminiModel(prompt: string, model: string): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(`${endpoint}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.55,
        responseMimeType: "application/json",
        maxOutputTokens: 900,
      },
    }),
  });

  if (!response.ok) {
    let detail = "";

    try {
      const errorData = (await response.json()) as {
        error?: { message?: string; status?: string };
      };
      detail = errorData.error?.message || errorData.error?.status || "";
    } catch {
      detail = response.statusText;
    }

    const geminiError = new Error(
      `Gemini request failed (${response.status}) on ${model}${detail ? `: ${detail}` : "."}`,
    ) as GeminiHttpError;
    geminiError.status = response.status;
    geminiError.model = model;

    throw geminiError;
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return extractJson(text);
}

async function callGemini(prompt: string): Promise<unknown> {
  const uniqueModels = Array.from(new Set(GEMINI_MODELS));
  const errors: string[] = [];

  for (const model of uniqueModels) {
    try {
      return await callGeminiModel(prompt, model);
    } catch (error) {
      const geminiError = error as GeminiHttpError;
      errors.push(geminiError.message);

      if (!isRetryableGeminiStatus(geminiError.status)) {
        throw error;
      }
    }
  }

  throw new Error(
    `All Gemini models are currently unavailable. Last error: ${errors.at(-1) || "unknown error"}`,
  );
}

function normalizeScenario(value: unknown): Scenario {
  const scenario = value as Partial<Scenario>;

  if (!scenario.title || !scenario.firstPrompt) {
    throw new Error("Generated scenario is missing required fields.");
  }

  return {
    id: scenario.id || crypto.randomUUID(),
    title: scenario.title,
    setting: scenario.setting || "Healthcare consultation",
    summary: scenario.summary || "Communication training scenario.",
    patientProfile: scenario.patientProfile || "Patient profile not specified.",
    patientEmotion: scenario.patientEmotion || "concerned",
    familyEmotion: scenario.familyEmotion,
    traineeObjective: scenario.traineeObjective || "Communicate clearly and empathetically.",
    communicationChallenge:
      scenario.communicationChallenge || "Respond with empathy under pressure.",
    startingSituation: scenario.startingSituation || scenario.summary || "",
    firstPrompt: scenario.firstPrompt,
    suggestedTurns: Math.max(3, Math.min(6, Number(scenario.suggestedTurns || 4))),
    endingCondition: scenario.endingCondition || "The conversation reaches a natural close.",
    evaluationCriteria:
      Array.isArray(scenario.evaluationCriteria) && scenario.evaluationCriteria.length > 0
        ? scenario.evaluationCriteria
        : ["Empathy", "Clarity", "Pressure handling", "Shared understanding"],
    mediaAssets: scenario.mediaAssets || [],
  };
}

function normalizeTurn(value: unknown): NextSimulationTurn {
  const turn = value as Partial<NextSimulationTurn>;
  const tensionLevel =
    turn.tensionLevel === "low" || turn.tensionLevel === "medium" || turn.tensionLevel === "high"
      ? turn.tensionLevel
      : "medium";

  if (!turn.message) {
    throw new Error("Generated simulation turn is missing a message.");
  }

  return {
    message: turn.message,
    tensionLevel,
    shouldEnd: Boolean(turn.shouldEnd),
  };
}

function normalizeFeedback(value: unknown): FeedbackReport {
  const report = value as Partial<FeedbackReport>;

  if (!report.summary || !report.finalAdvice) {
    throw new Error("Generated feedback report is missing required fields.");
  }

  return {
    overallScore: Math.max(1, Math.min(10, Number(report.overallScore || 6))),
    summary: report.summary,
    whatWentWell: report.whatWentWell || [],
    whatCouldImprove: report.whatCouldImprove || [],
    communicationGaps: report.communicationGaps || [],
    betterResponses: report.betterResponses || [],
    finalAdvice: report.finalAdvice,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GeminiRequest;

    if (body.action === "generateScenario") {
      const input = body.payload.input?.trim();

      if (!input) {
        return errorResponse("Enter a scenario idea before generating.");
      }

      const result = normalizeScenario(await callGemini(buildScenarioPrompt(input)));
      return NextResponse.json({ result });
    }

    if (body.action === "nextTurn") {
      const { state, traineeResponse } = body.payload;

      if (!state || !traineeResponse?.trim()) {
        return errorResponse("Simulation state and trainee response are required.");
      }

      const result = normalizeTurn(
        await callGemini(buildSimulationPrompt(state, traineeResponse)),
      );
      return NextResponse.json({ result });
    }

    if (body.action === "feedback") {
      const { state } = body.payload;

      if (!state) {
        return errorResponse("Simulation state is required.");
      }

      const result = normalizeFeedback(await callGemini(buildFeedbackPrompt(state)));
      return NextResponse.json({ result });
    }

    return errorResponse("Unsupported Gemini action.");
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The AI request failed. Please try again.";

    return errorResponse(message, message.includes("GEMINI_API_KEY") ? 500 : 502);
  }
}
