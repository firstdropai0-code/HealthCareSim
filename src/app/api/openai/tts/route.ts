import { NextResponse } from "next/server";

import {
  applyAudioTags,
  keepAllowedTags,
  elevenLabsVoiceSettings,
  resolveElevenLabsVoice,
} from "@/lib/ai/elevenLabsVoice";
import type { Intensity } from "@/lib/ai/voiceDirection";

const TTS_TIMEOUT_MS = 30_000;
const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_TTS_VOICE = "alloy";
const MAX_TTS_INPUT_LENGTH = 4096;

/**
 * ElevenLabs' v3 family caps a single request at 5,000 characters, so the
 * existing 4,096 cap already clears it. Scenario messages are capped under 55
 * words by the simulation prompt, so neither limit is reachable in practice --
 * they are both there to stop a malformed turn becoming a large bill.
 */
const DEFAULT_ELEVENLABS_MODEL = "eleven_v3";

/**
 * 128 kbps is the ceiling on Starter; 192 needs Creator. Overridable so the
 * bitrate can be raised without a deploy if the listening test comes back close
 * enough that audio quality is worth ruling out as a confound.
 */
const DEFAULT_ELEVENLABS_FORMAT = "mp3_44100_128";

const INTENSITIES: Intensity[] = ["low", "medium", "high"];

type TtsRequestBody = {
  text?: string;
  voice?: string;
  instructions?: string;
  /**
   * Delivery rank for the line, resolved client-side from the same inputs that
   * build the OpenAI prose instruction. ElevenLabs takes numeric settings rather
   * than prose, and both providers must rank a line identically or the A/B
   * measures the mapping instead of the model.
   */
  intensity?: string;
  /** Raw per-line stage direction, used only for optional audio tags. */
  delivery?: string;
  /** The line with its audio tags intact. Ignored by providers that cannot perform them. */
  spokenText?: string;
};

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isIntensity(value: unknown): value is Intensity {
  return typeof value === "string" && INTENSITIES.includes(value as Intensity);
}

export async function POST(request: Request) {
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

  const provider = process.env.TTS_PROVIDER === "elevenlabs" ? "elevenlabs" : "openai";
  const started = Date.now();

  let result =
    provider === "elevenlabs"
      ? await speakWithElevenLabs(body, text)
      : await speakWithOpenAi(body, text);

  // Falling back matters most at exactly the moment it is least convenient: the
  // month's credits run out mid-cohort, and without this every trainee loses
  // read-aloud entirely rather than dropping to the older voice. OpenAI is
  // already configured, already paid for, and was the product's voice until
  // recently -- a quieter performance beats silence.
  let fellBack = false;

  if (!result.ok && provider === "elevenlabs" && process.env.OPENAI_API_KEY) {
    const fallback = await speakWithOpenAi(body, text);

    if (fallback.ok) {
      console.warn("[tts] ElevenLabs failed; served OpenAI audio instead.");
      result = fallback;
      fellBack = true;
    }
  }

  // The kill criterion, measured rather than assumed. AUDIO_WAIT_TIMEOUT_MS in
  // the simulation page is 2,500ms: past that a turn stops waiting and types
  // itself out, losing the audio-synced reveal. A provider that sounds better
  // but regularly overruns this is a downgrade, so the number has to be visible
  // from the first request rather than inferred from a vendor latency figure --
  // that figure is model time-to-first-byte, while this route buffers the whole
  // clip before responding.
  if (result.ok) {
    console.info(
      `[tts] provider=${fellBack ? "openai(fallback)" : provider} ` +
        `chars=${text.length} ms=${Date.now() - started}`,
    );
  }

  return result.response;
}

type TtsResult = { ok: boolean; response: NextResponse };

async function speakWithOpenAi(body: TtsRequestBody, text: string): Promise<TtsResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return { ok: false, response: errorResponse("OPENAI_API_KEY is not configured.", 500) };
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

  return requestAudio({
    url: "https://api.openai.com/v1/audio/speech",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    payload,
    label: "OpenAI speech",
  });
}

async function speakWithElevenLabs(body: TtsRequestBody, text: string): Promise<TtsResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return { ok: false, response: errorResponse("ELEVENLABS_API_KEY is not configured.", 500) };
  }

  const format = process.env.ELEVENLABS_OUTPUT_FORMAT || DEFAULT_ELEVENLABS_FORMAT;
  const { voiceId, model: castModel } = resolveElevenLabsVoice(body.voice);
  // The cast entry wins: a voice pinned to a model was pinned because it only
  // sounds right on that one. The env var is the default for everything else.
  const model = castModel || process.env.ELEVENLABS_MODEL || DEFAULT_ELEVENLABS_MODEL;

  // An unrankable line falls to medium, matching buildVoiceInstructions()'s own
  // assumption that unrecognised wording means there is real feeling in the
  // scene rather than none.
  const intensity: Intensity = isIntensity(body.intensity) ? body.intensity : "medium";

  // Prefer the tagged line when the model wrote one. applyAudioTags() is the
  // fallback for lines with no inline tags: it derives a single tag from the
  // stage direction and puts it at the front, which is coarser but better than
  // nothing. OpenAI never sees either form -- it would read the brackets out.
  const tagsOn = process.env.ELEVENLABS_AUDIO_TAGS === "1";
  const spoken =
    tagsOn && typeof body.spokenText === "string" && body.spokenText.trim()
      ? keepAllowedTags(body.spokenText.trim())
      : applyAudioTags(text, body.delivery);

  const payload: Record<string, unknown> = {
    text: spoken.slice(0, MAX_TTS_INPUT_LENGTH),
    model_id: model,
    voice_settings: elevenLabsVoiceSettings(intensity),
  };

  return requestAudio({
    url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${encodeURIComponent(format)}`,
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    payload,
    label: "ElevenLabs speech",
  });
}

/**
 * Shared transport. Both providers return raw mp3 bytes on success and a JSON
 * error envelope on failure, so everything from the timeout to the response
 * shape is common -- only the URL, auth header and payload differ.
 */
async function requestAudio({
  url,
  headers,
  payload,
  label,
}: {
  url: string;
  headers: Record<string, string>;
  payload: Record<string, unknown>;
  label: string;
}): Promise<TtsResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await parseProviderError(response);
      console.error(`${label} failed (${response.status}): ${detail}`);
      return {
        ok: false,
        response: errorResponse("Could not generate audio. Please try again.", 502),
      };
    }

    const audio = await response.arrayBuffer();

    return {
      ok: true,
      response: new NextResponse(audio, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
        },
      }),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        ok: false,
        response: errorResponse("Audio generation timed out. Please try again.", 504),
      };
    }

    console.error(`${label} request failed:`, error);
    return {
      ok: false,
      response: errorResponse("Could not generate audio. Please try again.", 502),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function parseProviderError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: { message?: string };
      detail?: { message?: string } | string;
    };

    if (data.error?.message) {
      return data.error.message;
    }

    // ElevenLabs reports failures under `detail`, either as a string or as an
    // object carrying the message.
    if (typeof data.detail === "string") {
      return data.detail;
    }

    return data.detail?.message || response.statusText;
  } catch {
    return response.statusText;
  }
}
