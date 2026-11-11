"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { calibrate, summariseWindow } from "@/lib/vision/presenceMetrics";
import { createPresenceTracker, type PresenceTracker } from "@/lib/vision/presenceTracker";
import type { PresenceBaseline, PresenceSample, TurnPresence } from "@/types/presence";

export type PresenceCameraPhase = "off" | "starting" | "calibrating" | "on";

export type PresenceCameraError =
  | "denied"
  | "no-camera"
  | "in-use"
  | "unavailable"
  | "model"
  | "face-not-visible"
  | "too-much-movement";

type WindowKind = "listening" | "speaking";

/* The same rate as voiceFeatureCollector. */
const SAMPLE_INTERVAL_MS = 100;
const CALIBRATION_SEC = 3;
/* Time for the eyes to get from the button to the scene. */
const CALIBRATION_SETTLE_MS = 1000;

/**
 * Whether to offer the camera at all.
 *
 * Off unless switched on, because main deploys straight to production: this is
 * what lets the code land before the tracking has been proven on real faces.
 * Written out in full because Next only inlines that exact expression, and it is
 * read at build time, so changing it on Vercel takes a redeploy. Every other part
 * of the feature hangs off this question being asked, so while it's off a run
 * collects nothing and its report has no Facing card.
 *
 * Not on a touch-only device: a phone is held in the hand, so its own movement
 * reads as the head moving, and none of this has been tried on one.
 */
export function canUsePresenceCamera(): boolean {
  return (
    process.env.NEXT_PUBLIC_CAMERA_COACHING === "on" &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    window.matchMedia?.("(pointer: fine)").matches
  );
}

function toCameraError(error: unknown): PresenceCameraError {
  const name = error instanceof DOMException ? error.name : "";

  if (name === "NotAllowedError" || name === "SecurityError") {
    return "denied";
  }

  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "no-camera";
  }

  return name === "NotReadableError" ? "in-use" : "unavailable";
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/* How often the picture is checked for having stopped. */
const SELF_VIEW_CHECK_MS = 2000;

/**
 * Keeps the trainee's own picture moving, and says why when it stopped.
 *
 * Reported from the first real use on the live site: the camera came on, the
 * picture froze on one frame, and everything else carried on. It could not be
 * reproduced with a stand-in feed, where the picture ran at full rate with no
 * pause, so the cause is something about a real webcam or browser that was not
 * visible from here. A picture stuck on its last frame is a video element that
 * has been paused or has stopped being given frames, and both can be answered
 * without knowing who did it: play it again, and failing that, hand it the
 * stream again.
 *
 * It matters beyond looks. The tracker reads this same element and skips any
 * frame it has already seen, so a stalled picture is also a run that silently
 * measures nothing.
 *
 * The one case it cannot help is the camera itself going quiet (the track is
 * muted: a privacy shutter, another app taking the device). That is logged and
 * left, since there is nothing here to restart.
 *
 * Returns the function that stops watching.
 */
