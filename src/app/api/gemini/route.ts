import { NextResponse } from "next/server";
import {
  buildFeedbackReportSchema,
  deliveryFeedbackSchema,
  nextSimulationTurnSchema,
  scenarioSchema,
} from "@/lib/ai/geminiSchemas";
import {
  callGeminiJson,
  isGeminiCapacityError,
  isInvalidJsonResponse,
} from "@/lib/ai/geminiServer";
import { assignCharacterVoices } from "@/lib/ai/voiceDirection";
import { normalizeBetterResponses } from "@/lib/feedback/betterResponses";
import {
  buildDeliveryFeedbackPrompt,
  buildFeedbackPrompt,
  getExtraEvaluationCriteria,
} from "@/lib/prompts/feedbackPrompt";
import { buildScenarioPrompt } from "@/lib/prompts/scenarioPrompt";
import {
  difficultyOrder,
  type ScenarioDifficulty,
} from "@/lib/scenarios/scenarioLibrary";
import {
  buildSimulationPrompt,
  type SimulationPromptMessage,
  type SimulationPromptPayload,
} from "@/lib/prompts/simulationPrompt";
import {
  subscoreDimensions,
  type FeedbackReport,
  type SkillSubscores,
} from "@/types/feedback";
import type { Scenario } from "@/types/scenario";
import type {
  NextSimulationTurn,
  ScenarioSpeaker,
  SimulationState,
} from "@/types/simulation";

type GeminiRequest =
  | {
      action: "generateScenario";
      payload: { input: string; difficulty?: ScenarioDifficulty };
    }
  | {
      action: "nextTurn";
      payload: {
        state: SimulationState;
        traineeResponse: string;
        systemInstruction?: string;
        messages?: SimulationPromptMessage[];
      };
    }
  | { action: "feedback"; payload: { state: SimulationState } };

