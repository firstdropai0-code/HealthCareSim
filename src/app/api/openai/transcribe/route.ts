import { NextResponse } from "next/server";

import type { TranscribedWord } from "@/types/voice";

const TRANSCRIBE_TIMEOUT_MS = 30_000;

/**
 * whisper-1 rather than gpt-4o-transcribe: word-level timestamps require
 * response_format=verbose_json with timestamp_granularities, and those are only
 * supported on whisper-1. The delivery metrics (pace, pauses) depend on them.
 */
const DEFAULT_TRANSCRIBE_MODEL = "whisper-1";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return errorResponse("OPENAI_API_KEY is not configured.", 500);
  }

  let file: FormDataEntryValue | null;

  try {
    const formData = await request.formData();
    file = formData.get("file");
  } catch {
    return errorResponse("Request body must be multipart form data.");
  }

  if (!(file instanceof Blob) || file.size === 0) {
    return errorResponse("No audio file was provided.");
  }

  const model = process.env.OPENAI_TRANSCRIBE_MODEL || DEFAULT_TRANSCRIBE_MODEL;

  const upstreamForm = new FormData();
  const fileName = file instanceof File ? file.name : "audio.webm";
  upstreamForm.append("file", file, fileName);
  upstreamForm.append("model", model);

  // Only whisper-1 accepts verbose_json; asking for it on a gpt-4o-* transcribe
  // model is a hard 400. If the env var points elsewhere, fall back to plain
  // json and let the delivery metrics degrade to "no timings captured".
  const supportsWordTimestamps = model === "whisper-1";

  if (supportsWordTimestamps) {
    upstreamForm.append("response_format", "verbose_json");
    upstreamForm.append("timestamp_granularities[]", "word");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: upstreamForm,
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await parseOpenAiError(response);
      console.error(`OpenAI transcription failed (${response.status}): ${detail}`);
      return errorResponse("Transcription failed. Please try again.", 502);
    }

    const data = (await response.json()) as {
      text?: string;
      duration?: number;
      words?: { word?: unknown; start?: unknown; end?: unknown }[];
    };
    const text = typeof data.text === "string" ? data.text.trim() : "";

    return NextResponse.json({
      text,
      words: normalizeWords(data.words),
      ...(typeof data.duration === "number" ? { duration: data.duration } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return errorResponse("Transcription timed out. Please try a shorter clip.", 504);
    }

    console.error("OpenAI transcription request failed:", error);
    return errorResponse("Transcription failed. Please try again.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

/** Keep only well-formed word timings; a malformed entry is dropped, not guessed. */
function normalizeWords(value: unknown): TranscribedWord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is { word: string; start: number; end: number } =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as { word?: unknown }).word === "string" &&
        typeof (item as { start?: unknown }).start === "number" &&
        typeof (item as { end?: unknown }).end === "number",
    )
    .map((item) => ({ word: item.word, start: item.start, end: item.end }));
}

async function parseOpenAiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: { message?: string } };
    return data.error?.message || response.statusText;
  } catch {
    return response.statusText;
  }
}