function keepSelfViewRunning(video: HTMLVideoElement, stream: MediaStream): () => void {
  let lastFrames = -1;
  let stalledChecks = 0;
  let reported = false;

  const track = () => stream.getVideoTracks()[0];

  // Once per camera session: enough to learn the cause from a console, without
  // a line every two seconds for as long as it lasts.
  const report = (what: string) => {
    if (reported) {
      return;
    }

    reported = true;
    console.warn(`[camera] the self-view ${what}.`, {
      paused: video.paused,
      readyState: video.readyState,
      trackState: track()?.readyState,
      trackMuted: track()?.muted,
      tabHidden: document.hidden,
    });
  };

  const resume = () => {
    void video.play().catch(() => {
      // Nothing to do about a refusal; the next check tries again.
    });
  };

  const onPause = () => {
    // Our own stop empties the element first, so this is somebody else's pause.
    if (video.srcObject === stream) {
      report("was paused; playing it again");
      resume();
    }
  };

  const onMute = () => report("stopped receiving frames from the camera");

  video.addEventListener("pause", onPause);
  track()?.addEventListener("mute", onMute);

  const timer = window.setInterval(() => {
    const current = track();

    // A hidden tab is not painted, so it shows no new frames and nothing is wrong.
    if (document.hidden || video.srcObject !== stream || !current || current.readyState !== "live") {
      return;
    }

    if (video.paused) {
      report("was paused; playing it again");
      resume();
      return;
    }

    // Counted by the browser as frames reach the screen. Absent in a few older
    // browsers, where the pause check above is all there is.
    const frames = video.getVideoPlaybackQuality?.().totalVideoFrames ?? -1;

    if (frames < 0 || current.muted) {
      return;
    }

    if (frames === lastFrames) {
      stalledChecks += 1;
      report("stopped showing new frames; restarting it");

      if (stalledChecks === 1) {
        resume();
      } else if (stalledChecks === 2) {
        // Playing again was not enough, so give the element its stream afresh.
        // Once per stall, not on every check: a picture scrolled out of view
        // can also stop counting frames, and that must not turn into the
        // element being reset every two seconds.
        video.srcObject = null;
        video.srcObject = stream;
        resume();
      }
    } else {
      stalledChecks = 0;
    }

    lastFrames = frames;
  }, SELF_VIEW_CHECK_MS);

  return () => {
    window.clearInterval(timer);
    video.removeEventListener("pause", onPause);
    track()?.removeEventListener("mute", onMute);
  };
}

/**
 * The trainee's camera during a run: permission, calibration, and which way
 * their head was pointing while each line played and while they spoke.
 *
 * Every failure leaves the run exactly as it would be without a camera, and the
 * functions the run calls are harmless no-ops while the camera is off, so the
 * simulation never has to ask.
 *
 * Measures only while a line is playing or the trainee is recording, not in the
 * gap between. Looking away to think of a reply is normal, and "you turned away
 * while she was speaking" would simply be untrue of that time. It also keeps the
 * model, which runs on the main thread, off the scene's animation most of the time.
 */
