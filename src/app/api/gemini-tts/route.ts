import { NextResponse } from "next/server";
import {
  isRetryableGeminiStatus,
  parseCommaSeparatedModels,
  sleep,
  uniqueModels,
} from "@/lib/ai/geminiServer";
import type { ScenarioSpeaker, TensionLevel } from "@/types/simulation";

export const runtime = "nodejs";

const DEFAULT_TTS_MODEL = "gemini-3.1-flash-tts-preview";
const DEFAULT_TTS_FALLBACK_MODEL = "gemini-2.5-flash-preview-tts";
const DEFAULT_VOICE = "Kore";
const MAX_TEXT_LENGTH = 1500;
const TTS_TIMEOUT_MS = 25000;
const WAV_SAMPLE_RATE = 24000;
const WAV_CHANNELS = 1;
const WAV_BITS_PER_SAMPLE = 16;

type GeminiTtsRequest = {
  text?: unknown;
  voiceName?: unknown;
  style?: unknown;
  speaker?: unknown;
  tensionLevel?: unknown;
  patientEmotion?: unknown;
  familyEmotion?: unknown;
};

type GeminiTtsResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
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
  output_audio?: {
    data?: string;
    mime_type?: string;
    mimeType?: string;
  };
  outputAudio?: {
    data?: string;
    mimeType?: string;
    mime_type?: string;
  };
};

type GeminiAudioPayload = {
  base64Audio?: string;
  mimeType?: string;
};

type GeminiTtsError = Error & {
  status?: number;
  model?: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function sanitizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value
    .trim()
    .replace(/^(patient|family member|family_member|nurse|narrator|bystander):\s*/i, "")
    .trim();

  if (!trimmed || trimmed.length > MAX_TEXT_LENGTH) {
    return null;
  }

  return trimmed;
}

function sanitizeOptionalString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeSpeaker(value: unknown): ScenarioSpeaker | undefined {
  return value === "patient" ||
    value === "family_member" ||
    value === "nurse" ||
    value === "bystander" ||
    value === "narrator"
    ? value
    : undefined;
}

function normalizeTension(value: unknown): TensionLevel | undefined {
  return value === "low" || value === "medium" || value === "high" ? value : undefined;
}

function buildStyleInstruction(body: GeminiTtsRequest): string {
  const speaker = normalizeSpeaker(body.speaker);
  const tensionLevel = normalizeTension(body.tensionLevel);
  const customStyle = typeof body.style === "string" ? body.style.trim().replace(/\s+/g, " ") : "";
  const patientEmotion = typeof body.patientEmotion === "string" ? body.patientEmotion.trim() : "";
  const familyEmotion = typeof body.familyEmotion === "string" ? body.familyEmotion.trim() : "";

  if (customStyle) {
    return customStyle.slice(0, 180);
  }

  if (speaker === "patient" && tensionLevel === "high") {
    return `as an anxious but realistic patient${patientEmotion ? ` feeling ${patientEmotion}` : ""}, not theatrical`;
  }

  if (speaker === "family_member" && tensionLevel === "high") {
    return `as a worried and urgent family member${familyEmotion ? ` feeling ${familyEmotion}` : ""}`;
  }

  if (speaker === "nurse") {
    return "as a calm, professional nurse";
  }

  if (speaker === "narrator") {
    return "as a neutral, clear narrator";
  }

  if (speaker === "patient" && tensionLevel === "low") {
    return "as a calmer patient speaking a little slower";
  }

  if (speaker === "family_member") {
    return "as a concerned family member in a realistic healthcare roleplay";
  }

  return "as a realistic speaker in a healthcare communication training simulation";
}

function buildTtsInput(text: string, body: GeminiTtsRequest): string {
  return `Say ${buildStyleInstruction(body)}. Do not read speaker labels unless they are part of the message.\n${text}`;
}

function stripDataUrlPrefix(base64Audio: string): string {
  const commaIndex = base64Audio.indexOf(",");
  return base64Audio.startsWith("data:") && commaIndex !== -1
    ? base64Audio.slice(commaIndex + 1)
    : base64Audio;
}

function isWaveFile(audio: Buffer): boolean {
  return audio.length > 12 && audio.toString("ascii", 0, 4) === "RIFF";
}

