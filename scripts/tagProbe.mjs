/**
 * Does the model actually PERFORM inline direction, or does it read it out?
 *
 * Three ways of asking for the same performance, so the difference is audible:
 *   plain   -- no direction at all, the control
 *   tags    -- v3 audio tags placed where the break belongs
 *   punct   -- ellipses and em-dashes only, no tags
 *
 * The failure this is really checking for: an unsupported tag is not ignored,
 * it is spoken. A patient saying the word "gasps" mid-sentence in front of a
 * trainee is far worse than a flat read, which is why the feature ships off.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT_DIR = join("scratch", "voice-audition", "tags");

const VARIANTS = [
  { name: "plain", text: "No. No, that can't be right. You said she was stable an hour ago." },
  {
    name: "tags",
    text: "[gasps] No. [shaky] No, that can't be right. You said she was stable an hour ago.",
  },
  {
    name: "punct",
    text: "No... No, that — that can't be right. You said she was stable an hour ago.",
  },
];

const CASES = [
  { voice: "pFZP5JQG7iQjIQuC4Bku", who: "lily", model: "eleven_v3_conversational" },
  { voice: "SOYHLrjzK2X1ezoPC6cr", who: "harry", model: "eleven_v3" },
];

const SETTINGS = { stability: 0.2, similarity_boost: 0.75, style: 0.75, use_speaker_boost: true };

async function key() {
  const raw = await readFile(".env.local", "utf8");
  return /^\s*ELEVENLABS_API_KEY\s*=\s*(.+)$/m.exec(raw)?.[1].trim().replace(/^["']|["']$/g, "");
}

const apiKey = await key();
await mkdir(OUT_DIR, { recursive: true });

for (const { voice, who, model } of CASES) {
  for (const variant of VARIANTS) {
    const started = Date.now();
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ text: variant.text, model_id: model, voice_settings: SETTINGS }),
      },
    );

    if (!response.ok) {
      console.error(`FAILED ${who}/${variant.name}: ${response.status} ${await response.text()}`);
      continue;
    }

    const file = join(OUT_DIR, `${who}-${variant.name}.mp3`);
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
    console.log(`${String(Date.now() - started).padStart(5)}ms  ${file}`);
  }
}