export function usePresenceCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackerRef = useRef<PresenceTracker | null>(null);
  const timerRef = useRef<number | null>(null);
  const baselineRef = useRef<PresenceBaseline | null>(null);
  const calibrationRef = useRef<PresenceSample[] | null>(null);
  const activeWindowRef = useRef<WindowKind | null>(null);
  const windowsRef = useRef<Record<WindowKind, PresenceSample[]>>({ listening: [], speaking: [] });
  const readingTimerRef = useRef<number | null>(null);
  const stopWatchingSelfViewRef = useRef<(() => void) | null>(null);
  // Bumped by every stop, so a start still waiting on permission or the model
  // can tell it was abandoned instead of switching the camera back on.
  const attemptRef = useRef(0);

  const [phase, setPhase] = useState<PresenceCameraPhase>("off");
  const [error, setError] = useState<PresenceCameraError | null>(null);
  const [calibrationSecondsLeft, setCalibrationSecondsLeft] = useState(CALIBRATION_SEC);

  const clearReadingTimer = useCallback(() => {
    if (readingTimerRef.current !== null) {
      window.clearTimeout(readingTimerRef.current);
      readingTimerRef.current = null;
    }
  }, []);

  /* Leaves the baseline and the finished windows alone: turning the camera off
     mid-turn should not throw away what was already measured. */
  const release = useCallback(() => {
    attemptRef.current += 1;
    clearReadingTimer();
    activeWindowRef.current = null;
    calibrationRef.current = null;

    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Before the element is emptied below, or that would read as a stall.
    stopWatchingSelfViewRef.current?.();
    stopWatchingSelfViewRef.current = null;

    trackerRef.current?.close();
    trackerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [clearReadingTimer]);

  // The webcam light must go out the moment this page is left.
  useEffect(() => release, [release]);

  const stop = useCallback(() => {
    release();
    setError(null);
    setPhase("off");
  }, [release]);

  /** Permission, model, then calibration. True once the camera is measuring. */
  const start = useCallback(async (): Promise<boolean> => {
    release();
    const attempt = attemptRef.current;

    setError(null);
    setPhase("starting");

    const fail = (reason: PresenceCameraError) => {
      if (attempt === attemptRef.current) {
        release();
        setError(reason);
        setPhase("off");
      }

      return false;
    };

    let stream: MediaStream;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
    } catch (cameraError) {
      return fail(toCameraError(cameraError));
    }

    if (attempt !== attemptRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }

    streamRef.current = stream;
    // Permission revoked or the camera unplugged mid-run: the light is off, so
    // the page should stop saying otherwise.
    stream.getVideoTracks()[0]?.addEventListener("ended", stop);

    let tracker: PresenceTracker;

    try {
      const video = videoRef.current;

      if (!video) {
        throw new Error("Video element missing");
      }

      video.srcObject = stream;
      await video.play();
      stopWatchingSelfViewRef.current = keepSelfViewRunning(video, stream);
      tracker = await createPresenceTracker(video);
    } catch (loadError) {
      console.error("Face tracking failed to start:", loadError);
      return fail("model");
    }

    if (attempt !== attemptRef.current) {
      tracker.close();
      return false;
    }

    trackerRef.current = tracker;
    timerRef.current = window.setInterval(() => {
      const activeWindow = activeWindowRef.current;
      const target =
        calibrationRef.current ?? (activeWindow ? windowsRef.current[activeWindow] : null);

      // A hidden tab says nothing about the conversation it left behind.
      if (!target || document.hidden) {
        return;
      }

      const sample = tracker.sample();

      if (sample) {
        target.push(sample);
      }
    }, SAMPLE_INTERVAL_MS);

    setCalibrationSecondsLeft(CALIBRATION_SEC);
    setPhase("calibrating");
    await sleep(CALIBRATION_SETTLE_MS);

    const readings: PresenceSample[] = [];

    if (attempt === attemptRef.current) {
      calibrationRef.current = readings;
    }

    for (let remaining = CALIBRATION_SEC; remaining > 0; remaining -= 1) {
      if (attempt === attemptRef.current) {
        setCalibrationSecondsLeft(remaining);
      }

      await sleep(1000);
    }

    if (attempt !== attemptRef.current) {
      return false;
    }

    calibrationRef.current = null;

    const result = calibrate(readings);

    if (!result.ok) {
      return fail(result.reason);
    }

    baselineRef.current = result.baseline;
    setPhase("on");
    return true;
  }, [release, stop]);

  const beginWindow = useCallback(
    (kind: WindowKind) => {
      // A voice that took a while to arrive doesn't turn someone already
      // speaking back into a listener.
      if (kind === "listening" && activeWindowRef.current === "speaking") {
        return;
      }

      clearReadingTimer();
      activeWindowRef.current = kind;
    },
    [clearReadingTimer],
  );

  const endWindow = useCallback((kind: WindowKind) => {
    if (activeWindowRef.current === kind) {
      activeWindowRef.current = null;
    }
  }, []);

  /** A line nobody will speak aloud: the trainee is reading it for about this long. */
  const listenFor = useCallback(
    (ms: number) => {
      beginWindow("listening");

      if (activeWindowRef.current === "listening") {
        readingTimerRef.current = window.setTimeout(() => endWindow("listening"), ms);
      }
    },
    [beginWindow, endWindow],
  );

  const setSpeaking = useCallback(
    (recording: boolean) => {
      if (recording) {
        beginWindow("speaking");
      } else {
        endWindow("speaking");
      }
    },
    [beginWindow, endWindow],
  );

  /**
   * What this turn measured, ready to go on the trainee's message, or null when
   * there is nothing. Called only once the turn has succeeded, the same as the
   * voice metrics, so a failed send and its retry keep what was collected.
   */
  const takeTurnPresence = useCallback((): TurnPresence | null => {
    const baseline = baselineRef.current;
    const { listening, speaking } = windowsRef.current;

    clearReadingTimer();
    activeWindowRef.current = null;
    windowsRef.current = { listening: [], speaking: [] };

    if (!baseline) {
      return null;
    }

    const turn: TurnPresence = {
      listening: summariseWindow(listening, baseline),
      speaking: summariseWindow(speaking, baseline),
    };

    return turn.listening || turn.speaking ? turn : null;
  }, [clearReadingTimer]);

  return {
    videoRef,
    phase,
    error,
    calibrationSecondsLeft,
    start,
    stop,
    beginWindow,
    endWindow,
    listenFor,
    setSpeaking,
    takeTurnPresence,
  };
}
