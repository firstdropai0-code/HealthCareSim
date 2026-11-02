"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  calibrate,
  computeWindowMetrics,
  DEFAULT_THRESHOLDS,
  isHeadAway,
} from "@/lib/vision/presenceMetrics";
import { createPresenceTracker, type PresenceTracker } from "@/lib/vision/presenceTracker";
import type {
  CalibrationResult,
  PresenceBaseline,
  PresenceSample,
  PresenceThresholds,
  PresenceWindowMetrics,
} from "@/types/presence";

/* The same rate as voiceFeatureCollector, and the rate this would run at in a real scene. */
const SAMPLE_INTERVAL_MS = 100;
const RECENT_WINDOW_SEC = 10;
/* Redrawing on every sample would make the page itself part of what's being measured. */
const REDRAW_EVERY_SAMPLES = 3;

const CALIBRATION_SEC = 3;
const READY_SEC = 5;
/* Time to react to the beep. Without it, every "look away" step opens with a
   second of still looking at the patient, because that's where the instruction was. */
const SETTLE_MS = 1000;
const RECORD_SEC = 8;

type TestStep = {
  id: string;
  title: string;
  instruction: string;
  expected: string;
  passes: (metrics: PresenceWindowMetrics) => boolean;
};

const TEST_STEPS: TestStep[] = [
  {
    id: "listening",
    title: "Listening",
    instruction: "Look at the patient and stay with them, as if they are talking to you.",
    expected: "Facing 85%+",
    passes: (m) => m.facingRatio >= 0.85,
  },
  {
    id: "talking",
    title: "Talking",
    instruction: "Look at the patient and talk out loud as you normally would.",
    expected: "Facing 75%+",
    passes: (m) => m.facingRatio >= 0.75,
  },
  /*
   * The real scene puts the patient's words in a box below them. Someone reading
   * that box is paying attention, so it must not count as looking away -- and
   * it's the likeliest false alarm in this app specifically.
   */
  {
    id: "reading",
    title: "Reading their words",
    instruction: "Read this sentence slowly, again and again, the way you would read what the patient just said.",
    expected: "Facing 85%+",
    passes: (m) => m.facingRatio >= 0.85,
  },
  {
    id: "phone",
    title: "Phone in lap",
    instruction: "Tilt your head down and look at your phone in your lap, or pretend to.",
    expected: "Facing 25% or less",
    passes: (m) => m.facingRatio <= 0.25,
  },
  {
    id: "side",
    title: "Looking aside",
    instruction: "Turn your head and look at a wall or window off to one side.",
    expected: "Facing 25% or less",
    passes: (m) => m.facingRatio <= 0.25,
  },
  {
    id: "glances",
    title: "Three turns away",
    instruction: "Look at the patient, but turn your head away and back three separate times.",
    expected: "2 to 4 look aways",
    passes: (m) => m.lookAwayCount >= 2 && m.lookAwayCount <= 4,
  },
  {
    id: "out-of-frame",
    title: "Out of frame",
    instruction: "Cover the camera with your hand, or move out of the picture.",
    expected: "No reading: too little face seen",
    passes: (m) => !m.reliable,
  },
];

type Stage =
  | { kind: "calibrating"; remaining: number }
  | { kind: "ready" | "recording"; step: TestStep; remaining: number };

type LoadStats = {
  meanMs: number;
  p95Ms: number;
  samplesPerSec: number;
};

type SavedRun = {
  condition: string;
  passed: string;
  delegate: string | null;
  performance: LoadStats | null;
  longTasks: number;
  thresholds: PresenceThresholds;
  baseline: PresenceBaseline;
  steps: { id: string; expected: string; passed: boolean; metrics: PresenceWindowMetrics }[];
};

const CALIBRATION_ERRORS: Record<Extract<CalibrationResult, { ok: false }>["reason"], string> = {
  "face-not-visible": "Couldn't see your face clearly enough. Check the light and that you're in the picture.",
  "too-much-movement": "You moved too much to learn a resting position. Hold still and try again.",
};

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";

  if (name === "NotAllowedError") {
    return "Camera access was refused. Allow it from the icon in the address bar, then try again.";
  }

  if (name === "NotFoundError") {
    return "No camera was found on this device.";
  }

  if (name === "NotReadableError") {
    return "The camera is being used by another app. Close that app and try again.";
  }

  return "The camera couldn't be started in this browser.";
}

