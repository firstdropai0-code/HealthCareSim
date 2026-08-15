"use client";

import { useRef, useState } from "react";
import { MetricChip } from "@/components/common/VisualCards";

const VIDEO_SRC = "/how-to-use.mp4";
const POSTER_SRC = "/how-to-use-poster.jpg";
const DURATION_LABEL = "1:51";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5Z" />
    </svg>
  );
}

/**
 * Screen-recorded product walkthrough.
 *
 * The file is ~20 MB, so `preload="none"` keeps it off the wire until someone
 * actually presses play. That also means the browser has nothing to draw before
 * playback, which is why the poster image carries the frame on first paint.
 *
 * Native controls only appear once playback has started: before that the custom
 * overlay is the play affordance, so the two never sit on top of each other.
 */
export function WalkthroughVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStarted, setHasStarted] = useState(false);

  function startPlayback() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    setHasStarted(true);
    // Returns a rejected promise if the browser blocks playback; the native
    // controls are visible by then, so the user can still start it manually.
    void video.play().catch(() => undefined);
  }

  return (
    <section
      id="walkthrough"
      aria-labelledby="walkthrough-heading"
      className="accent-edge scroll-mt-20 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-canvas-soft)] px-5 py-3.5">
        <div>
          <p className="eyebrow text-[var(--color-ink-soft)]">Walkthrough</p>
          <h2
            id="walkthrough-heading"
            className="display-sm mt-2 text-[var(--color-ink)]"
          >
            Watch the full tour
          </h2>
        </div>
        <MetricChip label="Length" value={DURATION_LABEL} tone="slate" />
      </div>

      <div className="px-4 py-5 sm:px-5 sm:py-6">
        {/* aspect-video pins the frame at 16:9 so the card never reflows
            between the poster and the loaded video. */}
        <div className="relative aspect-video overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-canvas-soft)]">
          <video
            ref={videoRef}
            className="h-full w-full"
            src={VIDEO_SRC}
            poster={POSTER_SRC}
            preload="none"
            controls={hasStarted}
            playsInline
            onPlay={() => setHasStarted(true)}
          >
            Your browser does not support embedded video.{" "}
            <a href={VIDEO_SRC}>Download the walkthrough</a> instead.
          </video>

          {hasStarted ? null : (
            <button
              type="button"
              onClick={startPlayback}
              aria-label={`Play walkthrough video, ${DURATION_LABEL}`}
              className={`group absolute inset-0 grid place-items-center bg-black/5 transition-colors duration-300 hover:bg-black/10 ${focusRing}`}
            >
              <span className="inline-flex items-center gap-2.5 rounded-full border border-[var(--color-primary-strong)] bg-[var(--color-primary)] py-2.5 pl-4 pr-5 text-white shadow-[var(--shadow-accent)] transition-transform duration-[350ms] ease-[cubic-bezier(0.215,0.61,0.355,1)] group-hover:scale-105">
                <PlayIcon />
                <span className="text-[0.9375rem] font-semibold">
                  Play walkthrough
                </span>
              </span>
            </button>
          )}
        </div>

        <p className="mt-5 text-sm leading-7 text-[var(--color-ink-muted)]">
          A recorded tour of the whole flow — building a scenario, running the
          roleplay, and reading the feedback report.
        </p>
      </div>
    </section>
  );
}
