/**
 * Renders the audition lines through the CURRENT provider, so the listening
 * test is an A/B rather than an impression.
 *
 * Without this you are judging ElevenLabs against a memory of how the app
 * sounds, which is exactly the kind of comparison that produced three failed
 * prompt-tuning attempts. Same lines, same intensity ladder, files side by side
 * in one folder: play them back to back.
 *
 * Usage:
 *   node scripts/baselineOpenAi.mjs              # coral (expressive slot)
 *   node scripts/baselineOpenAi.mjs alloy ash    # specific OpenAI voices
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT_DIR = join("scratch", "voice-audition");

/** Must stay identical to TEST_LINES in auditionVoices.mjs or the A/B is void. */
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
 * The prose ladder from src/lib/ai/voiceDirection.ts, plus the shared
 * commitment framing that stops the model reading in its announcer register.
 * Duplicated because a .mjs script cannot import the TypeScript module; if the
 * ladder there changes, change it here or the baseline stops being the baseline.
 */
const COMMITMENT = [
  "Affect: commit fully to how this person feels. It should be immediately obvious to a listener, from the very first word.",
  "Do not underplay, do not hold back, and do not sound polite or composed when the character is not.",
  "Keep it real rather than theatrical: the feeling belongs in the breath, the pacing and the pitch, not in over-articulated words. This is a real person in a hospital, not a stage performance -- but a real person in this state is far from neutral.",
  "Never read these lines in a flat, announcer-like, or assistant-like register -- even when the words themselves are calm or polite.",
].join("\n");

const INTENSITY_DIRECTION = {
  low: [
    "Pacing: unhurried, with real pauses between thoughts. Let sentences finish.",
    "Tone: quieter and warmer, but the feeling is still audible underneath. Calm, not neutral.",
    "Delivery: softer, not flat. You are steadier than before, never indifferent or detached.",
  ].join("\n"),
  high: [
    "Pacing: fast and uneven, tumbling, sometimes rushing two thoughts together.",
    "Tone: pushed volume, pitch riding high, audibly frayed.",
    "Delivery: catch your breath mid-sentence. Let a word crack or waver. Do not sound composed.",
  ].join("\n"),
};

function instructionsFor(intensity) {
  return [
    "Identity: a family member in a hospital, speaking to a doctor face to face.",
    COMMITMENT,
    INTENSITY_DIRECTION[intensity],
    "Rules: stay in character, never narrate, never add commentary, and speak only the words given.",
  ].join("\n");
}

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
    // Falls through to process.env.
  }

  return env;
}

async function main() {
  const env = await readEnvLocal();
  const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("OPENAI_API_KEY is not set in .env.local.");
    process.exit(1);
  }

  const model = env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
  // coral is an expressive-pool slot: what a patient or family member is cast
  // to today, and therefore the voice ElevenLabs actually has to beat.
  const voices = process.argv.slice(2).length ? process.argv.slice(2) : ["coral"];

  console.log(`model=${model}`);

  await mkdir(OUT_DIR, { recursive: true });

  const timings = [];

  for (const voice of voices) {
    for (const line of TEST_LINES) {
      const started = Date.now();

      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          voice,
          input: line.text,
          instructions: instructionsFor(line.intensity),
          response_format: "mp3",
        }),
      });

      if (!response.ok) {
        console.error(`  FAILED ${voice} (${line.name}): ${response.status}`);
        continue;
      }

      const audio = Buffer.from(await response.arrayBuffer());
      const ms = Date.now() - started;
      const file = join(OUT_DIR, `openai-${voice}-${line.name}.mp3`);

      await writeFile(file, audio);
      timings.push(ms);
      console.log(`${String(ms).padStart(5)}ms  ${file}`);
    }
  }

  if (timings.length) {
    const sorted = [...timings].sort((a, b) => a - b);
    console.log(
      `\nbaseline latency: median ${sorted[Math.floor(sorted.length / 2)]}ms, ` +
        `worst ${sorted[sorted.length - 1]}ms`,
    );
    console.log("\nPlay the -high files back to back. That is the test.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
