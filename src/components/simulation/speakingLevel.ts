/**
 * How loud the speaking character is right now, 0 to 1, sampled from the clip
 * as it plays. The stage's portrait ring reads it to pulse with the voice.
 *
 * An external store rather than React state for the same reason as the reveal
 * store: it changes every animation frame, and held as page state it would
 * re-render the entire simulation room sixty times a second. Only the ring
 * subscribes, through `useSyncExternalStore`, so only the ring repaints.
 */
export type SpeakingLevelStore = {
  subscribe(onChange: () => void): () => void;
  /** MUST return a number, or useSyncExternalStore re-renders forever. */
  getLevel(): number;
  setLevel(level: number): void;
};

/*
 * Below this a change is invisible as a ring, so it is not worth waking the
 * subscriber for. Keeps a near-silent pause from repainting every frame.
 */
const MIN_STEP = 0.02;

export function createSpeakingLevelStore(): SpeakingLevelStore {
  let level = 0;
  const listeners = new Set<() => void>();

  return {
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    getLevel() {
      return level;
    },
    setLevel(next) {
      const clamped = Math.max(0, Math.min(1, next));

      // Always let a return to silence through, so the ring never sticks lit.
      if (Math.abs(clamped - level) < MIN_STEP && clamped !== 0) {
        return;
      }

      level = clamped;
      listeners.forEach((listener) => listener());
    },
  };
}
