/**
 * Builds the simulation's portrait library: one illustrated person per entry in
 * src/lib/avatars/avatarLibrary.json, in every expression listed there.
 *
 * Why a fixed library rather than a face per scenario: a scenario is generated
 * in seconds and published straight away, so a per-scenario face would reach
 * trainees without anyone having looked at it -- in a product whose cases are
 * deaths and frightened parents. A small library is generated once, reviewed
 * once by a person, and shipped as static files. It also costs nothing per run
 * and needs no image storage, which this stack does not have.
 *
 * Each person is drawn once (their "calm" portrait) and every other expression
 * is an EDIT of that image, not a fresh prompt. Fresh prompts give a different
 * face every time; edits keep the same person, clothes and framing, so the
 * portrait can change expression mid-roleplay without becoming someone else.
 *
 * Usage:
 *   node scripts/generateAvatars.mjs                  # generate whatever is missing
 *   node scripts/generateAvatars.mjs --only man-older # one person (comma-separate several)
 *   node scripts/generateAvatars.mjs --only man-older --force   # redraw them
 *
 * Raw model output is kept in scratch/avatars-raw/ (gitignored) so a rejected
 * expression can be redone without redrawing the person. The served files are
 * 448px WebP in public/avatars/<id>/<expression>.webp, converted with ffmpeg.
 * A contact sheet per person lands in scratch/avatars-sheet/ for review.
 *
 * Cost: one image is ~1,100 output tokens on gemini-3.1-flash-image, a few
 * cents each; the full library (12 people x 6 expressions) is a few dollars.
 * Reads GEMINI_API_KEY from .env.local. Override the model with
 * GEMINI_IMAGE_MODEL.
 */

import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const LIBRARY_PATH = join("src", "lib", "avatars", "avatarLibrary.json");
const RAW_DIR = join("scratch", "avatars-raw");
const SHEET_DIR = join("scratch", "avatars-sheet");
const OUT_DIR = join("public", "avatars");

/** Twice the largest size the stage draws a portrait at, for 2x screens. */
const OUTPUT_PX = 448;

/** Image calls take ~10s each; four people in flight keeps the run to minutes. */
const CONCURRENCY = 4;

/*
 * One style line for every portrait, so the library reads as one cast rather
 * than twelve commissions. The pale sage background sits inside the app's own
 * palette, and "no text" stops the model lettering a name onto ID badges.
 */
const STYLE =
  "Style: modern flat editorial illustration, soft muted colours, gentle shading, clean confident linework, no text or lettering anywhere. " +
  "Plain pale sage-green background, evenly lit. Head-and-shoulders, centered, facing slightly toward the viewer, shoulders visible, square framing.";

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
  const options = { only: null, force: false };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--only") {
      options.only = new Set(argv[++index].split(","));
    } else if (argv[index] === "--force") {
      options.force = true;
    }
  }

  return options;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function generateImage({ apiKey, model, parts }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
      }),
    });

    if (response.ok) {
      const json = await response.json();
      const image = json.candidates?.[0]?.content?.parts?.find((part) => part.inlineData);

      if (image) {
        return Buffer.from(image.inlineData.data, "base64");
      }

      // A safety block or a text-only reply. Worth one retry; the same prompt
      // usually draws on the second attempt.
      if (attempt < 4) {
        continue;
      }

      throw new Error(`no image returned: ${JSON.stringify(json).slice(0, 200)}`);
    }

    if ((response.status === 429 || response.status >= 500) && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      continue;
    }

    throw new Error(`Gemini ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
}

async function toWebp(rawPath, outPath) {
  await run("ffmpeg", [
    "-y", "-v", "error", "-i", rawPath,
    "-vf", `scale=${OUTPUT_PX}:${OUTPUT_PX}`,
    "-c:v", "libwebp", "-quality", "82", outPath,
  ]);
}

async function buildPerson({ person, expressions, apiKey, model, force }) {
  const rawDir = join(RAW_DIR, person.id);
  const outDir = join(OUT_DIR, person.id);
  await mkdir(rawDir, { recursive: true });
  await mkdir(outDir, { recursive: true });

  const basePath = join(rawDir, "calm.jpg");

  if (force || !(await exists(basePath))) {
    const prompt = `Portrait of ${person.description}. Facial expression: ${expressions.calm}.\n${STYLE}`;
    await writeFile(basePath, await generateImage({ apiKey, model, parts: [{ text: prompt }] }));
    console.log(`  ${person.id}: drew base`);
  }

  const base = await readFile(basePath);

  for (const [expression, look] of Object.entries(expressions)) {
    const rawPath = join(rawDir, `${expression}.jpg`);
    const outPath = join(outDir, `${expression}.webp`);

    if (expression !== "calm" && (force || !(await exists(rawPath)))) {
      const prompt =
        "Edit this illustration. Keep the exact same person, face shape, hairstyle, clothing, colours, framing, background and illustration style. " +
        `Change ONLY the facial expression, and the tilt of the head slightly if it helps, to: ${look}. No text.`;
      const image = await generateImage({
        apiKey,
        model,
        parts: [{ inlineData: { mimeType: "image/jpeg", data: base.toString("base64") } }, { text: prompt }],
      });
      await writeFile(rawPath, image);
      console.log(`  ${person.id}: ${expression}`);
    }

    if (force || !(await exists(outPath))) {
      await toWebp(rawPath, outPath);
    }
  }

  // One strip per person, every expression side by side, for the review pass.
  await mkdir(SHEET_DIR, { recursive: true });
  const names = Object.keys(expressions);
  const inputs = names.flatMap((name) => ["-i", join(outDir, `${name}.webp`)]);
  const scaled = names.map((_, index) => `[${index}]scale=256:256[s${index}]`).join(";");
  const stack = `${names.map((_, index) => `[s${index}]`).join("")}hstack=inputs=${names.length}`;
  await run("ffmpeg", ["-y", "-v", "error", ...inputs, "-filter_complex", `${scaled};${stack}`, join(SHEET_DIR, `${person.id}.png`)]);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = await readEnvLocal();
  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set in .env.local.");
    process.exit(1);
  }

  try {
    await run("ffmpeg", ["-version"]);
  } catch {
    console.error("ffmpeg is not on PATH; it converts the portraits to WebP. Install it and re-run.");
    process.exit(1);
  }

  const model = env.GEMINI_IMAGE_MODEL || process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
  const { expressions, characters } = JSON.parse(await readFile(LIBRARY_PATH, "utf8"));
  const people = characters.filter((person) => !options.only || options.only.has(person.id));

  console.log(`model=${model}  people=${people.length}  expressions=${Object.keys(expressions).length}`);

  const queue = [...people];
  const failures = [];

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) {
        const person = queue.shift();

        try {
          await buildPerson({ person, expressions, apiKey, model, force: options.force });
          console.log(`done ${person.id}`);
        } catch (error) {
          failures.push(person.id);
          console.error(`FAILED ${person.id}: ${error.message}`);
        }
      }
    }),
  );

  console.log(failures.length ? `\nFailed: ${failures.join(", ")} (re-run to retry just those)` : "\nAll portraits built.");
  console.log(`Review the strips in ${SHEET_DIR}/ before shipping.`);
}

await main();
