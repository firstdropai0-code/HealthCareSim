import type { GeminiSchema } from "./geminiSchemas";

export class InvalidJsonResponseError extends Error {
  constructor(message = "AI returned an unreadable response. Please try again.") {
    super(message);
    this.name = "InvalidJsonResponseError";
  }
}

export class GeminiCapacityError extends Error {
  status = 503;

  constructor(message = "The simulator is busy right now - please retry in a moment.") {
    super(message);
    this.name = "GeminiCapacityError";
  }
}

export type GeminiServerAction = "scenario" | "nextTurn" | "feedback" | "transcription" | "tts";

export type GeminiContentPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GeminiCallOptions = {
  action: GeminiServerAction;
  prompt: string;
  models: string[];
  temperature: number;
  maxOutputTokens?: number;
  timeoutMs: number;
  schema?: GeminiSchema;
  parts?: GeminiContentPart[];
  retryInvalidJson?: boolean;
};

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          data?: string;
          mimeType?: string;
        };
        inline_data?: {
          data?: string;
          mime_type?: string;
        };
      }>;
    };
  }>;
};

export type GeminiHttpError = Error & {
  status?: number;
  model?: string;
};

const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);
const TRANSIENT_MESSAGE_PATTERNS = ["overloaded", "high demand", "unavailable"];
const FALLBACK_ELIGIBLE_MESSAGE_PATTERNS = [
  "not found",
  "not supported",
  "unsupported",
  "not enabled",
  "not available",
  "modality",
  "responsemodalities",
  "response modality",
  "responsemime",
  "response mime",
  "responseschema",
  "response schema",
  "schema",
];
const DEFAULT_MAX_SAME_MODEL_RETRIES = 3;
const DEFAULT_RETRY_BASE_MS = 800;
const RETRY_JITTER_MS = 400;
const MODEL_COOLDOWN_MS = 30_000;
const modelCooldowns = new Map<string, number>();

export function isInvalidJsonResponse(error: unknown): error is InvalidJsonResponseError {
  return error instanceof InvalidJsonResponseError;
}

export function isGeminiCapacityError(error: unknown): error is GeminiCapacityError {
  return error instanceof GeminiCapacityError;
}

export function isRetryableGeminiStatus(status?: number): boolean {
  return status !== undefined && TRANSIENT_STATUSES.has(status);
}

export function isTransientGeminiError(error: unknown): boolean {
  const geminiError = error as GeminiHttpError;
  const message = getErrorMessage(error).toLowerCase();

  return (
    isRetryableGeminiStatus(geminiError.status) ||
    TRANSIENT_MESSAGE_PATTERNS.some((pattern) => message.includes(pattern))
  );
}

export function uniqueModels(models: Array<string | undefined>): string[] {
  return Array.from(new Set(models.map((model) => model?.trim()).filter(Boolean) as string[]));
}

export function extractJson(text: string): unknown {
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
      throw new InvalidJsonResponseError();
    }

    try {
      return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
    } catch {
      throw new InvalidJsonResponseError();
    }
  }
}

export function buildStrictJsonRetryPrompt(prompt: string): string {
  return `${prompt}

Your previous response was not parseable JSON.
Return exactly one valid JSON object and nothing else.
Do not use markdown fences, comments, trailing commas, undefined, or explanatory text.
Use double quotes for every JSON key and string value.`;
}

export function buildModelList(
  primary: string | undefined,
  fallbackModels: string[],
  legacyFallback = process.env.GEMINI_MODEL,
): string[] {
  return uniqueModels([primary, ...fallbackModels, legacyFallback]);
}

export function parseCommaSeparatedModels(value: string | undefined): string[] {
  return value
    ? value
        .split(",")
        .map((model) => model.trim())
        .filter(Boolean)
    : [];
}

export async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getRetryConfig(): { maxSameModelRetries: number; baseDelayMs: number } {
  return {
    maxSameModelRetries: parsePositiveInteger(
      process.env.AI_MAX_RETRIES,
      DEFAULT_MAX_SAME_MODEL_RETRIES,
    ),
    baseDelayMs: parsePositiveInteger(process.env.AI_RETRY_BASE_MS, DEFAULT_RETRY_BASE_MS),
  };
}

function getRetryDelayMs(attempt: number, baseDelayMs: number): number {
  return baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * (RETRY_JITTER_MS + 1));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

function markModelSuccess(model: string): void {
  modelCooldowns.delete(model);
}

function markSoftFailure(model: string): void {
  modelCooldowns.set(model, Date.now() + MODEL_COOLDOWN_MS);
}

function selectAttemptModels(models: string[]): string[] {
  const unique = uniqueModels(models);
  const now = Date.now();
  const available = unique.filter((model) => (modelCooldowns.get(model) || 0) <= now);

  return available.length ? available : unique;
}

