import { NextResponse } from "next/server";
import { voicePartialTranscriptionSchema } from "@/lib/ai/geminiSchemas";
import { buildModelList, callGeminiJson, isInvalidJsonResponse } from "@/lib/ai/geminiServer";
import type { VoicePartialTranscriptionResult } from "@/types/voice";

export const runtime = "nodejs";

const MAX_CHUNK_BYTES = 5 * 1024 * 1024;
const CHUNK_TRANSCRIPTION_MODELS = buildModelList(process.env.GEMINI_STT_MODEL || "gemini-3.5-flash", []);

type TranscriptionPurpose = "scenario" | "simulation";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function normalizePurpose(value: FormDataEntryValue | null): TranscriptionPurpose | null {
  return value === "scenario" || value === "simulation" ? value : null;
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizePartialTranscription(value: unknown): VoicePartialTranscriptionResult {
  const result = value as Partial<VoicePartialTranscriptionResult>;
  const confidenceValues: VoicePartialTranscriptionResult["confidence"][] = ["low", "medium", "high"];
  const confidence: VoicePartialTranscriptionResult["confidence"] =
    result.confidence && confidenceValues.includes(result.confidence) ? result.confidence : "low";
  const partialTranscript = normalizeString(result.partialTranscript, "");

  return {
    partialTranscript,
    isUseful: Boolean(result.isUseful && partialTranscript),
    confidence,
  };
}

function buildChunkPrompt(purpose: TranscriptionPurpose, context: string, previousTranscript: string): string {
  return `Transcribe this short live audio chunk for a healthcare communication training simulation.

Purpose: ${purpose}
Context: ${context || "No extra context provided."}
Previous Gemini transcript: ${previousTranscript || "None yet."}

Rules:
- Return only newly heard trainee speech from this audio chunk when possible.
- If the chunk overlaps previous transcript, omit repeated words when possible.
- Do not invent missing words.
- If the chunk is silence, unclear, or only noise, return partialTranscript as an empty string and isUseful false.
- Clean filler words only lightly.
- Do not provide diagnosis, medication advice, treatment instructions, triage advice, or clinical decision-making.
- Return valid JSON matching the requested schema.`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");
    const purpose = normalizePurpose(formData.get("purpose"));
    const contextValue = formData.get("context");
    const previousTranscriptValue = formData.get("previousTranscript");
    const context = typeof contextValue === "string" ? contextValue.trim().slice(0, 1200) : "";
    const previousTranscript =
      typeof previousTranscriptValue === "string" ? previousTranscriptValue.trim().slice(0, 2000) : "";

    if (!(audio instanceof File)) {
      return jsonError("Audio chunk is required.");
    }

    if (!purpose) {
      return jsonError('Purpose must be "scenario" or "simulation".');
    }

    if (audio.size > MAX_CHUNK_BYTES) {
      return jsonError("Audio chunk is too large. Try again with a shorter recording window.", 413);
    }

    if (audio.size === 0) {
      return jsonError("Audio chunk was empty.");
    }

    const mimeType = audio.type || "audio/webm";
    const prompt = buildChunkPrompt(purpose, context, previousTranscript);
    const result = await callGeminiJson({
      action: "transcription",
      prompt,
      models: CHUNK_TRANSCRIPTION_MODELS,
      temperature: 0.1,
      maxOutputTokens: 180,
      timeoutMs: 20000,
      schema: voicePartialTranscriptionSchema,
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType,
            data: arrayBufferToBase64(await audio.arrayBuffer()),
          },
        },
      ],
    });

    return NextResponse.json(normalizePartialTranscription(result));
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("GEMINI_API_KEY")
        ? "GEMINI_API_KEY is not configured."
        : isInvalidJsonResponse(error)
          ? "Gemini could not update live captions yet."
          : "Gemini could not update live captions yet.";

    return jsonError(message, message.includes("GEMINI_API_KEY") ? 500 : 502);
  }
}
