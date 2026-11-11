/**
 * Puts MediaPipe's WebAssembly runtime where the site can serve it itself:
 * `public/mediapipe/wasm/`, copied from the installed package.
 *
 * Runs after `npm install` and again before `dev` and `build` (see
 * package.json), so nothing has to remember it. All three, because a host that
 * calls `next build` directly skips the `prebuild` hook, and an install with
 * scripts disabled skips `postinstall`; either one alone leaves a way for a
 * deploy to ship without the files and the camera to fail only in production.
 * The camera used to fetch this runtime from jsDelivr, which a hospital or
 * college network is free to block, and which took the camera down with it on
 * a bad day.
 *
 * Copied rather than committed, for two reasons:
 *   - it is 27 MB of binary that npm already delivers;
 *   - the runtime must match the installed `@mediapipe/tasks-vision` exactly,
 *     and a copy taken from that package at build time cannot drift from it.
 *     A committed copy would silently go stale on the next upgrade.
 *
 * The face model (`public/mediapipe/face_landmarker.task`) is the opposite
 * case: npm does not ship it, so it IS committed.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const target = join(root, "public", "mediapipe", "wasm");

/*
 * What `FilesetResolver.forVisionTasks(base)` asks for: the SIMD build on any
 * current browser, the plain build where SIMD is missing. The package also
 * ships a `_module` pair, used only when a caller opts into module workers,
 * which this app does not -- so those 14 MB are left behind.
 */
const FILES = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

if (!existsSync(source)) {
  // Not fatal: only the camera needs these, and it reports its own failure to
  // load. A build must not die because an optional feature's files are absent.
  console.warn(`[mediapipe] ${source} not found; run npm install. The camera will not start without it.`);
  process.exit(0);
}

mkdirSync(target, { recursive: true });

let copied = 0;

for (const name of FILES) {
  const from = join(source, name);
  const to = join(target, name);

  if (!existsSync(from)) {
    // The package renamed or dropped a file. Loud, because the camera would
    // otherwise fail at runtime with nothing to say why.
    console.error(`[mediapipe] ${name} is missing from the installed package. Check FILES in this script against the package's wasm folder.`);
    process.exit(1);
  }

  // Skipped when the copy is already the same size and no older than its
  // source, so a normal `npm run dev` does not rewrite 27 MB every time.
  if (existsSync(to)) {
    const a = statSync(from);
    const b = statSync(to);

    if (a.size === b.size && b.mtimeMs >= a.mtimeMs) {
      continue;
    }
  }

  copyFileSync(from, to);
  copied += 1;
}

if (copied > 0) {
  console.log(`[mediapipe] copied ${copied} runtime file${copied === 1 ? "" : "s"} to public/mediapipe/wasm`);
}