function isFallbackEligibleGeminiError(error: unknown): boolean {
  const geminiError = error as GeminiHttpError;
  const message = getErrorMessage(error).toLowerCase();

  if (geminiError.status === 404 || geminiError.status === 501) {
    return true;
  }

  if (geminiError.status !== 400 && geminiError.status !== 422) {
    return false;
  }

  return FALLBACK_ELIGIBLE_MESSAGE_PATTERNS.some((pattern) => message.includes(pattern));
}

async function parseGeminiError(response: Response): Promise<string> {
  try {
    const errorData = (await response.json()) as {
      error?: { message?: string; status?: string };
    };
    return errorData.error?.message || errorData.error?.status || response.statusText;
  } catch {
    return response.statusText;
  }
}

function getText(data: GeminiGenerateResponse): string | undefined {
  return data.candidates
    ?.flatMap((candidate) => candidate.content?.parts || [])
    .find((part) => part.text)?.text;
}

async function callGeminiModel(
  options: GeminiCallOptions,
  model: string,
  promptOverride?: string,
): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const parts = promptOverride
    ? options.parts?.length
      ? options.parts.map((part) => ("text" in part ? { text: promptOverride } : part))
      : [{ text: promptOverride }]
    : options.parts || [{ text: options.prompt }];

  try {
    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts,
          },
        ],
        generationConfig: {
          temperature: options.temperature,
          ...(options.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
          responseMimeType: "application/json",
          ...(options.schema ? { responseSchema: options.schema } : {}),
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await parseGeminiError(response);
      const geminiError = new Error(
        `Gemini ${options.action} request failed (${response.status}) on ${model}${detail ? `: ${detail}` : "."}`,
      ) as GeminiHttpError;
      geminiError.status = response.status;
      geminiError.model = model;
      throw geminiError;
    }

    const data = (await response.json()) as GeminiGenerateResponse;
    const text = getText(data);

    if (!text) {
      throw new InvalidJsonResponseError("Gemini returned an empty response. Please try again.");
    }

    return extractJson(text);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      const timeoutError = new Error(
        `Gemini ${options.action} request timed out on ${model}.`,
      ) as GeminiHttpError;
      timeoutError.status = 504;
      timeoutError.model = model;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function callModelWithTransientRetries(
  options: GeminiCallOptions,
  model: string,
  promptOverride?: string,
): Promise<unknown> {
  const { maxSameModelRetries, baseDelayMs } = getRetryConfig();

  for (let attempt = 1; attempt <= maxSameModelRetries; attempt += 1) {
    try {
      return await callGeminiModel(options, model, promptOverride);
    } catch (error) {
      if (!isTransientGeminiError(error) || attempt === maxSameModelRetries) {
        throw error;
      }

      await sleep(getRetryDelayMs(attempt, baseDelayMs));
    }
  }

  throw new Error(`Gemini ${options.action} request failed on ${model}.`);
}

export async function callGeminiJson(options: GeminiCallOptions): Promise<unknown> {
  const models = selectAttemptModels(options.models);
  const errors: string[] = [];
  let sawInvalidJson = false;
  let sawCapacityError = false;
  let lastError: unknown;

  for (const model of models) {
    try {
      const result = await callModelWithTransientRetries(options, model);
      markModelSuccess(model);
      return result;
    } catch (error) {
      lastError = error;
      errors.push(getErrorMessage(error));

      if (isInvalidJsonResponse(error)) {
        sawInvalidJson = true;

        if (options.retryInvalidJson !== false) {
          try {
            const result = await callModelWithTransientRetries(
              options,
              model,
              buildStrictJsonRetryPrompt(options.prompt),
            );
            markModelSuccess(model);
            return result;
          } catch (retryError) {
            lastError = retryError;
            errors.push(getErrorMessage(retryError));

            if (isInvalidJsonResponse(retryError)) {
              sawInvalidJson = true;
              continue;
            }

            if (isTransientGeminiError(retryError)) {
              sawCapacityError = true;
              markSoftFailure(model);
              continue;
            }

            if (isFallbackEligibleGeminiError(retryError)) {
              continue;
            }

            throw retryError;
          }
        }

        continue;
      }

      if (isTransientGeminiError(error)) {
        sawCapacityError = true;
        markSoftFailure(model);
        continue;
      }

      if (isFallbackEligibleGeminiError(error)) {
        continue;
      }

      throw error;
    }
  }

  if (sawInvalidJson) {
    throw new InvalidJsonResponseError(
      "AI returned an unreadable response after retrying. Please try a shorter input.",
    );
  }

  if (sawCapacityError) {
    throw new GeminiCapacityError();
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(`Gemini ${options.action} request failed. Last error: ${errors.at(-1) || "unknown error"}`);
}