function measureLoad(samples: PresenceSample[]): LoadStats | null {
  if (samples.length < 2) {
    return null;
  }

  const durations = samples.map((sample) => sample.inferenceMs).sort((a, b) => a - b);
  const span = samples[samples.length - 1].time - samples[0].time;

  return {
    meanMs: durations.reduce((sum, value) => sum + value, 0) / durations.length,
    p95Ms: durations[Math.floor(durations.length * 0.95)],
    samplesPerSec: span > 0 ? (samples.length - 1) / span : 0,
  };
}

function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/* Results get pasted into chats and notes, where sixteen decimal places are noise. */
function roundForExport(_key: string, value: unknown) {
  return typeof value === "number" ? Math.round(value * 1000) / 1000 : value;
}

function LiveReading({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const toneClass =
    tone === "good"
      ? "text-[var(--color-primary)]"
      : tone === "bad"
        ? "text-[var(--color-danger)]"
        : "text-[var(--color-ink)]";

  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--color-border)] py-1.5 text-sm last:border-b-0">
      <span className="text-[var(--color-ink-muted)]">{label}</span>
      <span className={`font-semibold tabular-nums ${toneClass}`}>{value}</span>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm text-[var(--color-ink-muted)]">
      <span className="flex justify-between gap-3">
        <span>{label}</span>
        <span className="font-semibold tabular-nums text-[var(--color-ink)]">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full accent-[var(--color-primary)]"
      />
    </label>
  );
}

