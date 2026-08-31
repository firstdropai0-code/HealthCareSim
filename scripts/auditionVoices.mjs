/**
 * Voice audition + latency probe for the ElevenLabs pilot.
 *
 * Does the two things that have to happen before anyone can judge the swap:
 *
 *  1. Renders the same line through every candidate voice, so the cast can be
 *     picked by ear rather than from a name in a dropdown.
 *  2. Times each request end to end. That number is the one that matters --
 *     AUDIO_WAIT_TIMEOUT_MS in the simulation page is 2,500ms, and past it a
 *     turn stops waiting for audio and types itself out, losing the synced
 *     reveal. The vendor's ~280ms figure is model time-to-first-byte and does
 *     not include our route, the round trip from here, or generating the rest
 *     of the clip.
 *
 * Usage:
 *   node scripts/auditionVoices.mjs                 # list voices, audition defaults
 *   node scripts/auditionVoices.mjs <id> <id> ...   # audition specific voice ids
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT_DIR = join("scratch", "voice-audition");

/**
 * Deliberately not a neutral pangram. The whole question is whether a voice can
 * carry distress in a hospital corridor, and a calm demo line cannot answer it.
 */
const TEST_LINES = [
  {
    name: "high",
    intensity: "high",
    text: "Please, just tell me if she's going to be okay. Nobody will tell me anything.",
  },
  {
    name: "low",
    intensity: "low",
    text: "Okay. Okay, I hear you. I just... I need a minute.",
  },
];

/**
 * Fallback cast when the key cannot list voices (Voices read access not
 * granted). Same placeholder ids as DEFAULT_VOICE_MAP in
 * src/lib/ai/elevenLabsVoice.ts -- duplicated because a .mjs script cannot
 * import the TypeScript module, and this is a pilot tool. If you change one,
 * change the other; once a real cast is chosen both go away in favour of
 * ELEVENLABS_VOICE_MAP.
 */
const FALLBACK_VOICE_IDS = [
  "onwK4e9ZLuTAKqWW03F9",
  "EXAVITQu4vr4xnSDxMaL",
  "21m00Tcm4TlvDq8ikWAM",
  "AZnzlk1XvdvUeBnXmlld",
  "MF3mGyEYCl7XYWbV9V6O",
  "ThT5KcBeYPX3keUQqHPh",
];

/**
 * Nurse and bystander are functional roles. voiceDirection.ts casts them from a
 * separate pool on purpose: a steadier read is correct there, so judging them on
 * the distress line asks the wrong question and rejects voices that would be
 * right for the job. Set AUDITION_ROLE=steady to hear these instead.
 */
const STEADY_LINES = [
  {
    name: "steady",
    intensity: "low",
    text: "Doctor, her obs are stable. Family are in the side room. Do you want me to bring them through?",
  },
  {
    name: "steady-pressed",
    intensity: "medium",
    text: "Doctor, I need you now. Bay four. I have tried paging twice.",
  },
];

const VOICE_SETTINGS = {
  low: { stability: 0.65, similarity_boost: 0.75, style: 0.25, use_speaker_boost: true },
  medium: { stability: 0.4, similarity_boost: 0.75, style: 0.5, use_speaker_boost: true },
  high: { stability: 0.2, similarity_boost: 0.75, style: 0.75, use_speaker_boost: true },
};

async function readEnvLocal() {
  const env = {};

  try {
    const raw = await readFile(".env.local", "utf8");

    for (const line of raw.split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);

      if (match) {
        env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // Falls through to process.env below.
  }

  return env;
}

async function listVoices(apiKey) {
  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
  });

  if (!response.ok) {
    // Expected when the key was created restricted to Text to Speech only.
    console.log(
      `\n(could not list voices: ${response.status}. Either grant the key Voices ` +
        `read access, or copy voice ids from the Voices page in the web UI.)\n`,
    );
    return null;
  }

  const data = await response.json();
  return data.voices ?? [];
}

async function synthesize({ apiKey, voiceId, text, intensity, model, format }) {
  const url =
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}` +
    `?output_format=${encodeURIComponent(format)}`;

  const started = Date.now();

  const response = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: VOICE_SETTINGS[intensity],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();

    // Worth separating: a 401 here means the key has no Text to Speech access
    // at all, which is a different problem from the Voices listing being
    // restricted, and no amount of retrying voice ids will fix it.
    if (response.status === 401) {
      throw new Error(
        "401 -- this key has no Text to Speech access. Grant it in the API key settings.",
      );
    }

    throw new Error(`${response.status}: ${detail.slice(0, 300)}`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  return { audio, ms: Date.now() - started };
}

async function main() {
  const env = await readEnvLocal();
  const apiKey = env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    console.error("ELEVENLABS_API_KEY is not set in .env.local. Add it and re-run.");
    process.exit(1);
  }

  const model = process.env.ELEVENLABS_MODEL || env.ELEVENLABS_MODEL || "eleven_v3";
  const format = env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";

  console.log(`model=${model} format=${format}`);

  const voices = await listVoices(apiKey);

  if (voices) {
    console.log(`\n${voices.length} voices on this account:\n`);
    for (const voice of voices) {
      const labels = Object.values(voice.labels ?? {}).join(", ");
      console.log(`  ${voice.voice_id}  ${voice.name}${labels ? `  (${labels})` : ""}`);
    }
    console.log("");
  }

  const requested = process.argv.slice(2);
  let candidates = requested;

  if (!candidates.length) {
    candidates = voices?.length
      ? voices.slice(0, 8).map((voice) => voice.voice_id)
      : FALLBACK_VOICE_IDS;

    if (!voices?.length) {
      console.log("Auditioning placeholder voices instead. These are a starting point,");
      console.log("not a cast -- pass real ids as arguments once you have picked them.");
      console.log("");
    }
  }

  await mkdir(OUT_DIR, { recursive: true });

  const timings = [];

  for (const voiceId of candidates) {
    const lines = process.env.AUDITION_ROLE === "steady" ? STEADY_LINES : TEST_LINES;

    for (const line of lines) {
      try {
        const { audio, ms } = await synthesize({
          apiKey,
          voiceId,
          text: line.text,
          intensity: line.intensity,
          model,
          format,
        });

        // The model belongs in the filename. Without it, re-auditioning the
        // same voice on a different model silently overwrote the previous take,
        // which quietly destroys the only comparison that matters once more
        // than one model is in play.
        const file = join(OUT_DIR, `${voiceId}-${line.name}-${model}.mp3`);
        await writeFile(file, audio);
        timings.push(ms);

        const flag = ms > 2500 ? "  <-- OVER the 2,500ms hold cap" : "";
        console.log(`${String(ms).padStart(5)}ms  ${file}${flag}`);
      } catch (error) {
        console.error(`  FAILED ${voiceId} (${line.name}): ${error.message}`);
      }
    }
  }

  if (timings.length) {
    const sorted = [...timings].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const worst = sorted[sorted.length - 1];
    const over = timings.filter((ms) => ms > 2500).length;

    console.log(
      `\nlatency: median ${median}ms, worst ${worst}ms, ` +
        `${over}/${timings.length} over the 2,500ms hold cap`,
    );
    console.log(`audio written to ${OUT_DIR}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
