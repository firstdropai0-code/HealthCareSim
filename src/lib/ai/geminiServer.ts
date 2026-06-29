import type { GeminiSchema } from "./geminiSchemas";

export class InvalidJsonResponseError extends Error {
  constructor(message = "AI returned an unreadable response. Please try again.") {
    super(message);
    this.name = "InvalidJsonResponseError";
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

export function isInvalidJsonResponse(error: unknown): error is InvalidJsonResponseError {
  return error instanceof InvalidJsonResponseError;
}

export function isRetryableGeminiStatus(status?: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
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
    ? [{ text: promptOverride }]
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

export async function callGeminiJson(options: GeminiCallOptions): Promise<unknown> {
  const models = uniqueModels(options.models);
  const errors: string[] = [];
  let sawInvalidJson = false;

  for (const [index, model] of models.entries()) {
    try {
      return await callGeminiModel(options, model);
    } catch (error) {
      const geminiError = error as GeminiHttpError;
      errors.push(geminiError.message);

      if (isInvalidJsonResponse(error)) {
        sawInvalidJson = true;

        if (options.retryInvalidJson !== false) {
          try {
            return await callGeminiModel(options, model, buildStrictJsonRetryPrompt(options.prompt));
          } catch (retryError) {
            const retryGeminiError = retryError as GeminiHttpError;
            errors.push(retryGeminiError.message);

            if (isInvalidJsonResponse(retryError)) {
              sawInvalidJson = true;
              continue;
            }

            if (!isRetryableGeminiStatus(retryGeminiError.status)) {
              throw retryError;
            }
          }
        }

        continue;
      }

      if (!isRetryableGeminiStatus(geminiError.status)) {
        throw error;
      }

      if (index < models.length - 1) {
        await sleep(250 * 2 ** index);
      }
    }
  }

  if (sawInvalidJson) {
    throw new InvalidJsonResponseError(
      "AI returned an unreadable response after retrying. Please try a shorter input.",
    );
  }

  throw new Error(
    `All Gemini ${options.action} models are currently unavailable. Last error: ${
      errors.at(-1) || "unknown error"
    }`,
  );
}
