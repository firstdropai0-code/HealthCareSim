import { NextResponse } from "next/server";

const TRANSCRIBE_TIMEOUT_MS = 30_000;
const DEFAULT_TRANSCRIBE_MODEL = "gpt-4o-transcribe";

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

    const data = (await response.json()) as { text?: string };
    const text = typeof data.text === "string" ? data.text.trim() : "";

    return NextResponse.json({ text });
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

async function parseOpenAiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: { message?: string } };
    return data.error?.message || response.statusText;
  } catch {
    return response.statusText;
  }
}
