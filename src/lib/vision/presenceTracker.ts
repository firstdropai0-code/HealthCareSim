"use client";

import type { FaceLandmarker, Matrix } from "@mediapipe/tasks-vision";
import type { PresenceSample } from "@/types/presence";

/**
 * Reads the trainee's face from a playing <video>, entirely in this browser.
 * No frame is stored or sent anywhere; only the numbers in a PresenceSample
 * survive a call to sample().
 *
 * The runtime and model come from a CDN for now so ~14MB of wasm stays out of
 * the repo while this is still an experiment. They are code and weights being
 * fetched, nothing about the user goes the other way. Self-host both in
 * public/ before this reaches real trainees.
 *
 * The wasm version must match the installed @mediapipe/tasks-vision exactly.
 */
const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const ROUTINE_MEDIAPIPE_LOG = "INFO: Created TensorFlow Lite";

export type PresenceTracker = {
  /** Null when the video has no new frame to read yet. */
  sample: () => PresenceSample | null;
  /** Which processor the model ended up on, because it decides how much it costs. */
  delegate: "GPU" | "CPU";
  close: () => void;
};

function degrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/*
 * The matrix places the face in front of the camera, column-major. Its third
 * column is where the face's own forward axis ended up, which gives yaw and
 * pitch directly and avoids picking an Euler order for a roll we don't use.
 * Normalised because the model's solve can leave a little scale in the matrix.
 */
function readHeadRotation(matrix: Matrix) {
  const { data } = matrix;
  const length = Math.hypot(data[8], data[9], data[10]) || 1;
  const forwardX = data[8] / length;
  const forwardY = data[9] / length;
  const forwardZ = data[10] / length;

  return {
    yawDeg: degrees(Math.atan2(forwardX, forwardZ)),
    pitchDeg: degrees(Math.asin(Math.max(-1, Math.min(1, forwardY)))),
  };
}

/**
 * Loads the model and starts reading from `video`. Throws if the model can't be
 * loaded at all; callers treat that the same as having no camera.
 *
 * MediaPipe is imported here rather than at the top of the module: it is only
 * worth its download for someone who has actually turned the camera on.
 */
export async function createPresenceTracker(video: HTMLVideoElement): Promise<PresenceTracker> {
  const { FaceLandmarker: FaceLandmarkerTask, FilesetResolver } = await import("@mediapipe/tasks-vision");

  let landmarker: FaceLandmarker;
  let delegate: "GPU" | "CPU" = "GPU";

  /*
   * MediaPipe's wasm prints one routine INFO line through console.error as the
   * model starts. In development Next shows any console.error as a full-screen
   * overlay, which landed on top of calibration and looked like a crash. Only
   * that exact line is dropped. In place from before the wasm loads, in case it
   * keeps its own reference to console.error, and gone once the model is running.
   */
  const realConsoleError = console.error;

  console.error = (...args: unknown[]) => {
    if (typeof args[0] !== "string" || !args[0].startsWith(ROUTINE_MEDIAPIPE_LOG)) {
      realConsoleError(...args);
    }
  };

  try {
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);

    const create = (delegateToTry: "GPU" | "CPU") =>
      FaceLandmarkerTask.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: delegateToTry },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFacialTransformationMatrixes: true,
      });

    try {
      landmarker = await create("GPU");
    } catch {
      // Blocklisted or missing WebGL. Slower, but the numbers are the same.
      delegate = "CPU";
      landmarker = await create("CPU");
    }

    // The first frame compiles the model's shaders and froze the page for over
    // two seconds when measured. Better here, behind a loading message, than
    // whenever the first reading happens to be taken.
    landmarker.detectForVideo(video, performance.now());
  } finally {
    console.error = realConsoleError;
  }

  const startedAt = performance.now();
  let lastVideoTime = -1;

  return {
    delegate,
    close: () => landmarker.close(),
    sample: () => {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.currentTime === lastVideoTime) {
        return null;
      }

      lastVideoTime = video.currentTime;

      const now = performance.now();
      const result = landmarker.detectForVideo(video, now);
      const inferenceMs = performance.now() - now;
      const time = (now - startedAt) / 1000;

      const matrix = result.facialTransformationMatrixes?.[0];

      if (!matrix) {
        return { time, faceVisible: false, inferenceMs };
      }

      return { time, faceVisible: true, inferenceMs, ...readHeadRotation(matrix) };
    },
  };
}
