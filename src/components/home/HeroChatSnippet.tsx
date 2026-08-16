"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DropGlyph } from "@/components/common/DropGlyph";
import { heroExchanges } from "@/components/home/heroExchanges";
import { EASE_OUT_CUBIC } from "@/components/motion/motionConfig";
import {
  PreviewBubble,
  TYPED_WORD_DELAY_MS,
  usePrefersReducedMotion,
} from "@/components/preview/PreviewChat";
import { TypingIndicator } from "@/components/simulation/ChatMessageList";

// The dots stand for "the AI is composing", so they may only precede the
// counterpart's line. The trainee reply just fades in and types.
const PHASE_DOTS = 0;
const PHASE_PROMPT = 1;
const PHASE_REPLY = 2;
const PHASE_HOLD = 3;
const PHASE_COUNT = 4;

/** Rises and fades in, and leaves upward so the swap reads as a scroll. */
const bubbleMotion = {
  initial: { opacity: 0, y: 14, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.98 },
  transition: { duration: 0.4, ease: EASE_OUT_CUBIC },
};

export function HeroChatSnippet({ floatingTag }: { floatingTag?: ReactNode }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOnScreen, setIsOnScreen] = useState(true);
  const [rawPhase, setRawPhase] = useState(PHASE_DOTS);
  const [index, setIndex] = useState(0);

  // Reduced motion renders one settled exchange and never loops.
  const phase = prefersReducedMotion ? PHASE_HOLD : rawPhase;
  const exchange = heroExchanges[index];

  // Memoised, or the effect below sees a new array every render and restarts
  // its timer each time instead of letting a phase run out.
  const phaseDelaysMs = useMemo(
    () => [
      1100,
      1500,
      exchange.reply.split(" ").length * TYPED_WORD_DELAY_MS + 600,
      3200,
    ],
    [exchange.reply],
  );

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
      setRawPhase((current) => {
        const next = (current + 1) % PHASE_COUNT;

        // Moving on to a new exchange: pick any other one, so the panel never
        // shows the same conversation twice running.
        if (next === PHASE_DOTS) {
          setIndex((currentIndex) => {
            const offset = 1 + Math.floor(Math.random() * (heroExchanges.length - 1));
            return (currentIndex + offset) % heroExchanges.length;
          });
        }

        return next;
      });
    }, phaseDelaysMs[rawPhase]);

    return () => window.clearTimeout(timer);
  }, [isOnScreen, phaseDelaysMs, prefersReducedMotion, rawPhase]);

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-[340px]">
      <Link
        href="/how-it-works"
        aria-label="See how FirstDropAI works"
        className="card-hover group block overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[var(--shadow-lift)]"
      >
        {/* A hairline accent along the top edge, plus a live dot. Enough to lift
            the card off the canvas without turning it into a coloured panel. */}
        <div aria-hidden className="h-[3px] w-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-mint)]" />

        <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-canvas-soft)] px-4 py-3">
          {/* The pulse is kept here and nowhere else: this panel really is
              updating as you watch, so the movement means something. */}
          <DropGlyph className={prefersReducedMotion ? "" : "halo"} />
          <p className="eyebrow text-[var(--color-ink-soft)]">Live roleplay</p>
        </div>

        {/* Reserved height stops the hero from reflowing as the loop plays. */}
        <div
          aria-hidden
          className="flex min-h-[280px] flex-col justify-end gap-3 px-3 py-4"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {phase === PHASE_DOTS ? (
              <motion.div key={`${exchange.id}-dots`} {...bubbleMotion}>
                <TypingIndicator />
              </motion.div>
            ) : null}

            {phase >= PHASE_PROMPT ? (
              <motion.div key={`${exchange.id}-prompt`} {...bubbleMotion}>
                <PreviewBubble
                  speaker={exchange.speaker}
                  content={exchange.prompt}
                  isTrainee={false}
                  typeOut={false}
                />
              </motion.div>
            ) : null}

            {phase >= PHASE_REPLY ? (
              <motion.div key={`${exchange.id}-reply`} {...bubbleMotion}>
                <PreviewBubble
                  speaker="Trainee"
                  content={exchange.reply}
                  isTrainee
                  typeOut={!prefersReducedMotion}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* The looping bubbles are aria-hidden; this is the stable text an
            assistive technology user gets instead. */}
        <p className="sr-only">
          A sample roleplay. {exchange.speaker}: {exchange.prompt} Trainee: {exchange.reply}
        </p>
      </Link>
      {floatingTag}
    </div>
  );
}
