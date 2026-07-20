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
    <div className={`animate-fade-up flex ${isTrainee ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[92%] rounded-[1.25rem] px-4 py-3 shadow-[var(--shadow-card)] sm:max-w-md ${
          isTrainee
            ? "rounded-br-md bg-gradient-to-br from-[#12897d] via-[var(--color-primary)] to-[#0b4a45] text-white"
            : "rounded-bl-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)]"
        }`}
      >
        <p
          className={`text-xs font-semibold uppercase tracking-[0.12em] ${
            isTrainee ? "text-teal-50" : "text-[var(--color-ink-soft)]"
          }`}
        >
          {speaker}
        </p>
        <p className="mt-2 min-h-6 text-sm leading-6">{shown}</p>
      </div>
    </div>
  );
}
