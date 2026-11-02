"use client";

import type { PresenceCameraError, PresenceCameraPhase } from "@/lib/hooks/usePresenceCamera";
import { useT, type StringKey } from "@/lib/i18n/strings";

const ERROR_KEYS: Record<PresenceCameraError, StringKey> = {
  denied: "simulation.camera.errorDenied",
  "no-camera": "simulation.camera.errorNoCamera",
  "in-use": "simulation.camera.errorInUse",
  unavailable: "simulation.camera.errorUnavailable",
  model: "simulation.camera.errorModel",
  "face-not-visible": "simulation.camera.errorNoFace",
  "too-much-movement": "simulation.camera.errorMoved",
};

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-5 w-5 shrink-0 text-[var(--color-primary)]"
    >
      <path d="M3 8a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="m16 10.5 5-3v9l-5-3" />
    </svg>
  );
}

/**
 * The question at the start of a run, sitting where the composer will be so the
 * scene stays in view: calibration asks the trainee to look at it.
 *
 * What the camera keeps and who sees it is said here, before the browser's own
 * prompt, because that prompt only ever says "use your camera". "Continue
 * without camera" stays available throughout, including during calibration: the
 * roleplay must never depend on any of this working.
 */
export function CameraOptIn({
  phase,
  error,
  secondsLeft,
  onTurnOn,
  onSkip,
}: {
  phase: PresenceCameraPhase;
  error: PresenceCameraError | null;
  secondsLeft: number;
  onTurnOn: () => void;
  onSkip: () => void;
}) {
  const t = useT();
  const inProgress = phase === "starting" || phase === "calibrating";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
      <div className="flex min-w-0 flex-1 basis-80 items-start gap-3">
        <CameraIcon />
        <div className="min-w-0">
          {inProgress ? (
            <p role="status" className="text-[0.9375rem] font-semibold leading-6 text-[var(--color-ink)]">
              {phase === "starting"
                ? t("simulation.camera.starting")
                : t("simulation.camera.calibrating", { n: secondsLeft })}
            </p>
          ) : (
            <>
              <p className="text-[0.9375rem] font-semibold leading-6 text-[var(--color-ink)]">
                {t("simulation.camera.title")}
              </p>
              <p className="mt-0.5 text-sm leading-5 text-[var(--color-ink-muted)]">{t("simulation.camera.body")}</p>
            </>
          )}
          {error && !inProgress ? (
            <p role="alert" className="mt-1.5 text-sm font-medium leading-5 text-[var(--color-danger)]">
              {t(ERROR_KEYS[error])}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {!inProgress ? (
          <button type="button" onClick={onTurnOn} className="btn-editorial btn-editorial--accent min-h-10">
            {error ? t("simulation.camera.tryAgain") : t("simulation.camera.turnOn")}
          </button>
        ) : null}
        <button type="button" onClick={onSkip} className="btn-editorial btn-editorial--quiet min-h-10">
          {t("simulation.camera.skip")}
        </button>
      </div>
    </div>
  );
}
