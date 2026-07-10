import { NextResponse } from "next/server";

const TTS_TIMEOUT_MS = 30_000;
const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_TTS_VOICE = "alloy";
const MAX_TTS_INPUT_LENGTH = 4096;

type TtsRequestBody = {
  text?: string;
  voice?: string;
  instructions?: string;
};

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return errorResponse("OPENAI_API_KEY is not configured.", 500);
  }

  let body: TtsRequestBody;

  try {
    body = (await request.json()) as TtsRequestBody;
  } catch {
    return errorResponse("Request body must be valid JSON.");
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!text) {
    return errorResponse("No text was provided to read aloud.");
  }

  const model = process.env.OPENAI_TTS_MODEL || DEFAULT_TTS_MODEL;
  const voice = body.voice || process.env.OPENAI_TTS_VOICE || DEFAULT_TTS_VOICE;

  const payload: Record<string, unknown> = {
    model,
    voice,
    input: text.slice(0, MAX_TTS_INPUT_LENGTH),
    response_format: "mp3",
  };

  if (typeof body.instructions === "string" && body.instructions.trim()) {
    payload.instructions = body.instructions.trim();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await parseOpenAiError(response);
      console.error(`OpenAI speech failed (${response.status}): ${detail}`);
      return errorResponse("Could not generate audio. Please try again.", 502);
    }

    const audio = await response.arrayBuffer();

    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return errorResponse("Audio generation timed out. Please try again.", 504);
    }

    console.error("OpenAI speech request failed:", error);
    return errorResponse("Could not generate audio. Please try again.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

async function parseOpenAiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: { message?: string } };
    return data.error?.message || response.statusText;
  } catch {
    return response.statusText;
  }
}
