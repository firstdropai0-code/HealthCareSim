/**
 * Checks that an audio tag is not READ ALOUD. It cannot tell you whether a tag
 * is performed.
 *
 * KNOWN LIMITATION, found the hard way: v3 silently DROPS bracketed text it does
 * not recognise rather than speaking it, so this returns a clean result for
 * every tag -- including invented ones. A run where nothing is flagged therefore
 * proves only that nothing leaked into the audio, which is a real safety
 * property but is not evidence that any tag did something. An attempt to use
 * clip duration as the signal instead also failed: run-to-run variance is around
 * 1.15s, far larger than the effect. Whether a tag actually performs still needs
 * ears.
 *
 * Listening to two dozen clips by ear is slow and easy to get wrong, and the
 * failure mode is specific enough to detect mechanically: a tag that is not
 * supported gets spoken, so its own word turns up in a transcript of the audio.
 * Render each tag, send the result through speech-to-text, and look for the
 * word. No ears required, and the whitelist ends up backed by evidence rather
 * than by what the docs imply.
 *
 * Usage: node scripts/tagVocabulary.mjs
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const OUT_DIR = join("scratch", "voice-audition", "vocab");

/** The carrier line stays constant so any extra word in the transcript is the tag. */
const CARRIER = "No. That can't be right. You said she was stable an hour ago.";

const CANDIDATES = [
  "gasps", "shaky", "whispers", "crying", "sighs", "nervous", "shouting",
  "sobbing", "exhales", "breathes shakily", "voice breaking", "stammers",
  "laughs", "angry", "sad",
];

const SETTINGS = { stability: 0.2, similarity_boost: 0.75, style: 0.75, use_speaker_boost: true };
const VOICE = "pFZP5JQG7iQjIQuC4Bku";
const MODEL = "eleven_v3_conversational";

async function env() {
  const raw = await readFile(".env.local", "utf8");
  return {
    eleven: /^\s*ELEVENLABS_API_KEY\s*=\s*(.+)$/m.exec(raw)?.[1].trim().replace(/^["']|["']$/g, ""),
    openai: /^\s*OPENAI_API_KEY\s*=\s*(.+)$/m.exec(raw)?.[1].trim().replace(/^["']|["']$/g, ""),
  };
}

async function speak(apiKey, text) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: SETTINGS }),
    },
  );
  if (!response.ok) throw new Error(`tts ${response.status}: ${await response.text()}`);
  return Buffer.from(await response.arrayBuffer());
}

async function transcribe(apiKey, audio, name) {
  const form = new FormData();
  form.append("file", new Blob([audio], { type: "audio/mpeg" }), `${name}.mp3`);
  form.append("model", "whisper-1");
  form.append("language", "en");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) throw new Error(`stt ${response.status}: ${await response.text()}`);
  return (await response.json()).text ?? "";
}

const keys = await env();
if (!keys.eleven || !keys.openai) {
  console.error("Need both ELEVENLABS_API_KEY and OPENAI_API_KEY in .env.local.");
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

const performed = [];
const spoken = [];

for (const tag of CANDIDATES) {
  const text = `[${tag}] ${CARRIER}`;

  try {
    const audio = await speak(keys.eleven, text);
    await writeFile(join(OUT_DIR, `${tag.replace(/\s+/g, "_")}.mp3`), audio);

    const heard = await transcribe(keys.openai, audio, tag);
    // Compare against the carrier: any word from the tag that shows up in the
    // transcript but is not in the carrier means the tag was read out.
    const carrier = CARRIER.toLowerCase();
    const leaked = tag
      .split(/\s+/)
      .filter((word) => !carrier.includes(word) && heard.toLowerCase().includes(word));

    if (leaked.length) {
      spoken.push(tag);
      console.log(`SPOKEN    [${tag}]  -> heard: "${heard.trim().slice(0, 70)}"`);
    } else {
      performed.push(tag);
      console.log(`performed [${tag}]`);
    }
  } catch (error) {
    console.error(`error     [${tag}]: ${error.message.slice(0, 120)}`);
  }
}

console.log(`\nSAFE (performed, ${performed.length}): ${performed.join(", ")}`);
console.log(`UNSAFE (spoken aloud, ${spoken.length}): ${spoken.join(", ") || "none"}`);
