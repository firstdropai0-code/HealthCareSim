/**
 * Builds the simulation's room backdrops: one illustrated, empty room per
 * entry in src/lib/scenes/sceneLibrary.json, in the same flat style as the
 * portraits, so a character can be stood in the setting their scenario is in.
 *
 * Empty on purpose. The people come from the portrait library and are laid
 * over the room in the browser; a room drawn with people in it would put a
 * stranger in every scene, and a room per character per expression would be
 * hundreds of images for the same twelve faces.
 *
 * Usage:
 *   node scripts/generateScenes.mjs                 # draw whatever is missing
 *   node scripts/generateScenes.mjs --only icu,ward # just these rooms
 *   node scripts/generateScenes.mjs --only icu --force   # redraw one
 *
 * Raw output is kept in scratch/scenes-raw/ (gitignored); the served files are
 * 1280px-wide WebP in public/scenes/<id>.webp. Same cost and key as
 * generateAvatars.mjs: a few cents per room, GEMINI_API_KEY from .env.local,
 * GEMINI_IMAGE_MODEL to override the model.
 */

import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const LIBRARY_PATH = join("src", "lib", "scenes", "sceneLibrary.json");
const RAW_DIR = join("scratch", "scenes-raw");
const OUT_DIR = join("public", "scenes");

/*
 * The portrait style line, plus what a backdrop needs that a portrait does
 * not: low contrast so the person in front reads first, and an uncluttered
 * left side, because that is where the stage stands them.
 */
const STYLE =
  "Style: modern flat editorial illustration, soft muted colours, gentle shading, clean confident linework - the same style as a set of flat illustrated character portraits. " +
  "Slightly desaturated and low in contrast, so a character placed in front of it stands out. " +
  "Seen at standing eye level. Keep the left third of the frame uncluttered, where a person will stand. " +
  "No people anywhere, no text, signs or lettering.";

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

async function drawRoom({ apiKey, model, prompt }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" } },
      }),
    });

    if (response.ok) {
      const json = await response.json();
      const image = json.candidates?.[0]?.content?.parts?.find((part) => part.inlineData);

      if (image) {
        return Buffer.from(image.inlineData.data, "base64");
      }

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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = await readEnvLocal();
  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set in .env.local.");
    process.exit(1);
  }

  const model = env.GEMINI_IMAGE_MODEL || process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
  const { scenes } = JSON.parse(await readFile(LIBRARY_PATH, "utf8"));
  const rooms = scenes.filter((scene) => !options.only || options.only.has(scene.id));

  await mkdir(RAW_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`model=${model}  rooms=${rooms.length}`);

  // All at once: eight requests is well inside the rate limit, and each is ~10s.
  const results = await Promise.allSettled(
    rooms.map(async (scene) => {
      const rawPath = join(RAW_DIR, `${scene.id}.jpg`);
      const outPath = join(OUT_DIR, `${scene.id}.webp`);

      if (options.force || !(await exists(rawPath))) {
        const prompt = `Wide interior illustration of ${scene.description}. Calm and quiet.\n${STYLE}`;
        await writeFile(rawPath, await drawRoom({ apiKey, model, prompt }));
        console.log(`  drew ${scene.id}`);
      }

      if (options.force || !(await exists(outPath))) {
        await run("ffmpeg", ["-y", "-v", "error", "-i", rawPath, "-vf", "scale=1280:-2", "-c:v", "libwebp", "-quality", "78", outPath]);
      }
    }),
  );

  const failed = rooms.filter((_, index) => results[index].status === "rejected");
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`FAILED ${rooms[index].id}: ${result.reason.message}`);
    }
  });

  console.log(failed.length ? `\nFailed: ${failed.map((scene) => scene.id).join(", ")}` : "\nAll rooms built.");
}

await main();