function pcmToWav(pcm: Buffer): Buffer {
  const header = Buffer.alloc(44);
  const blockAlign = (WAV_CHANNELS * WAV_BITS_PER_SAMPLE) / 8;
  const byteRate = WAV_SAMPLE_RATE * blockAlign;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(WAV_CHANNELS, 22);
  header.writeUInt32LE(WAV_SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(WAV_BITS_PER_SAMPLE, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

function getAudioPayload(data: GeminiTtsResponse): GeminiAudioPayload {
  const inlinePart = data.candidates
    ?.flatMap((candidate) => candidate.content?.parts || [])
    .find((part) => part.inlineData?.data || part.inline_data?.data);
  const outputAudio = data.output_audio || data.outputAudio;

  return {
    base64Audio:
      inlinePart?.inlineData?.data || inlinePart?.inline_data?.data || outputAudio?.data,
    mimeType:
      inlinePart?.inlineData?.mimeType ||
      inlinePart?.inline_data?.mime_type ||
      outputAudio?.mime_type ||
      outputAudio?.mimeType,
  };
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

async function fetchTtsFromModel(
  model: string,
  apiKey: string,
  text: string,
  voiceName: string,
  body: GeminiTtsRequest,
): Promise<GeminiAudioPayload> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
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
            parts: [{ text: buildTtsInput(text, body) }],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await parseGeminiError(response);
      const error = new Error(
        `Gemini TTS request failed (${response.status}) on ${model}: ${detail}`,
      ) as GeminiTtsError;
      error.status = response.status;
      error.model = model;
      throw error;
    }

    return getAudioPayload((await response.json()) as GeminiTtsResponse);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      const timeoutError = new Error(`Gemini TTS request timed out on ${model}.`) as GeminiTtsError;
      timeoutError.status = 504;
      timeoutError.model = model;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function generateTtsAudio(
  apiKey: string,
  text: string,
  voiceName: string,
  body: GeminiTtsRequest,
): Promise<GeminiAudioPayload> {
  const models = uniqueModels([
    process.env.GEMINI_TTS_MODEL || DEFAULT_TTS_MODEL,
    ...parseCommaSeparatedModels(process.env.GEMINI_TTS_FALLBACK_MODELS),
    DEFAULT_TTS_FALLBACK_MODEL,
  ]);
  const errors: string[] = [];

  for (const [index, model] of models.entries()) {
    try {
      const audio = await fetchTtsFromModel(model, apiKey, text, voiceName, body);

      if (audio.base64Audio) {
        return audio;
      }

      errors.push(`Gemini TTS response from ${model} did not include audio.`);
    } catch (error) {
      const ttsError = error as GeminiTtsError;
      errors.push(ttsError.message);

      if (!isRetryableGeminiStatus(ttsError.status)) {
        throw error;
      }
    }

    if (index < models.length - 1) {
      await sleep(250 * 2 ** index);
    }
  }

  throw new Error(errors.at(-1) || "Gemini TTS response did not include audio.");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GeminiTtsRequest;
    const text = sanitizeText(body.text);

    if (!text) {
      return jsonError(`Text is required and must be ${MAX_TEXT_LENGTH} characters or fewer.`);
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return jsonError("GEMINI_API_KEY is not configured.", 500);
    }

    const voiceName = sanitizeOptionalString(body.voiceName, DEFAULT_VOICE);
    const { base64Audio, mimeType } = await generateTtsAudio(apiKey, text, voiceName, body);

    if (!base64Audio) {
      return jsonError("Gemini TTS response did not include audio.", 502);
    }

    const audio = Buffer.from(stripDataUrlPrefix(base64Audio), "base64");
    const wavAudio =
      isWaveFile(audio) || mimeType?.toLowerCase().includes("wav") ? audio : pcmToWav(audio);
    const audioBody = new Uint8Array(wavAudio.byteLength);
    audioBody.set(wavAudio);

    return new Response(audioBody, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof SyntaxError
        ? "Request body must be valid JSON."
        : error instanceof Error
          ? error.message
          : "Gemini TTS failed. Please try again.";

    return jsonError(message, message.includes("GEMINI_API_KEY") ? 500 : 502);
  }
}
