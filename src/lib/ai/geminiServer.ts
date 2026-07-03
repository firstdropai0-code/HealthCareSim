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

export type GeminiServerAction = "scenario" | "nextTurn" | "feedback";

type GeminiCallOptions = {
  action: GeminiServerAction;
  prompt: string;
  models: string[];
  temperature: number;
  maxOutputTokens?: number;
  timeoutMs: number;
  schema?: GeminiSchema;
  retryInvalidJson?: boolean;
};

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

export type GeminiHttpError = Error & {
  status?: number;
  model?: string;
};

const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);
const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_RETRY_BASE_MS = 800;
const RETRY_JITTER_MS = 400;

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

  return isRetryableGeminiStatus(geminiError.status);
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

function getRetryConfig(): { maxAttempts: number; baseDelayMs: number } {
  const configuredAttempts = parsePositiveInteger(process.env.AI_MAX_RETRIES, DEFAULT_MAX_ATTEMPTS);

  return {
    maxAttempts: Math.min(configuredAttempts, DEFAULT_MAX_ATTEMPTS),
    baseDelayMs: parsePositiveInteger(process.env.AI_RETRY_BASE_MS, DEFAULT_RETRY_BASE_MS),
  };
}

function getRetryDelayMs(attempt: number, baseDelayMs: number): number {
  return baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * (RETRY_JITTER_MS + 1));
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
            parts: [{ text: promptOverride || options.prompt }],
          },
        ],
        generationConfig: {
          temperature: options.temperature,
          ...(options.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
          responseMimeType: "application/json",
          ...(options.schema ? { responseSchema: options.schema } : {}),
          thinkingConfig: { thinkingBudget: 0 },
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
  const { maxAttempts, baseDelayMs } = getRetryConfig();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await callGeminiModel(options, model, promptOverride);
    } catch (error) {
      if (!isTransientGeminiError(error) || attempt === maxAttempts) {
        throw error;
      }

      await sleep(getRetryDelayMs(attempt, baseDelayMs));
    }
  }

  throw new Error(`Gemini ${options.action} request failed on ${model}.`);
}

export async function callGeminiJson(options: GeminiCallOptions): Promise<unknown> {
  const model = options.models[0]?.trim();

  if (!model) {
    throw new Error(`Gemini ${options.action} request is missing a model.`);
  }

  try {
    return await callModelWithTransientRetries(options, model);
  } catch (error) {
    if (isInvalidJsonResponse(error)) {
      if (options.retryInvalidJson === false) {
        throw error;
      }

      try {
        return await callModelWithTransientRetries(
          options,
          model,
          buildStrictJsonRetryPrompt(options.prompt),
        );
      } catch (retryError) {
        if (isInvalidJsonResponse(retryError)) {
          throw new InvalidJsonResponseError(
            "AI returned an unreadable response after retrying. Please try a shorter input.",
          );
        }

        if (isTransientGeminiError(retryError)) {
          throw new GeminiCapacityError();
        }

        throw retryError;
      }
    }

    if (isTransientGeminiError(error)) {
      throw new GeminiCapacityError();
    }

    throw error;
  }
}