export function PresenceLab() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackerRef = useRef<PresenceTracker | null>(null);
  const timerRef = useRef<number | null>(null);
  const recentRef = useRef<PresenceSample[]>([]);
  const recordingRef = useRef<PresenceSample[] | null>(null);
  const samplesSinceRedrawRef = useRef(0);
  const abortRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const longTaskObserverRef = useRef<PerformanceObserver | null>(null);
  const longTaskCountRef = useRef(0);

  const [cameraState, setCameraState] = useState<"off" | "starting" | "on">("off");
  const [error, setError] = useState<string | null>(null);
  const [delegate, setDelegate] = useState<string | null>(null);
  const [recent, setRecent] = useState<PresenceSample[]>([]);
  const [longTasks, setLongTasks] = useState(0);
  const [baseline, setBaseline] = useState<PresenceBaseline | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [samplesByStep, setSamplesByStep] = useState<Record<string, PresenceSample[]>>({});
  const [thresholds, setThresholds] = useState<PresenceThresholds>(DEFAULT_THRESHOLDS);
  const [condition, setCondition] = useState("");
  const [savedRuns, setSavedRuns] = useState<SavedRun[]>([]);
  const [copied, setCopied] = useState(false);

  const stopCamera = useCallback(() => {
    abortRef.current = true;
    recordingRef.current = null;

    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    longTaskObserverRef.current?.disconnect();
    longTaskObserverRef.current = null;
    trackerRef.current?.close();
    trackerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recentRef.current = [];

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // The webcam light must go out the moment this page is left.
  useEffect(() => stopCamera, [stopCamera]);

  function startSampling(tracker: PresenceTracker) {
    timerRef.current = window.setInterval(() => {
      const sample = tracker.sample();

      if (!sample) {
        return;
      }

      const buffer = recentRef.current;
      buffer.push(sample);

      while (buffer.length > 0 && buffer[0].time < sample.time - RECENT_WINDOW_SEC) {
        buffer.shift();
      }

      recordingRef.current?.push(sample);
      samplesSinceRedrawRef.current += 1;

      if (samplesSinceRedrawRef.current >= REDRAW_EVERY_SAMPLES) {
        samplesSinceRedrawRef.current = 0;
        setRecent([...buffer]);
        setLongTasks(longTaskCountRef.current);
      }
    }, SAMPLE_INTERVAL_MS);
  }

  /* Anything over 50ms blocks the page. This is what would show up as a
     stutter in the scene's animation, which the model's own timing can't show. */
  function watchLongTasks() {
    longTaskCountRef.current = 0;

    try {
      const observer = new PerformanceObserver((list) => {
        longTaskCountRef.current += list.getEntries().length;
      });

      observer.observe({ type: "longtask" });
      longTaskObserverRef.current = observer;
    } catch {
      // Chromium only. The count just stays at zero elsewhere.
    }
  }

  async function turnOnCamera() {
    setCameraState("starting");
    setError(null);
    // Cleared here rather than on turning off, so the camera can go off while
    // the results are still being read. Coming back on, the person may have
    // moved, which would make the old resting position wrong.
    setBaseline(null);
    setSamplesByStep({});

    let stream: MediaStream;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
    } catch (cameraError) {
      setError(cameraErrorMessage(cameraError));
      setCameraState("off");
      return;
    }

    streamRef.current = stream;

    try {
      const video = videoRef.current;

      if (!video) {
        throw new Error("Video element missing");
      }

      video.srcObject = stream;
      await video.play();

      const tracker = await createPresenceTracker(video);

      trackerRef.current = tracker;
      abortRef.current = false;
      setDelegate(tracker.delegate);
      watchLongTasks();
      startSampling(tracker);
      setCameraState("on");
    } catch (loadError) {
      console.error("Face tracking failed to start:", loadError);
      stopCamera();
      setError("The face model couldn't be loaded. It downloads on first use, so check your connection.");
      setCameraState("off");
    }
  }

  function turnOffCamera() {
    stopCamera();
    setRecent([]);
    setStage(null);
    setCameraState("off");
  }

  /* One beep to start, two to stop. The person is looking away from the screen
     during the steps that matter most, so a countdown can't tell them it's over. */
  function beep(count: number) {
    const context = audioRef.current;

    if (!context) {
      return;
    }

    for (let index = 0; index < count; index += 1) {
      const startAt = context.currentTime + index * 0.25;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.frequency.value = 660;
      gain.gain.value = 0.15;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.15);
    }
  }

  async function runCalibration() {
    abortRef.current = false;
    setError(null);
    setStage({ kind: "calibrating", remaining: CALIBRATION_SEC });
    // Time for the eyes to get from the button to the patient.
    await sleep(SETTLE_MS);

    const buffer: PresenceSample[] = [];
    recordingRef.current = buffer;

    for (let remaining = CALIBRATION_SEC; remaining > 0; remaining -= 1) {
      setStage({ kind: "calibrating", remaining });
      await sleep(1000);
    }

    recordingRef.current = null;
    setStage(null);

    if (abortRef.current) {
      return;
    }

    const result = calibrate(buffer);

    if (!result.ok) {
      setError(CALIBRATION_ERRORS[result.reason]);
      return;
    }

    setBaseline(result.baseline);
    // Earlier results were judged against the old resting position.
    setSamplesByStep({});
  }

  async function runSteps(steps: TestStep[]) {
    abortRef.current = false;
    setError(null);
    audioRef.current ??= new AudioContext();

    for (const step of steps) {
      for (let remaining = READY_SEC; remaining > 0; remaining -= 1) {
        setStage({ kind: "ready", step, remaining });
        await sleep(1000);

        if (abortRef.current) {
          setStage(null);
          return;
        }
      }

      beep(1);
      setStage({ kind: "recording", step, remaining: RECORD_SEC });
      await sleep(SETTLE_MS);

      const buffer: PresenceSample[] = [];
      recordingRef.current = buffer;

      for (let remaining = RECORD_SEC; remaining > 0; remaining -= 1) {
        setStage({ kind: "recording", step, remaining });
        await sleep(1000);

        if (abortRef.current) {
          recordingRef.current = null;
          setStage(null);
          return;
        }
      }

      recordingRef.current = null;
      beep(2);
      setSamplesByStep((previous) => ({ ...previous, [step.id]: buffer }));
    }

    setStage(null);
  }

  const live = recent[recent.length - 1] ?? null;
  const rolling = useMemo(
    () => (baseline && recent.length > 0 ? computeWindowMetrics(recent, baseline, thresholds) : null),
    [baseline, recent, thresholds],
  );
  const load = useMemo(() => measureLoad(recent), [recent]);

  // Derived rather than stored, so moving a slider re-judges a finished test.
  const results = useMemo(() => {
    if (!baseline) {
      return [];
    }

    return TEST_STEPS.flatMap((step) => {
      const samples = samplesByStep[step.id];

      if (!samples) {
        return [];
      }

      const metrics = computeWindowMetrics(samples, baseline, thresholds);
      return [{ step, metrics, passed: step.passes(metrics) }];
    });
  }, [baseline, samplesByStep, thresholds]);

  const passedCount = results.filter((result) => result.passed).length;

  function saveRun() {
    if (!baseline) {
      return;
    }

    setSavedRuns((previous) => [
      ...previous,
      {
        condition: condition.trim() || `Run ${previous.length + 1}`,
        passed: `${passedCount} of ${results.length}`,
        delegate,
        performance: load,
        longTasks,
        thresholds,
        baseline,
        steps: results.map(({ step, metrics, passed }) => ({
          id: step.id,
          expected: step.expected,
          passed,
          metrics,
        })),
      },
    ]);
    setCondition("");
  }

  async function copyRuns() {
    await navigator.clipboard.writeText(JSON.stringify(savedRuns, roundForExport, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const busy = stage !== null;
  const isFacing = live?.faceVisible && baseline ? !isHeadAway(live, baseline, thresholds) : null;

  return (
    <AppShell>
      <p className="eyebrow">Dev only · not shipped</p>
      <h1 className="display-md mt-1">Presence test bench</h1>
      <p className="mt-2 max-w-3xl text-[var(--color-ink-muted)]">
        Checks whether a webcam can tell if you&rsquo;re facing the patient, from the direction of
        your head. Video stays in this browser: nothing is recorded or uploaded, only numbers are
        kept, and they&rsquo;re gone when you close the page.
      </p>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-[var(--radius-sm)] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          {/* The patient stands where they would in a real scene, because that
              is what the trainee's eyes will be pointed at when it counts. */}
          <div className="relative aspect-[16/9] overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-muted)]">
            <Image src="/scenes/ward.webp" alt="" fill sizes="(min-width: 1024px) 800px, 100vw" className="object-cover" />
            <Image
              src="/avatars/woman-older/calm.webp"
              alt="The patient to look at"
              fill
              sizes="(min-width: 1024px) 800px, 100vw"
              className="object-contain object-bottom"
            />
            {/* Always mounted: the stream attaches to this element before it's shown. */}
            <video
              ref={videoRef}
              muted
              playsInline
              aria-label="Your camera"
              className={`absolute right-3 top-3 w-28 -scale-x-100 rounded-[var(--radius-sm)] border-2 border-[var(--color-surface)] shadow-[var(--shadow-card)] sm:w-40 ${
                cameraState === "off" ? "hidden" : ""
              }`}
            />
          </div>

          {/* Directly under the patient, where the scene's dialogue box sits, so
              the "reading their words" step sends the eyes to the same place. */}
          <div
            role="status"
            className="mt-3 flex min-h-[6.5rem] flex-col justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
          >
            {stage?.kind === "calibrating" ? (
              <>
                <p className="eyebrow">Calibrating · {stage.remaining}s</p>
                <p className="mt-1 text-lg font-semibold">Look at the patient&rsquo;s face and hold still.</p>
              </>
            ) : stage ? (
              <>
                <p className="eyebrow">
                  {stage.kind === "ready"
                    ? `Next: ${stage.step.title} · starts in ${stage.remaining}s, at the beep`
                    : `Recording: ${stage.step.title} · ${stage.remaining}s, two beeps to finish`}
                </p>
                <p className="mt-1 text-lg font-semibold">{stage.step.instruction}</p>
              </>
            ) : cameraState === "off" ? (
              <p className="text-[var(--color-ink-muted)]">Turn the camera on to begin.</p>
            ) : cameraState === "starting" ? (
              <p className="text-[var(--color-ink-muted)]">Loading the face model. The first time takes a few seconds.</p>
            ) : !baseline ? (
              <p className="text-[var(--color-ink-muted)]">Sit as you normally would, then calibrate.</p>
            ) : (
              <p className="text-[var(--color-ink-muted)]">
                Move around and watch the readings, or run the test. It takes about {Math.ceil((TEST_STEPS.length * (READY_SEC + RECORD_SEC + 1)) / 60)} minutes
                and beeps tell you when each step starts and ends.
              </p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {cameraState === "on" ? (
              <button type="button" className="btn-editorial btn-editorial--quiet" onClick={turnOffCamera}>
                Turn camera off
              </button>
            ) : (
              <button
                type="button"
                className="btn-editorial btn-editorial--accent"
                disabled={cameraState === "starting"}
                onClick={() => void turnOnCamera()}
              >
                {cameraState === "starting" ? "Starting…" : "Turn camera on"}
              </button>
            )}
            {cameraState === "on" && !busy ? (
              <button
                type="button"
                className={`btn-editorial ${baseline ? "btn-editorial--quiet" : "btn-editorial--accent"}`}
                onClick={() => void runCalibration()}
              >
                {baseline ? "Calibrate again" : "Calibrate"}
              </button>
            ) : null}
            {baseline && cameraState === "on" && !busy ? (
              <button
                type="button"
                className="btn-editorial btn-editorial--accent"
                onClick={() => void runSteps(TEST_STEPS)}
              >
                Run the test
              </button>
            ) : null}
            {busy ? (
              <button
                type="button"
                className="btn-editorial btn-editorial--quiet"
                onClick={() => {
                  abortRef.current = true;
                }}
              >
                Stop
              </button>
            ) : null}
          </div>
        </div>

        <aside className="min-w-0 space-y-4">
          <section className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
            <h2 className="eyebrow">Right now</h2>
            <div className="mt-1">
              <LiveReading
                label="Face"
                value={live ? (live.faceVisible ? "Visible" : "Not found") : "–"}
                tone={live ? (live.faceVisible ? "good" : "bad") : undefined}
              />
              <LiveReading
                label="Facing patient"
                value={isFacing === null ? "–" : isFacing ? "Yes" : "No"}
                tone={isFacing === null ? undefined : isFacing ? "good" : "bad"}
              />
              <LiveReading
                label="Head sideways"
                value={live?.faceVisible ? `${Math.round(live.yawDeg - (baseline?.yawDeg ?? 0))}°` : "–"}
              />
              <LiveReading
                label="Head up/down"
                value={live?.faceVisible ? `${Math.round(live.pitchDeg - (baseline?.pitchDeg ?? 0))}°` : "–"}
              />
            </div>
          </section>

          <section className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
            <h2 className="eyebrow">Last {RECENT_WINDOW_SEC} seconds</h2>
            <div className="mt-1">
              <LiveReading label="Facing patient" value={rolling ? percent(rolling.facingRatio) : "–"} />
              <LiveReading label="Look aways" value={rolling ? String(rolling.lookAwayCount) : "–"} />
              <LiveReading
                label="Longest look away"
                value={rolling ? `${rolling.longestLookAwaySec.toFixed(1)}s` : "–"}
              />
            </div>
          </section>

          <section className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
            <h2 className="eyebrow">Laptop load</h2>
            <div className="mt-1">
              <LiveReading label="Running on" value={delegate ?? "–"} />
              <LiveReading label="Model time, average" value={load ? `${Math.round(load.meanMs)} ms` : "–"} />
              <LiveReading label="Model time, slowest 5%" value={load ? `${Math.round(load.p95Ms)} ms` : "–"} />
              <LiveReading label="Readings per second" value={load ? load.samplesPerSec.toFixed(1) : "–"} />
              <LiveReading label="Page stalls over 50 ms" value={String(longTasks)} />
            </div>
          </section>
        </aside>
      </div>

      {results.length > 0 ? (
        <section className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold">Results</h2>
            <p className="text-sm text-[var(--color-ink-muted)]">
              Passed: <strong className="text-[var(--color-ink)]">{passedCount} of {results.length}</strong>
            </p>
          </div>

          <div className="mt-3 overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="border-b border-[var(--color-border)] text-[var(--color-ink-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Step</th>
                  <th className="px-3 py-2 font-medium">Should read</th>
                  <th className="px-3 py-2 font-medium">Facing</th>
                  <th className="px-3 py-2 font-medium">Look aways</th>
                  <th className="px-3 py-2 font-medium">Face seen</th>
                  <th className="px-3 py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {results.map(({ step, metrics, passed }) => (
                  <tr key={step.id} className="border-b border-[var(--color-border)] last:border-b-0">
                    <td className="px-3 py-2 font-medium">{step.title}</td>
                    <td className="px-3 py-2 text-[var(--color-ink-muted)]">{step.expected}</td>
                    <td className="px-3 py-2 tabular-nums">{percent(metrics.facingRatio)}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {metrics.lookAwayCount}
                      {metrics.lookAwayCount > 0 ? (
                        <span className="text-[var(--color-ink-muted)]"> (longest {metrics.longestLookAwaySec.toFixed(1)}s)</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{percent(metrics.faceVisibleRatio)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`font-semibold ${passed ? "text-[var(--color-primary)]" : "text-[var(--color-danger)]"}`}
                      >
                        {passed ? "Pass" : "Fail"}
                      </span>
                      {!busy && cameraState === "on" ? (
                        <button
                          type="button"
                          className="link-editorial ml-2 text-[var(--color-ink-muted)]"
                          onClick={() => void runSteps([step])}
                        >
                          Redo
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Outside the results section on purpose. Calibrating again clears the
          results, and that's exactly when someone changing setup wants to see
          what they've already saved. */}
      {results.length > 0 || savedRuns.length > 0 ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {results.length > 0 ? (
            <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
              <h3 className="eyebrow">Tune the thresholds</h3>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                Results above update as you move these, with no need to run the test again.
              </p>
              <div className="mt-3 space-y-3">
                <Slider
                  label="Head sideways allowed (°)"
                  value={thresholds.yawToleranceDeg}
                  min={5}
                  max={45}
                  step={1}
                  onChange={(value) => setThresholds((previous) => ({ ...previous, yawToleranceDeg: value }))}
                />
                <Slider
                  label="Head up/down allowed (°)"
                  value={thresholds.pitchToleranceDeg}
                  min={5}
                  max={40}
                  step={1}
                  onChange={(value) => setThresholds((previous) => ({ ...previous, pitchToleranceDeg: value }))}
                />
              </div>
            </div>
          ) : null}

          <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
            <h3 className="eyebrow">Compare setups</h3>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Save this run, then calibrate again and repeat with glasses, in dim light, or with someone else.
            </p>
            {results.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  type="text"
                  value={condition}
                  onChange={(event) => setCondition(event.target.value)}
                  placeholder="e.g. glasses, dim room"
                  aria-label="What was different about this run"
                  className="min-h-10 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-sm"
                />
                <button type="button" className="btn-editorial btn-editorial--solid" onClick={saveRun}>
                  Save run
                </button>
              </div>
            ) : null}

            {savedRuns.length > 0 ? (
              <>
                <ul className="mt-3 text-sm">
                  {savedRuns.map((run, index) => (
                    <li
                      key={`${run.condition}-${index}`}
                      className="flex justify-between gap-3 border-b border-[var(--color-border)] py-1.5 last:border-b-0"
                    >
                      <span className="min-w-0 truncate">{run.condition}</span>
                      <span className="shrink-0 tabular-nums text-[var(--color-ink-muted)]">
                        passed {run.passed}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn-editorial btn-editorial--quiet mt-3"
                  onClick={() => void copyRuns()}
                >
                  {copied ? "Copied" : "Copy saved runs as JSON"}
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
