"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  PreviewBubble,
  TYPED_WORD_DELAY_MS,
  usePrefersReducedMotion,
} from "@/components/preview/PreviewChat";
import { TypingIndicator } from "@/components/simulation/ChatMessageList";

// Hardcoded sample exchange. No AI calls, no storage.
const parentLine = "Nobody has told me anything for an hour. Is my daughter okay?";
const traineeLine =
  "I can hear how frightening this wait has been. Her results are back with the doctor now, and I'll come find you the moment we know more.";

// The dots stand for "the AI is composing", so they may only precede the parent
// line. The trainee reply just fades in and types, with no indicator.
const PHASE_DOTS = 0;
const PHASE_PARENT = 1;
const PHASE_TRAINEE = 2;
const PHASE_HOLD = 3;
const PHASE_COUNT = 4;

const traineeWordCount = traineeLine.split(" ").length;

// Index i holds the pause before advancing from phase i to phase i + 1,
// wrapping from PHASE_HOLD back to PHASE_DOTS.
const phaseDelaysMs = [
  1100,
  1300,
  traineeWordCount * TYPED_WORD_DELAY_MS + 400,
  2800,
];

/**
 * `floatingTag` is rendered inside the snippet's own width-constrained box so
 * it stays pinned to the card, not to the surrounding grid cell (which goes
 * full-width once the hero stacks on smaller screens).
 */
export function HeroChatSnippet({ floatingTag }: { floatingTag?: ReactNode }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOnScreen, setIsOnScreen] = useState(true);
  const [rawPhase, setRawPhase] = useState(PHASE_DOTS);
  // Reduced motion renders the settled two-bubble conversation, no loop.
  const phase = prefersReducedMotion ? PHASE_HOLD : rawPhase;

  useEffect(() => {
    const node = containerRef.current;

    if (!node || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsOnScreen(entry.isIntersecting),
      { threshold: 0.25 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // No timers while off-screen or when reduced motion is requested.
  useEffect(() => {
    if (prefersReducedMotion || !isOnScreen) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setRawPhase((current) => (current + 1) % PHASE_COUNT);
    }, phaseDelaysMs[rawPhase]);

    return () => window.clearTimeout(timer);
  }, [isOnScreen, prefersReducedMotion, rawPhase]);

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-[340px]">
      <Link
        href="/how-it-works"
        aria-label="See how FirstDropAI works"
        className="group block overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100"
      >
        {/* The floating tag sits over the right side of this row, so no label
            here — the whole card is the link, and the hero already has an
            explicit "See how it works" button. */}
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[rgba(255,255,255,0.7)] px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
            Live roleplay
          </p>
        </div>

        {/* Reserved height stops the hero from reflowing as the loop plays. */}
        <div
          aria-hidden
          className="flex min-h-[260px] flex-col justify-end gap-3 px-3 py-4"
        >
          {phase === PHASE_DOTS ? <TypingIndicator /> : null}

          {phase >= PHASE_PARENT ? (
            <PreviewBubble speaker="Parent" content={parentLine} isTrainee={false} typeOut={false} />
          ) : null}

          {phase >= PHASE_TRAINEE ? (
            <PreviewBubble
              speaker="Trainee"
              content={traineeLine}
              isTrainee
              typeOut={!prefersReducedMotion}
            />
          ) : null}
        </div>

        {/* The looping bubbles are aria-hidden; this is the stable text an
            assistive technology user gets instead. */}
        <p className="sr-only">
          A sample roleplay. Parent: {parentLine} Trainee: {traineeLine}
        </p>
      </Link>
      {floatingTag}
    </div>
  );
}
