/**
 * Can Gemini hear the TONE of a trainee's voice, or only their words?
 *
 * This decides whether tone feedback is worth building, before any of it is
 * built. Audio language models are known to judge emotion mostly from what is
 * said rather than how (the LISTEN benchmark, 2025: Gemini 2.5 Pro at ~35% on
 * audio-only emotion when the words were neutral). The coaching moment worth
 * catching is exactly the case that fails that way: "I'm so sorry for your
 * loss" said in a clipped, irritated voice. A model that reads the words calls
 * that warm, and tone feedback built on it would praise the wrong thing.
 *
 * So the test holds the words fixed and varies only the voice. If the label
 * follows the voice, Gemini is listening. If every reading of one sentence
 * gets the same label, it is reading.
 *
 * Recording the clips (any voice, any device):
 *   1. Pick two or three sentences whose words carry no tone of their own, e.g.
 *        sorry    "I'm so sorry. We did everything we could."
 *        explain  "Let me explain what happened this morning."
 *        question "Do you have any questions for me?"
 *   2. Say each one in as many of the TONES below as you can act convincingly.
 *      Fewer, honest takes beat a full grid of hammy ones.
 *   3. Name each file <tone>__<sentence>.<ext>, e.g. irritated__sorry.mp3, and
 *      put them in scratch/tone-probe/ (gitignored).
 *   Windows Sound Recorder saves .m4a by default, which is not on Gemini's
 *   documented format list -- switch it to MP3 or WAV in its settings.
 *
 * Usage:
 *   node scripts/probeVoiceTone.mjs                         # scratch/tone-probe
 *   node scripts/probeVoiceTone.mjs <dir>
 *   node scripts/probeVoiceTone.mjs --model gemini-3.1-pro-preview  # compare models
 *   node scripts/probeVoiceTone.mjs --repeat 3              # check consistency
 *
 * Cost: Gemini bills audio at 32 tokens per second, so 30 five-second clips is
 * about 5k input tokens -- well under a cent on Flash. Reads GEMINI_API_KEY from
 * .env.local; no dev server needed. Results are also written as JSON beside the
 * clips so runs on different models can be compared later.
 */

import { execFile } from "node:child_process";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, basename } from "node:path";
import { promisify } from "node:util";

/*
 * Stances a patient or relative would hear in a clinician's voice, not a
 * generic emotion wheel. "Happy" and "surprised" are useless here; "flat" and
 * "rushed" are the ones a family remembers. Each carries the acoustic cues it
 * should be judged on, so the model has something to listen for besides words.
 */
const TONES = {
  calm: "even pace, steady pitch, relaxed and unhurried",
  warm: "soft, gentle, caring; slightly slower, pitch lifts kindly",
  rushed: "fast, compressed, words run together, hurrying to finish",
  irritated: "clipped and tight, sharp consonants, impatient or annoyed edge",
  angry: "raised volume, hard stress on words, hostile",
  flat: "monotone, low energy, detached, going through the motions",
  distracted: "attention elsewhere: trails off, mid-sentence gaps, restarts, uneven energy",
  anxious: "tense or shaky, hesitant, pitch rises, nervous breath",
  sad: "low, heavy, slow, subdued",
};

/*
 * Coarser buckets, scored alongside the exact label. If exact labels prove
 * unreliable but these hold up, a cruder feature ("you sounded tense here") is
 * still shippable -- the probe should say so rather than return one number.
 */
const GROUPS = {
  settled: ["calm", "warm"],
  tense: ["rushed", "irritated", "angry", "anxious"],
  withdrawn: ["flat", "distracted", "sad"],
};

const MIME_TYPES = {
  ".wav": "audio/wav",
  ".mp3": "audio/mp3",
  ".aiff": "audio/aiff",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  // What the app's own MediaRecorder produces, so real captured turns can be
  // dropped in too.
  ".webm": "audio/webm",
  // Not on Gemini's documented list. Tried as a best effort; re-export as MP3
  // if it errors.
  ".m4a": "audio/mp4",
};

/** Inline audio shares a 20 MB request cap with the prompt. */
const MAX_INLINE_BYTES = 15 * 1024 * 1024;

