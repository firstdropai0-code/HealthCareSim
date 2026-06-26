import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_TTS_MODEL = "gemini-3.1-flash-tts-preview";
const DEFAULT_VOICE = "Kore";
const MAX_TEXT_LENGTH = 1500;
const WAV_SAMPLE_RATE = 24000;
const WAV_CHANNELS = 1;
const WAV_BITS_PER_SAMPLE = 16;

type GeminiTtsRequest = {
  text?: unknown;
  voiceName?: unknown;
  style?: unknown;
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

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function sanitizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

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

function buildTtsInput(text: string, style: unknown): string {
  if (typeof style !== "string") {
    return text;
  }

  const trimmedStyle = style.trim().replace(/\s+/g, " ").slice(0, 160);

  if (!trimmedStyle) {
    return text;
  }

  return `Say ${trimmedStyle}:\n${text}`;
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

function getAudioPayload(data: GeminiTtsResponse): {
  base64Audio?: string;
  mimeType?: string;
} {
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

    const model = process.env.GEMINI_TTS_MODEL || DEFAULT_TTS_MODEL;
    const voiceName = sanitizeOptionalString(body.voiceName, DEFAULT_VOICE);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildTtsInput(text, body.style) }],
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
    });

    if (!response.ok) {
      const detail = await parseGeminiError(response);
      return jsonError(`Gemini TTS request failed (${response.status}): ${detail}`, 502);
    }

    const data = (await response.json()) as GeminiTtsResponse;
    const { base64Audio, mimeType } = getAudioPayload(data);

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

    return jsonError(message, 500);
  }
}
