"use client";

import { useSyncExternalStore } from "react";
import { useTypedWords } from "@/components/simulation/ChatMessageList";

export const TYPED_WORD_DELAY_MS = 55;

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// useSyncExternalStore keeps this SSR-safe and avoids a setState-in-effect pass.
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );
}

/**
 * A single mocked chat bubble matching ChatMessageList's styling. Shared by the
 * /how-it-works step-2 preview and the homepage hero snippet.
 */
export function PreviewBubble({
  speaker,
  content,
  isTrainee,
  typeOut,
}: {
  speaker: string;
  content: string;
  isTrainee: boolean;
  typeOut: boolean;
}) {
  const typed = useTypedWords(content, typeOut, TYPED_WORD_DELAY_MS);
  const shown = typeOut ? typed : content;

  return (
    <div className={` flex ${isTrainee ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[92%] rounded-[var(--radius-lg)] px-3.5 py-2.5 sm:max-w-md ${
          isTrainee
            ? "bg-[var(--color-primary)] text-white"
            : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[var(--shadow-card)]"
        }`}
      >
        <p
          className={`eyebrow ${
            isTrainee ? "text-white/75" : "text-[var(--color-ink-soft)]"
          }`}
        >
          {speaker}
        </p>
        <p className="mt-2 min-h-6 text-sm leading-6">{shown}</p>
      </div>
    </div>
  );
}