const toneSchema = {
  type: "OBJECT",
  required: ["evidence", "tone", "intensity", "confidence", "transcript", "wordsVsVoice"],
  // Evidence first, so the label is chosen after the model has named what it
  // heard rather than justified afterwards from the words.
  propertyOrdering: ["evidence", "tone", "intensity", "confidence", "transcript", "wordsVsVoice"],
  properties: {
    evidence: { type: "STRING" },
    tone: { type: "STRING", enum: Object.keys(TONES) },
    intensity: { type: "STRING", enum: ["low", "medium", "high"] },
    confidence: { type: "STRING", enum: ["low", "medium", "high"] },
    transcript: { type: "STRING" },
    wordsVsVoice: { type: "STRING", enum: ["match", "mismatch"] },
  },
};

const PROMPT = `You are listening to one spoken turn by a doctor in a healthcare communication training roleplay. A patient or a relative is on the other side.

Judge HOW it sounds, not WHAT is said. In these recordings the words are often kind or neutral while the voice is not. When the words and the voice disagree, report the voice -- that disagreement is the thing being tested.

Choose the one tone that best describes how this voice would come across to the listener:
${Object.entries(TONES)
  .map(([tone, cues]) => `- ${tone}: ${cues}`)
  .join("\n")}

Fields:
- evidence: the acoustic cues you actually heard -- pitch, pace, volume, voice quality, pauses. Under 20 words. Do not quote or paraphrase the words.
- tone: one label from the list.
- intensity: how strongly that tone comes through.
- confidence: how sure you are from the sound alone. Use "low" when the voice is ambiguous.
- transcript: the words spoken.
- wordsVsVoice: "match" if the feeling of the words fits the tone of the voice, "mismatch" if they pull apart.`;

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

function parseArgs(argv) {
  const options = { dir: join("scratch", "tone-probe"), model: null, repeat: 1 };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--model") {
      options.model = argv[++index];
    } else if (arg === "--repeat") {
      options.repeat = Math.max(1, Number(argv[++index]) || 1);
    } else {
      options.dir = arg;
    }
  }

  return options;
}

/** "irritated__sorry.mp3" -> { expected: "irritated", sentence: "sorry" }. */
function parseClipName(file) {
  const stem = basename(file, extname(file));
  const [head, ...rest] = stem.split("__");
  const expected = head.toLowerCase();

  return {
    expected: expected in TONES ? expected : null,
    sentence: rest.join("__") || stem,
  };
}

/*
 * Clip length via ffprobe, when it is installed, so the table can show a
 * measured speaking rate beside the model's claims. This is the one check
 * that does not depend on anyone's ears: in the first synthetic run a clip
 * 28% faster than its siblings was described as "steady, relaxed pace" --
 * evidence invented to fit the words. It also tells you whether a take you
 * recorded as "rushed" actually was. Null without ffprobe; nothing else
 * depends on it.
 */
async function measureDurationSec(path) {
  try {
    const { stdout } = await promisify(execFile)("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path,
    ]);
    const seconds = Number(stdout.trim());
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  } catch {
    return null;
  }
}

function groupOf(tone) {
  return Object.entries(GROUPS).find(([, tones]) => tones.includes(tone))?.[0] ?? null;
}

async function classify({ apiKey, model, audio, mimeType }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ inlineData: { mimeType, data: audio.toString("base64") } }, { text: PROMPT }],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: toneSchema,
    },
  };

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const json = await response.json();
      const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
      return JSON.parse(text);
    }

    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      continue;
    }

    const detail = await response.text();
    let message = detail.slice(0, 300);

    try {
      message = JSON.parse(detail).error?.message ?? message;
    } catch {
      // Not JSON; keep the raw text.
    }

    const error = new Error(`Gemini ${response.status}: ${message}`);
    // A bad model name or key fails every clip identically -- stop on the
    // first rather than printing the same error thirty times.
    error.fatal = response.status >= 400 && response.status < 500 && response.status !== 429;
    throw error;
  }
}