const SCENARIO_TIMEOUT_MS = 22_000;
const NEXT_TURN_TIMEOUT_MS = 35_000;
const FEEDBACK_TIMEOUT_MS = 22_000;

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isScenarioDifficulty(value: unknown): value is ScenarioDifficulty {
  return difficultyOrder.includes(value as ScenarioDifficulty);
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeSimulationPromptPayload(
  systemInstruction: unknown,
  messages: unknown,
): SimulationPromptPayload | undefined {
  if (typeof systemInstruction !== "string" || !Array.isArray(messages)) {
    return undefined;
  }

  const normalizedMessages = messages.filter(
    (message): message is SimulationPromptMessage =>
      Boolean(message) &&
      typeof message === "object" &&
      ((message as SimulationPromptMessage).role === "user" ||
        (message as SimulationPromptMessage).role === "model") &&
      typeof (message as SimulationPromptMessage).text === "string",
  );

  return normalizedMessages.length > 0
    ? { systemInstruction, messages: normalizedMessages }
    : undefined;
}

/**
 * The opening line is shown as a narrator message and must never be the
 * clinician (the trainee) speaking. Scenario generation is instructed not to do
 * this, but the model occasionally slips and writes the doctor greeting or
 * questioning the patient. Catch the unambiguous clinician-voice markers so we
 * can repair the line rather than trust it -- the same "guard, don't trust"
 * approach used for simulation turns (see appearsToSpeakAsTrainee).
 */
function firstPromptSoundsLikeClinician(firstPrompt: string): boolean {
  const normalized = firstPrompt.toLowerCase();

  const clinicianMarkers = [
    "i'm here to",
    "i am here to",
    "i'm here for",
    "i am here for",
    "the nurse told me",
    "the nurse just told me",
    "how are you feeling",
    "how can i help",
    "what can i do for you",
    "let me explain",
    "i wanted to talk",
    "i need to talk to you",
    "i'm the doctor",
    "i am the doctor",
    "i'm dr",
    "i am dr",
    "thank you for waiting",
    "thanks for waiting",
    "i'll be taking care",
    "i will be taking care",
    "i have some news",
    "i have some difficult news",
    "i understand you're waiting",
    "i understand you have",
  ];

  return clinicianMarkers.some((phrase) => normalized.includes(phrase));
}

/**
 * Build a safe narrator opening from the scene description when the model's
 * firstPrompt has to be discarded, so the simulation still starts from the
 * patient/family/narrator side and prompts the trainee to respond.
 */
function buildNarratorOpening(scene: string): string {
  const trimmedScene = scene.trim().replace(/\s+/g, " ");
  const base = trimmedScene || "The patient or family member waits for you to speak.";
  const withStop = /[.!?"']$/.test(base) ? base : `${base}.`;

  return `${withStop} What do you say?`;
}

function normalizeScenario(value: unknown): Scenario {
  const scenario = value as Partial<Scenario>;

  if (!scenario.title || !scenario.firstPrompt) {
    throw new Error("Generated scenario is missing required fields.");
  }

  const startingSituation = scenario.startingSituation || scenario.summary || "";
  const firstPrompt = firstPromptSoundsLikeClinician(scenario.firstPrompt)
    ? buildNarratorOpening(startingSituation)
    : scenario.firstPrompt;

  const normalized: Scenario = {
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
    startingSituation,
    firstPrompt,
    suggestedTurns: Math.max(3, Math.min(6, Number(scenario.suggestedTurns || 4))),
    endingCondition: scenario.endingCondition || "The conversation reaches a natural close.",
    evaluationCriteria:
      Array.isArray(scenario.evaluationCriteria) && scenario.evaluationCriteria.length > 0
        ? scenario.evaluationCriteria
        : ["Empathy", "Clarity", "Pressure handling", "Shared understanding"],
    mediaAssets: scenario.mediaAssets || [],
    // Progress metadata is set on the client and is absent on the generation
    // path. It is passed through rather than defaulted because this function
    // rebuilds the object field by field and would otherwise silently drop it
    // for anything that round-trips a scenario back through here.
    ...(scenario.libraryId ? { libraryId: scenario.libraryId } : {}),
    ...(scenario.category ? { category: scenario.category } : {}),
    ...(scenario.difficulty ? { difficulty: scenario.difficulty } : {}),
  };

  // Pin voices here rather than asking the model for them: it's a closed set of
  // preset voice ids, and the assignment only needs to happen once per scenario.
  return { ...normalized, characterVoices: assignCharacterVoices(normalized) };
}

function buildFallbackScenario(input: string): Scenario {
  const cleanInput = input.replace(/\s+/g, " ").trim();
  const titleBase = cleanInput.split(/[.!?]/)[0]?.trim() || "Healthcare communication roleplay";

  return normalizeScenario({
    id: crypto.randomUUID(),
    title: titleBase.slice(0, 72),
    setting: "Healthcare communication setting",
    summary: cleanInput
      ? `Communication practice based on: ${cleanInput.slice(0, 120)}`
      : "Communication practice with a concerned patient or family member.",
    patientProfile: "Patient or family member under communication stress.",
    patientEmotion: "concerned",
    familyEmotion: "anxious",
    traineeObjective:
      "Acknowledge emotion, explain what can be shared, and agree on one next step.",
    communicationChallenge:
      "Respond calmly when the other person is worried, frustrated, or confused.",
    startingSituation:
      cleanInput || "A patient or family member needs a clear, calm update from the trainee.",
    firstPrompt:
      "The patient or family member asks for a clear update and seems worried. What do you say next?",
    suggestedTurns: 4,
    endingCondition: "The trainee communicates clearly, validates emotion, and checks understanding.",
    evaluationCriteria: ["Empathy", "Clarity", "Boundaries", "Next steps"],
    mediaAssets: [],
  });
}

function normalizeTurn(value: unknown): NextSimulationTurn {
  const turn = value as Partial<NextSimulationTurn>;
  const speaker = normalizeScenarioSpeaker(turn.speaker);
  const tensionLevel =
    turn.tensionLevel === "low" || turn.tensionLevel === "medium" || turn.tensionLevel === "high"
      ? turn.tensionLevel
      : "medium";

  if (!turn.message) {
    throw new Error("Generated simulation turn is missing a message.");
  }

  return {
    speaker,
    message: turn.message,
    tensionLevel,
    shouldEnd: Boolean(turn.shouldEnd),
  };
}

function normalizeScenarioSpeaker(value: unknown): ScenarioSpeaker {
  if (
    value === "patient" ||
    value === "family_member" ||
    value === "nurse" ||
    value === "bystander" ||
    value === "narrator"
  ) {
    return value;
  }

  return "narrator";
}

function appearsToSpeakAsTrainee(turn: NextSimulationTurn): boolean {
  if (turn.speaker === "nurse" || turn.speaker === "narrator") {
    return false;
  }

  const normalizedMessage = turn.message
    .trim()
    .replace(/^["']+/, "")
    .toLowerCase();
  const doctorLikeStarts = [
    "i understand",
    "i can",
    "i will",
    "we are",
    "let me",
    "i'm going to",
    "i am going to",
    "i cannot share",
    "i can't share",
  ];

  return doctorLikeStarts.some((phrase) => normalizedMessage.startsWith(phrase));
}

function buildSafeNarratorTurn(): NextSimulationTurn {
  return {
    speaker: "narrator",
    message:
      "The patient or family member still seems unsure and waits for a clearer explanation. What do you say next?",
    tensionLevel: "medium",
    shouldEnd: false,
  };
}

function normalizeCustomCriteriaFeedback(value: unknown): FeedbackReport["customCriteriaFeedback"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is { criterion: unknown; assessment: unknown } =>
        Boolean(item) && typeof item === "object",
    )
    .map((item) => ({
      criterion: typeof item.criterion === "string" ? item.criterion : "",
      assessment: typeof item.assessment === "string" ? item.assessment : "",
    }))
    .filter((item) => item.criterion && item.assessment);
}

/**
 * Clamps every dimension to 1-10. Returns undefined rather than filling gaps
 * when the object is missing or partial: an invented subscore would flow
 * straight into a trainee's skill tree and a cohort average as if it were real.
 */
function normalizeSubscores(value: unknown): SkillSubscores | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const result = {} as SkillSubscores;

  for (const dimension of subscoreDimensions) {
    const score = Number(raw[dimension]);

    if (!Number.isFinite(score)) {
      return undefined;
    }

    result[dimension] = Math.max(1, Math.min(10, Math.round(score)));
  }

  return result;
}

function normalizeFeedback(value: unknown): FeedbackReport {
  const report = value as Partial<FeedbackReport>;

  if (!report.summary || !report.finalAdvice) {
    throw new Error("Generated feedback report is missing required fields.");
  }

  const subscores = normalizeSubscores(report.subscores);

  return {
    overallScore: Math.max(1, Math.min(10, Number(report.overallScore || 6))),
    ...(subscores ? { subscores } : {}),
    summary: report.summary,
    whatWentWell: normalizeStringArray(report.whatWentWell),
    whatCouldImprove: normalizeStringArray(report.whatCouldImprove),
    communicationGaps: normalizeStringArray(report.communicationGaps),
    betterResponses: normalizeBetterResponses(report.betterResponses),
    // deliveryFeedback is intentionally not read here: the scoring call never
    // receives voice metrics and never produces it. generateFeedback merges it
    // in from its own separate call.
    finalAdvice: report.finalAdvice,
    customCriteriaFeedback: normalizeCustomCriteriaFeedback(report.customCriteriaFeedback),
    source: report.source === "fallback" ? "fallback" : "ai",
    ...(report.fallbackReason ? { fallbackReason: report.fallbackReason } : {}),
  };
}

function buildFallbackFeedback(state: SimulationState): FeedbackReport {
  const traineeMessages = state.messages.filter((message) => message.role === "trainee");
  const scenarioMessages = state.messages.filter((message) => message.role === "scenario");

  return normalizeFeedback({
    // No subscores on purpose. This score is a hardcoded placeholder, not a
    // judgement, which is why the run it produces is excluded from every
    // aggregate — fabricating five more numbers here would poison the skill
    // tree with confident-looking noise.
    overallScore: 6,
    source: "fallback",
    fallbackReason: "Basic fallback feedback generated because Gemini feedback was unavailable.",
    summary: "Basic fallback feedback generated because Gemini feedback was unavailable.",
    whatWentWell: [
      "You completed the roleplay and kept the conversation moving.",
      "Your response can be reviewed against the patient or family concern.",
    ],
    whatCouldImprove: [
      "Use one clear acknowledgement of emotion before explaining next steps.",
      "Keep responses short enough for the patient or family member to follow.",
    ],
    communicationGaps:
      scenarioMessages.length > 1
        ? [
            "Check whether the patient or family member understood your explanation.",
            "Name the immediate next communication step before moving on.",
          ]
        : ["Continue the conversation for more specific communication feedback."],
    betterResponses: [
      "I can see this is worrying, and I want to explain what I can share clearly.",
      "The next step is to clarify who can update you and when that update will happen.",
    ],
    finalAdvice:
      traineeMessages.length > 0
        ? "Review your conversation log for empathy, plain language, and a clear next step. This fallback avoids clinical judgement."
        : "Add at least one trainee response before generating a detailed communication report.",
    customCriteriaFeedback: getExtraEvaluationCriteria(state).map(fallbackCustomCriterionAssessment),
  });
}

async function generateScenario(
  input: string,
  difficulty: ScenarioDifficulty,
): Promise<Scenario> {
  const prompt = buildScenarioPrompt(input, difficulty);
  const result = await callGeminiJson({
    action: "scenario",
    prompt,
    models: [process.env.GEMINI_MODEL || "gemini-2.5-flash"],
    temperature: 0.25,
    maxOutputTokens: 1000,
    timeoutMs: SCENARIO_TIMEOUT_MS,
    schema: scenarioSchema,
  });

  return normalizeScenario(result);
}

async function generateTurn(
  state: SimulationState,
  traineeResponse: string,
  promptPayload?: SimulationPromptPayload,
  roleCorrection?: { rejectedMessage: string },
): Promise<NextSimulationTurn> {
  const prompt =
    roleCorrection || !promptPayload
      ? buildSimulationPrompt(
          state,
          traineeResponse,
          roleCorrection
            ? { roleCorrection: true, rejectedMessage: roleCorrection.rejectedMessage }
            : undefined,
        )
      : promptPayload;

  const result = await callGeminiJson({
    action: "nextTurn",
    prompt: prompt.systemInstruction,
    systemInstruction: prompt.systemInstruction,
    messages: prompt.messages,
    models: [process.env.GEMINI_MODEL || "gemini-2.5-flash"],
    temperature: 0.35,
    maxOutputTokens: 512,
    timeoutMs: NEXT_TURN_TIMEOUT_MS,
    schema: nextSimulationTurnSchema,
    retryInvalidJson: !roleCorrection,
  });

  return normalizeTurn(result);
}

function fallbackCustomCriterionAssessment(criterion: string): { criterion: string; assessment: string } {
  return {
    criterion,
    assessment: "Add another trainee response so this custom criterion can be assessed in detail.",
  };
}

/**
 * Align the model's custom-criteria output back to the trainer's own criteria
 * text. Force the criterion label to the trainer's exact wording and only
 * borrow the AI's assessment, so a mismatched, reordered, or short model
 * response can never desync the section from what's actually on the checklist.
 * Missing entries fall back to the "needs more responses" placeholder.
 */
function reconcileCustomCriteriaFeedback(
  extraCriteria: string[],
  parsed: FeedbackReport["customCriteriaFeedback"],
): FeedbackReport["customCriteriaFeedback"] {
  const assessments = parsed || [];

  return extraCriteria.map((criterion, index) => ({
    criterion,
    assessment:
      assessments[index]?.assessment || fallbackCustomCriterionAssessment(criterion).assessment,
  }));
}

/**
 * Delivery coaching, generated separately from the score so the scoring call
 * never sees the voice metrics. Best-effort: if it fails, the report simply
 * ships without the delivery card rather than losing the whole feedback run.
 */
async function generateDeliveryFeedback(state: SimulationState): Promise<string[]> {
  const prompt = buildDeliveryFeedbackPrompt(state);

  // Null means nothing was captured (typed session, or analysis unavailable),
  // so there is no call to make.
  if (!prompt) {
    return [];
  }

  try {
    const result = (await callGeminiJson({
      action: "feedback",
      prompt,
      models: [process.env.GEMINI_MODEL || "gemini-2.5-flash"],
      temperature: 0.3,
      maxOutputTokens: 500,
      timeoutMs: FEEDBACK_TIMEOUT_MS,
      schema: deliveryFeedbackSchema,
    })) as { deliveryFeedback?: unknown };

    return normalizeStringArray(result?.deliveryFeedback);
  } catch (error) {
    console.error("Delivery feedback generation failed, omitting the section:", error);
    return [];
  }
}

async function generateFeedback(state: SimulationState): Promise<FeedbackReport> {
  const extraCriteria = getExtraEvaluationCriteria(state);
  const hasCustomCriteria = extraCriteria.length > 0;

  // Main report and custom criteria come from ONE call so both sections reason
  // over the transcript together and cannot reach opposite verdicts about the
  // same behavior. Delivery coaching stays a separate parallel call by design
  // (the scoring context must never see voice metrics).
  const [mainResult, deliveryFeedback] = await Promise.all([
    callGeminiJson({
      action: "feedback",
      prompt: buildFeedbackPrompt(state, extraCriteria),
      models: [process.env.GEMINI_MODEL || "gemini-2.5-flash"],
      temperature: 0.25,
      // Extra headroom when the response must also carry the custom-criteria
      // section, so the combined JSON is never truncated.
      // Bumped from 2900/2200 for the subscores block.
      maxOutputTokens: hasCustomCriteria ? 3100 : 2400,
      timeoutMs: FEEDBACK_TIMEOUT_MS,
      schema: buildFeedbackReportSchema(extraCriteria.length),
    }),
    generateDeliveryFeedback(state),
  ]);

  const normalized = normalizeFeedback(mainResult);
  const customCriteriaFeedback = hasCustomCriteria
    ? reconcileCustomCriteriaFeedback(extraCriteria, normalized.customCriteriaFeedback)
    : [];

  return { ...normalized, customCriteriaFeedback, deliveryFeedback };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GeminiRequest;

    if (body.action === "generateScenario") {
      const input = body.payload.input?.trim();

      if (!input) {
        return errorResponse("Enter a scenario idea before generating.");
      }

      // Never trusted straight from the body: an unrecognised value would index
      // the guidance map to undefined and drop the tier from the prompt.
      const difficulty = isScenarioDifficulty(body.payload.difficulty)
        ? body.payload.difficulty
        : "intermediate";

      try {
        return NextResponse.json({ result: await generateScenario(input, difficulty) });
      } catch (error) {
        if (isInvalidJsonResponse(error)) {
          console.error("Gemini scenario generation returned invalid JSON, using fallback:", error);
          return NextResponse.json({ result: buildFallbackScenario(input) });
        }

        throw error;
      }
    }

    if (body.action === "nextTurn") {
      const { state, traineeResponse, systemInstruction, messages } = body.payload;

      if (!state || !traineeResponse?.trim()) {
        return errorResponse("Simulation state and trainee response are required.");
      }

      const promptPayload = normalizeSimulationPromptPayload(systemInstruction, messages);
      let firstResult: NextSimulationTurn;

      try {
        firstResult = await generateTurn(state, traineeResponse, promptPayload);
      } catch (error) {
        console.error("Gemini next-turn generation failed, using safe narrator turn:", error);
        return NextResponse.json({ result: buildSafeNarratorTurn() });
      }

      if (!appearsToSpeakAsTrainee(firstResult)) {
        return NextResponse.json({ result: firstResult });
      }

      try {
        const correctedResult = await generateTurn(state, traineeResponse, undefined, {
          rejectedMessage: firstResult.message,
        });

        return NextResponse.json({
          result: appearsToSpeakAsTrainee(correctedResult) ? buildSafeNarratorTurn() : correctedResult,
        });
      } catch (error) {
        console.error("Gemini role-correction retry failed, using safe narrator turn:", error);
        return NextResponse.json({ result: buildSafeNarratorTurn() });
      }
    }

    if (body.action === "feedback") {
      const { state } = body.payload;

      if (!state) {
        return errorResponse("Simulation state is required.");
      }

      if (!state.messages.some((message) => message.role === "trainee" && message.content.trim())) {
        return errorResponse("Add at least one trainee response before generating feedback.");
      }

      try {
        return NextResponse.json({ result: await generateFeedback(state) });
      } catch (error) {
        console.error("Gemini feedback generation failed, using fallback:", error);
        return NextResponse.json({ result: buildFallbackFeedback(state) });
      }
    }

    return errorResponse("Unsupported Gemini action.");
  } catch (error) {
    if (error instanceof SyntaxError) {
      return errorResponse("Request body must be valid JSON.");
    }

    if (isGeminiCapacityError(error)) {
      return errorResponse(error.message, 503);
    }

    if (error instanceof Error && error.message.includes("GEMINI_API_KEY")) {
      return errorResponse("GEMINI_API_KEY is not configured.", 500);
    }

    return errorResponse("The AI request failed. Please try again.", 502);
  }
}
