import { NextResponse } from "next/server";
import { voiceTranscriptionSchema } from "@/lib/ai/geminiSchemas";
import { buildModelList, callGeminiJson, isInvalidJsonResponse } from "@/lib/ai/geminiServer";
import type { VoiceTranscriptionResult } from "@/types/voice";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const TRANSCRIPTION_MODELS = buildModelList(process.env.GEMINI_STT_MODEL || "gemini-3.5-flash", []);

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

function normalizeTranscription(value: unknown): VoiceTranscriptionResult {
  const result = value as Partial<VoiceTranscriptionResult>;
  const emotionValues: VoiceTranscriptionResult["emotionEstimate"][] = [
    "calm",
    "anxious",
    "angry",
    "sad",
    "confused",
    "neutral",
    "unknown",
  ];
  const paceValues: VoiceTranscriptionResult["paceEstimate"][] = ["slow", "normal", "fast", "unknown"];
  const clarityValues: VoiceTranscriptionResult["clarityEstimate"][] = [
    "clear",
    "mixed",
    "unclear",
    "unknown",
  ];
  const confidenceValues: VoiceTranscriptionResult["confidence"][] = ["low", "medium", "high"];
  const emotionEstimate: VoiceTranscriptionResult["emotionEstimate"] =
    result.emotionEstimate && emotionValues.includes(result.emotionEstimate)
      ? result.emotionEstimate
      : "unknown";
  const paceEstimate: VoiceTranscriptionResult["paceEstimate"] =
    result.paceEstimate && paceValues.includes(result.paceEstimate)
      ? result.paceEstimate
      : "unknown";
  const clarityEstimate: VoiceTranscriptionResult["clarityEstimate"] =
    result.clarityEstimate && clarityValues.includes(result.clarityEstimate)
      ? result.clarityEstimate
      : "unknown";
  const confidence: VoiceTranscriptionResult["confidence"] =
    result.confidence && confidenceValues.includes(result.confidence) ? result.confidence : "low";

  return {
    transcript: normalizeString(result.transcript, ""),
    emotionEstimate,
    paceEstimate,
    clarityEstimate,
    confidence,
  };
}

function buildTranscriptionPrompt(purpose: TranscriptionPurpose, context: string): string {
  return `Transcribe this trainee audio for a healthcare communication training simulation.

Purpose: ${purpose}
Context: ${context || "No extra context provided."}

Rules:
- Return only the trainee's spoken words as the transcript.
- Clean filler words only lightly.
- Do not rewrite the user's meaning.
- Do not invent content.
- If unclear, return the best transcript and low confidence.
- Estimate emotion, pace, clarity, and confidence from the audio.
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
    const context = typeof contextValue === "string" ? contextValue.trim().slice(0, 1200) : "";

    if (!(audio instanceof File)) {
      return jsonError("Audio file is required.");
    }

    if (!purpose) {
      return jsonError('Purpose must be "scenario" or "simulation".');
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      return jsonError("Audio is too large. Record a shorter clip under 20 MB.", 413);
    }

    if (audio.size === 0) {
      return jsonError("Audio recording was empty. Please try again.");
    }

    const mimeType = audio.type || "audio/webm";
    const prompt = buildTranscriptionPrompt(purpose, context);
    const result = await callGeminiJson({
      action: "transcription",
      prompt,
      models: TRANSCRIPTION_MODELS,
      temperature: 0.15,
      maxOutputTokens: 500,
      timeoutMs: 30000,
      schema: voiceTranscriptionSchema,
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

    return NextResponse.json({ result: normalizeTranscription(result) });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("GEMINI_API_KEY")
        ? "GEMINI_API_KEY is not configured."
        : isInvalidJsonResponse(error)
          ? "Gemini could not transcribe the audio. Please try again or type your response."
          : "Gemini could not transcribe the audio. Please try again or type your response.";

    return jsonError(message, message.includes("GEMINI_API_KEY") ? 500 : 502);
  }
}