function pad(value, width) {
  const text = String(value);
  return text.length >= width ? text.slice(0, width) : text + " ".repeat(width - text.length);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = await readEnvLocal();
  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set in .env.local.");
    process.exit(1);
  }

  const model =
    options.model ||
    env.GEMINI_TONE_MODEL ||
    env.GEMINI_MODEL ||
    process.env.GEMINI_MODEL ||
    "gemini-2.5-flash";

  let files;

  try {
    files = (await readdir(options.dir))
      .filter((file) => extname(file).toLowerCase() in MIME_TYPES)
      .sort();
  } catch {
    console.error(`No folder at ${options.dir}. Record clips there first (see the header of this file).`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error(`No audio clips in ${options.dir}. Expected names like irritated__sorry.mp3.`);
    process.exit(1);
  }

  console.log(`model=${model}  clips=${files.length}  repeat=${options.repeat}\n`);
  console.log(
    `${pad("clip", 28)} ${pad("expected", 11)} ${pad("heard", 11)} ${pad("int/conf", 9)} ${pad("w/v", 9)} ${pad("wps", 5)} evidence`,
  );

  const results = [];

  for (const file of files) {
    const path = join(options.dir, file);
    const { size } = await stat(path);

    if (size > MAX_INLINE_BYTES) {
      console.log(`${pad(file, 28)} skipped: over ${MAX_INLINE_BYTES / 1024 / 1024} MB`);
      continue;
    }

    const audio = await readFile(path);
    const mimeType = MIME_TYPES[extname(file).toLowerCase()];
    const { expected, sentence } = parseClipName(file);
    const durationSec = await measureDurationSec(path);

    for (let run = 0; run < options.repeat; run += 1) {
      try {
        const verdict = await classify({ apiKey, model, audio, mimeType });
        const hit = expected ? verdict.tone === expected : null;
        // Whole clip, so leading and trailing silence count. Compare takes of
        // the same sentence against each other, not against a fixed band.
        const wordsPerSec = durationSec
          ? Math.round((verdict.transcript.trim().split(/\s+/).length / durationSec) * 10) / 10
          : null;
        results.push({ file, expected, sentence, run, durationSec, wordsPerSec, ...verdict, hit });

        const mark = hit === null ? " " : hit ? "✓" : "✗";
        console.log(
          `${pad(file, 28)} ${pad(expected ?? "?", 11)} ${mark}${pad(verdict.tone, 10)} ` +
            `${pad(`${verdict.intensity[0]}/${verdict.confidence[0]}`, 9)} ${pad(verdict.wordsVsVoice, 9)} ` +
            `${pad(wordsPerSec ?? "-", 5)} ${verdict.evidence}`,
        );
      } catch (error) {
        if (error.fatal) {
          console.error(`\n${error.message}`);
          process.exit(1);
        }

        console.log(`${pad(file, 28)} error: ${error.message}`);
      }
    }
  }

  const scored = results.filter((result) => result.expected);

  if (scored.length > 0) {
    const exact = scored.filter((result) => result.hit).length;
    const grouped = scored.filter((result) => groupOf(result.tone) === groupOf(result.expected)).length;

    console.log(`\nExact label : ${exact}/${scored.length} (${Math.round((exact / scored.length) * 100)}%)`);
    console.log(
      `Same group  : ${grouped}/${scored.length} (${Math.round((grouped / scored.length) * 100)}%)` +
        `   groups: ${Object.entries(GROUPS)
          .map(([name, tones]) => `${name}=${tones.join("/")}`)
          .join("  ")}`,
    );
    console.log(`Chance      : ~${Math.round(100 / Object.keys(TONES).length)}% exact, ~33% group`);

    // Hiding low-confidence labels is only a safeguard if the misses are the
    // low-confidence ones. In the first synthetic run every miss said "high".
    const confidentMisses = scored.filter((result) => !result.hit && result.confidence === "high").length;
    console.log(`Misses marked high confidence: ${confidentMisses}/${scored.length - exact}`);

    // The test that matters. One sentence said several ways should come back
    // with several labels; if it collapses to one, the model read the words.
    console.log("\nSame words, different voice (labels should spread as tones do):");
    const bySentence = new Map();

    for (const result of scored) {
      const entry = bySentence.get(result.sentence) ?? { tones: new Set(), heard: new Set() };
      entry.tones.add(result.expected);
      entry.heard.add(result.tone);
      bySentence.set(result.sentence, entry);
    }

    for (const [sentence, { tones, heard }] of bySentence) {
      console.log(
        `  ${pad(sentence, 14)} ${tones.size} tones recorded -> ${heard.size} distinct heard (${[...heard].join(", ")})`,
      );
    }

    const misses = new Map();

    for (const result of scored.filter((item) => !item.hit)) {
      const key = `${result.expected} -> ${result.tone}`;
      misses.set(key, (misses.get(key) ?? 0) + 1);
    }

    if (misses.size > 0) {
      console.log("\nMisses:");
      [...misses.entries()]
        .sort((a, b) => b[1] - a[1])
        .forEach(([key, count]) => console.log(`  ${pad(key, 26)} x${count}`));
    }
  }

  const outPath = join(options.dir, `results-${model}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(outPath, JSON.stringify({ model, results }, null, 2));
  console.log(`\nSaved ${outPath}`);
}

await main();
