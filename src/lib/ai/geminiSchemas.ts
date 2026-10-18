import { castRoles, expressions } from "@/types/cast";
import { sceneIds } from "@/types/scene";

export type GeminiSchema = {
  type: "OBJECT" | "ARRAY" | "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN";
  description?: string;
  properties?: Record<string, GeminiSchema>;
  items?: GeminiSchema;
  required?: string[];
  enum?: string[];
  nullable?: boolean;
  minItems?: number;
  maxItems?: number;
};

const stringArraySchema: GeminiSchema = {
  type: "ARRAY",
  items: { type: "STRING" },
};

// Enums throughout: gender and age band choose a portrait and a voice, and
// the expression names an image file. Free text here would have to be parsed
// back into exactly these values anyway.
const castSchema: GeminiSchema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    required: ["role", "name", "relationship", "gender", "ageBand", "expression"],
    properties: {
      role: { type: "STRING", enum: [...castRoles] },
      name: { type: "STRING" },
      relationship: { type: "STRING" },
      gender: { type: "STRING", enum: ["female", "male"] },
      ageBand: { type: "STRING", enum: ["child", "young_adult", "adult", "older"] },
      expression: { type: "STRING", enum: [...expressions] },
    },
  },
};

/** Just the cast, for a scenario that was published before casts existed. */
export const castOnlySchema: GeminiSchema = {
  type: "OBJECT",
  required: ["cast"],
  properties: { cast: castSchema },
};

export const scenarioSchema: GeminiSchema = {
  type: "OBJECT",
  required: [
    "id",
    "title",
    "setting",
    // Required and an enum: it names the room image. Optional, the model would
    // skip it and every scenario would fall back to keyword matching.
    "settingKind",
    "summary",
    "patientProfile",
    // Required and an enum, so the model has to decide alive or deceased
    // outright. Left to free text it put the death in patientEmotion, where
    // nothing could tell it from a feeling.
    "patientStatus",
    "patientEmotion",
    // Required, not optional. Left optional the model skipped it even when the
    // family WAS the counterpart, which left them voiced with the patient's
    // emotion — a sedated child's "calm" read onto a frantic parent.
    "familyEmotion",
    "traineeObjective",
    "communicationChallenge",
    "startingSituation",
    "firstPrompt",
    "suggestedTurns",
    "endingCondition",
    "evaluationCriteria",
    "mediaAssets",
    "cast",
  ],
  properties: {
    id: { type: "STRING" },
    cast: castSchema,
    title: { type: "STRING" },
    setting: { type: "STRING" },
    settingKind: { type: "STRING", enum: [...sceneIds] },
    summary: { type: "STRING" },
    patientProfile: { type: "STRING" },
    patientStatus: { type: "STRING", enum: ["alive", "deceased"] },
    patientEmotion: { type: "STRING" },
    familyEmotion: { type: "STRING" },
    traineeObjective: { type: "STRING" },
    communicationChallenge: { type: "STRING" },
    startingSituation: { type: "STRING" },
    firstPrompt: { type: "STRING" },
    suggestedTurns: { type: "INTEGER" },
    endingCondition: { type: "STRING" },
    evaluationCriteria: stringArraySchema,
    mediaAssets: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {},
      },
    },
  },
};

export const nextSimulationTurnSchema: GeminiSchema = {
  type: "OBJECT",
  // delivery is required rather than optional. Gemini reliably fills required
  // fields and reliably skips optional ones, and a turn without its stage
  // direction falls back to the scenario's frozen emotion -- which is the
  // problem the field exists to fix. The narrator case returns "" instead.
  // expression is required for the same reason as delivery: an optional field
  // gets skipped, and a skipped one leaves the face frozen on its opening look
  // while the voice is sobbing. Narrator turns return "calm", which is ignored.
  required: ["speaker", "message", "delivery", "expression", "tensionLevel", "shouldEnd"],
  properties: {
    speaker: {
      type: "STRING",
      enum: ["patient", "family_member", "nurse", "bystander", "narrator"],
    },
    message: { type: "STRING" },
    delivery: { type: "STRING" },
    expression: { type: "STRING", enum: [...expressions] },
    tensionLevel: {
      type: "STRING",
      enum: ["low", "medium", "high"],
    },
    shouldEnd: { type: "BOOLEAN" },
  },
};

