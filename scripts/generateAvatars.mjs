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
 *   node scripts/generateAvatars.mjs --reprocess      # rebuild the WebPs from the
 *                                                    # saved drawings, no API calls
 *
 * Raw model output is kept in scratch/avatars-raw/ (gitignored) so a rejected
 * expression can be redone without redrawing the person. The served files are
 * 448px WebP in public/avatars/<id>/<expression>.webp with the background cut
 * away, so the stage can stand each person in their scenario's room.
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
  const options = { only: null, force: false, reprocess: false };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--only") {
      options.only = new Set(argv[++index].split(","));
    } else if (argv[index] === "--force") {
      options.force = true;
    } else if (argv[index] === "--reprocess") {
      options.reprocess = true;
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

/** Working resolution for the cut: full size, so the edge is cut before it is scaled. */
const CUT_PX = 1024;

/*
 * Distance from the background colour, in RGB. Within CUT_HARD a pixel is
 * background; between the two it is an edge, made partly transparent; beyond
 * CUT_SOFT it is the person. The fill only travels through background; edge
 * pixels are softened at most CUT_EDGE_PX deep from it and never carry the
 * fill further. Letting it travel through edge colour leaked into a light
 * blue shirt wherever it met the frame -- light blue is within CUT_SOFT of
 * sage -- and left it mottled.
 */
const CUT_HARD = 26;
const CUT_SOFT = 48;
const CUT_EDGE_PX = 3;

/**
 * Cut the person out of their flat background and save a transparent WebP.
 *
 * A flood fill inward from the image's border, not a colour key over the
 * whole picture. The portraits sit on pale sage, and some of the cast wear
 * sage -- a global key punched holes through a kameez and a dupatta pattern.
 * Only background reachable from the edge is removed, so colour inside the
 * figure is never touched. Edge pixels get partial alpha with the background
 * unmixed from their colour, which is what keeps a sage halo off the hair
 * when the portrait is laid over a room.
 */
async function cutOut(rawPath, outPath) {
  const N = CUT_PX;
  const { stdout } = await run(
    "ffmpeg",
    ["-v", "error", "-i", rawPath, "-vf", `scale=${N}:${N}`, "-f", "rawvideo", "-pix_fmt", "rgba", "-"],
    { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 },
  );
  const px = new Uint8ClampedArray(stdout);
  const borderPixels = [];

  for (let i = 0; i < N; i += 1) {
    borderPixels.push(i, (N - 1) * N + i, i * N, i * N + N - 1);
  }

  // The background colour, as the median of the border: robust to the odd
  // shoulder or elbow that reaches the frame.
  const background = [0, 1, 2].map((channel) => {
    const values = borderPixels.map((index) => px[index * 4 + channel]).sort((a, b) => a - b);
    return values[values.length >> 1];
  });
  const distance = (index) =>
    Math.hypot(px[index * 4] - background[0], px[index * 4 + 1] - background[1], px[index * 4 + 2] - background[2]);

  // 0 = person, 1 = background, 2..(1 + CUT_EDGE_PX) = edge, by depth.
  const reached = new Uint8Array(N * N);
  const queue = new Int32Array(N * N);
  let head = 0;
  let tail = 0;

  const neighboursOf = (index) => {
    const x = index % N;
    return [x > 0 ? index - 1 : -1, x < N - 1 ? index + 1 : -1, index - N, index + N].filter(
      (next) => next >= 0 && next < N * N,
    );
  };

  for (const index of borderPixels) {
    if (!reached[index] && distance(index) < CUT_HARD) {
      reached[index] = 1;
      queue[tail++] = index;
    }
  }

  // Pass one: the background itself.
  while (head < tail) {
    const index = queue[head++];

    for (const next of neighboursOf(index)) {
      if (!reached[next] && distance(next) < CUT_HARD) {
        reached[next] = 1;
        queue[tail++] = next;
      }
    }
  }

  // Pass two: a few pixels of anti-aliased edge around it, and no further.
  let frontier = Array.from(queue.subarray(0, tail));

  for (let depth = 2; depth <= 1 + CUT_EDGE_PX; depth += 1) {
    const next = [];

    for (const index of frontier) {
      for (const neighbour of neighboursOf(index)) {
        if (!reached[neighbour] && distance(neighbour) < CUT_SOFT) {
          reached[neighbour] = depth;
          next.push(neighbour);
        }
      }
    }

    frontier = next;
  }

  for (let index = 0; index < N * N; index += 1) {
    if (!reached[index]) {
      continue;
    }

    const alpha = Math.max(0, Math.min(1, (distance(index) - CUT_HARD) / (CUT_SOFT - CUT_HARD)));
    const offset = index * 4;

    if (alpha > 0) {
      for (let channel = 0; channel < 3; channel += 1) {
        px[offset + channel] = (px[offset + channel] - (1 - alpha) * background[channel]) / alpha;
      }
    }

    px[offset + 3] = Math.round(alpha * 255);
  }

  await new Promise((resolve, reject) => {
    const child = execFile(
      "ffmpeg",
      [
        "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${N}x${N}`, "-i", "-",
        "-vf", `scale=${OUTPUT_PX}:${OUTPUT_PX}`, "-c:v", "libwebp", "-quality", "85", "-pix_fmt", "yuva420p", outPath,
      ],
      (error) => (error ? reject(error) : resolve()),
    );
    child.stdin.end(Buffer.from(px.buffer));
  });
}

async function buildPerson({ person, expressions, apiKey, model, force, reprocess }) {
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

    if (force || reprocess || !(await exists(outPath))) {
      await cutOut(rawPath, outPath);
    }
  }

  // One strip per person, every expression side by side, for the review pass.
  // Laid on mid-grey, which shows a bad cut -- a halo or a hole -- that the
  // portraits' own pale background would hide.
  await mkdir(SHEET_DIR, { recursive: true });
  const names = Object.keys(expressions);
  const inputs = names.flatMap((name) => ["-i", join(outDir, `${name}.webp`)]);
  const scaled = names
    .map((_, index) => `color=c=0x64748b:s=256x256:d=1[g${index}];[${index}]scale=256:256[f${index}];[g${index}][f${index}]overlay[s${index}]`)
    .join(";");
  const stack = `${names.map((_, index) => `[s${index}]`).join("")}hstack=inputs=${names.length}`;
  await run("ffmpeg", ["-y", "-v", "error", ...inputs, "-filter_complex", `${scaled};${stack}`, "-frames:v", "1", join(SHEET_DIR, `${person.id}.png`)]);
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
          await buildPerson({
            person,
            expressions,
            apiKey,
            model,
            force: options.force,
            reprocess: options.reprocess,
          });
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
