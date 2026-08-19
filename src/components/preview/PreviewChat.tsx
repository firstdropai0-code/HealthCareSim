"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

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
 * Reveal `text` one word at a time on a fixed timer.
 *
 * Only the mocked marketing chats use this. The real simulation reveals its
 * turns from the reveal store instead, so the text can be paced by the voice
 * that is speaking it rather than by a constant.
 *
 * The disabled case is handled in the return value rather than by writing a
 * sentinel count from an effect: an effect that calls setState synchronously
 * cascades an extra render for every bubble on the page.
 */
function useTypedWords(text: string, enabled: boolean, wordDelayMs: number) {
  const words = text.split(" ");
  const wordCountTotal = words.length;
  const [wordCount, setWordCount] = useState(0);
  // Restart from the first word when the text itself changes. Adjusting state
  // during render is React's own answer to this; an effect would paint the
  // previous message's tail for a frame first.
  const [typedText, setTypedText] = useState(text);

  if (typedText !== text) {
    setTypedText(text);
    setWordCount(0);
  }

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let index = 0;
    const interval = window.setInterval(() => {
      index += 1;
      setWordCount(index);

      if (index >= wordCountTotal) {
        window.clearInterval(interval);
      }
    }, wordDelayMs);

    return () => window.clearInterval(interval);
  }, [text, enabled, wordDelayMs, wordCountTotal]);

  return enabled ? words.slice(0, wordCount).join(" ") : text;
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
  const shown = useTypedWords(content, typeOut, TYPED_WORD_DELAY_MS);

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