/**
 * Each suggested line carries the scenario turn it answers, so the report can
 * show it against the moment it belongs to. Only `suggestion` is required —
 * a model that cannot place a line still returns a usable one.
 */
const betterResponseItemSchema: GeminiSchema = {
  type: "OBJECT",
  required: ["suggestion"],
  properties: {
    respondsToTurn: { type: "INTEGER" },
    inResponseTo: { type: "STRING" },
    suggestion: { type: "STRING" },
  },
};

/**
 * Per-dimension scores. These are the skill-tree axes and the cohort comparison
 * dimensions.
 *
 * There is NO `delivery` dimension here, on purpose. Delivery coaching comes
 * from a separate call that never receives the scoring context — see the header
 * of `src/lib/prompts/feedbackPrompt.ts`. Adding one would make delivery
 * scoreable and quietly break the guarantee that whole arrangement exists to
 * provide. Do not "complete the set".
 */
const subscoresSchema: GeminiSchema = {
  type: "OBJECT",
  required: ["empathy", "clarity", "structure", "professionalism", "deEscalation"],
  properties: {
    empathy: { type: "INTEGER" },
    clarity: { type: "INTEGER" },
    structure: { type: "INTEGER" },
    professionalism: { type: "INTEGER" },
    deEscalation: { type: "INTEGER" },
  },
};

export const feedbackReportSchema: GeminiSchema = {
  type: "OBJECT",
  required: [
    "overallScore",
    "subscores",
    "summary",
    "whatWentWell",
    "whatCouldImprove",
    "communicationGaps",
    "betterResponses",
    "finalAdvice",
  ],
  properties: {
    overallScore: { type: "INTEGER" },
    subscores: subscoresSchema,
    summary: { type: "STRING" },
    whatWentWell: stringArraySchema,
    whatCouldImprove: stringArraySchema,
    communicationGaps: stringArraySchema,
    betterResponses: { type: "ARRAY", items: betterResponseItemSchema },
    finalAdvice: { type: "STRING" },
  },
};

/** Delivery coaching is generated by its own call, with its own schema. */
export const deliveryFeedbackSchema: GeminiSchema = {
  type: "OBJECT",
  required: ["deliveryFeedback"],
  properties: {
    deliveryFeedback: stringArraySchema,
  },
};

const customCriterionItemSchema: GeminiSchema = {
  type: "OBJECT",
  required: ["criterion", "assessment"],
  properties: {
    criterion: { type: "STRING" },
    assessment: { type: "STRING" },
  },
};

/**
 * The feedback report schema, optionally extended with the custom-criteria
 * section. When a trainer added custom criteria, the main report and the
 * custom-criteria assessments are produced by a SINGLE Gemini call using this
 * combined schema. One reasoning pass over the transcript yields both sections,
 * which is what structurally prevents them from reaching opposite verdicts about
 * the same behavior. With no custom criteria, this is just feedbackReportSchema.
 */
export function buildFeedbackReportSchema(customCriteriaCount: number): GeminiSchema {
  if (customCriteriaCount <= 0) {
    return feedbackReportSchema;
  }

  return {
    ...feedbackReportSchema,
    required: [...(feedbackReportSchema.required ?? []), "customCriteriaFeedback"],
    properties: {
      ...feedbackReportSchema.properties,
      customCriteriaFeedback: {
        type: "ARRAY",
        minItems: customCriteriaCount,
        maxItems: customCriteriaCount,
        items: customCriterionItemSchema,
      },
    },
  };
}
