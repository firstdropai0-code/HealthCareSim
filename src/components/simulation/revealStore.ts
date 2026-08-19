/**
 * Progressive text reveal for simulation turns.
 *
 * A turn's words appear either in time with the voice reading them aloud or,
 * when there is no audio, on a fixed timer. Both drive the same per-message
 * word count, which the transcript reads through `useSyncExternalStore`.
 *
 * Two invariants make every handover safe:
 *
 *  - The word count is monotonic. Every setter takes `max(current, next)`, so
 *    timer -> audio, audio -> timer on failure, stop -> complete, and slow
 *    audio catching up to a fast timer are all visually safe. Text can never
 *    jump backwards or freeze mid-word.
 *  - An unknown message id reveals as `Infinity`. Messages already on screen
 *    when the page loads, trainee messages, and anything never armed all
 *    render complete, which is why re-reading an old message can never
 *    re-hide its text.
 */

import { stripTraineePrompt } from "@/lib/ai/voiceDirection";

/** Fallback typing speed, and the speed the tail after the audio is revealed at. */
export const REVEAL_WORD_DELAY_MS = 55;

/** How many armed messages to keep. Older entries fall back to fully revealed. */
const MAX_TRACKED_MESSAGES = 4;

export type RevealCounts = {
  /** Words in the message as displayed, including any trailing trainee prompt. */
  totalWords: number;
  /** Words actually sent to the voice — always a prefix of the displayed text. */
  spokenWords: number;
};

/**
 * Split a message into what is displayed and what is actually spoken.
 *
 * `stripTraineePrompt` is anchored to the end of the string, so the spoken text
 * is always a strict prefix of the displayed text and the two counts can share
 * one word index. The same `split(" ")` tokenizer is used for both, and for the
 * display slice, so a ratio through the spoken words maps exactly onto words on
 * screen.
 */
export function countRevealWords(content: string): RevealCounts {
  const totalWords = content.split(" ").length;
  const spokenWords = stripTraineePrompt(content).split(" ").length;

  return { totalWords, spokenWords: Math.min(spokenWords, totalWords) };
}

export type RevealStore = {
  subscribe(messageId: string, onChange: () => void): () => void;
  /**
   * MUST return a number. Returning a fresh object here would make
   * useSyncExternalStore re-render forever.
   */
  getWordCount(messageId: string): number;

  /** Start tracking a message, hidden. Call before the setState that renders it. */
  arm(messageId: string, counts: RevealCounts): void;
  /** Reveal the remaining words on a fixed timer. */
  driveWithTimer(messageId: string, wordDelayMs?: number): void;
  /** Map playback progress (0-1 through the spoken prefix) onto the word count. */
  setAudioProgress(messageId: string, ratio: number): void;
  /** Audio is done: land on the spoken prefix, then time out the tail. */
  finishAudio(messageId: string): void;
  /** Reveal everything immediately and stop tracking progress. */
  complete(messageId: string): void;
  dispose(): void;
};

type RevealEntry = RevealCounts & {
  wordCount: number;
  timer: number | null;
};

export function createRevealStore(): RevealStore {
  const entries = new Map<string, RevealEntry>();
  const listeners = new Map<string, Set<() => void>>();
  /** Armed ids in arm order, so the oldest can be dropped. */
  const armedIds: string[] = [];

  function emit(messageId: string) {
    listeners.get(messageId)?.forEach((listener) => listener());
  }

  function clearTimer(entry: RevealEntry) {
    if (entry.timer !== null) {
      window.clearInterval(entry.timer);
      entry.timer = null;
    }
  }

  /** The one place the word count moves, and the one place it is clamped. */
  function setWordCount(messageId: string, next: number) {
    const entry = entries.get(messageId);

    if (!entry || next <= entry.wordCount) {
      return;
    }

    entry.wordCount = next;

    if (entry.wordCount >= entry.totalWords) {
      clearTimer(entry);
    }

    emit(messageId);
  }

  function forget(messageId: string) {
    const entry = entries.get(messageId);

    if (!entry) {
      return;
    }

    clearTimer(entry);
    entries.delete(messageId);
    // The id is now unknown, which reads as fully revealed.
    emit(messageId);
  }

  function driveWithTimer(messageId: string, wordDelayMs = REVEAL_WORD_DELAY_MS) {
    const entry = entries.get(messageId);

    if (!entry || entry.timer !== null || entry.wordCount >= entry.totalWords) {
      return;
    }

    entry.timer = window.setInterval(() => {
      const current = entries.get(messageId);

      if (!current) {
        return;
      }

      // Counts from wherever the reveal already is, so audio that ran ahead is
      // never rewound.
      setWordCount(messageId, current.wordCount + 1);
    }, wordDelayMs);
  }

  return {
    subscribe(messageId, onChange) {
      const existing = listeners.get(messageId) ?? new Set<() => void>();
      existing.add(onChange);
      listeners.set(messageId, existing);

      return () => {
        const current = listeners.get(messageId);
        current?.delete(onChange);

        if (current && current.size === 0) {
          listeners.delete(messageId);
        }
      };
    },

    getWordCount(messageId) {
      return entries.get(messageId)?.wordCount ?? Infinity;
    },

    arm(messageId, counts) {
      forget(messageId);

      // Drop any earlier position for this id, so re-arming cannot leave a
      // stale entry in the queue that later prunes the live one.
      const existingIndex = armedIds.indexOf(messageId);

      if (existingIndex !== -1) {
        armedIds.splice(existingIndex, 1);
      }

      entries.set(messageId, {
        totalWords: Math.max(1, counts.totalWords),
        spokenWords: Math.max(0, Math.min(counts.spokenWords, counts.totalWords)),
        wordCount: 0,
        timer: null,
      });
      armedIds.push(messageId);

      while (armedIds.length > MAX_TRACKED_MESSAGES) {
        forget(armedIds.shift() as string);
      }

      emit(messageId);
    },

    driveWithTimer,

    setAudioProgress(messageId, ratio) {
      const entry = entries.get(messageId);

      if (!entry) {
        return;
      }

      const clamped = Math.max(0, Math.min(1, ratio));
      setWordCount(messageId, Math.round(clamped * entry.spokenWords));
    },

    finishAudio(messageId) {
      const entry = entries.get(messageId);

      if (!entry) {
        return;
      }

      setWordCount(messageId, entry.spokenWords);
      // Anything past the spoken prefix is interface scaffolding ("What do you
      // say?"), so it lands after the character has stopped talking.
      driveWithTimer(messageId);
    },

    complete(messageId) {
      const entry = entries.get(messageId);

      if (!entry) {
        return;
      }

      clearTimer(entry);
      setWordCount(messageId, Infinity);
    },

    dispose() {
      entries.forEach(clearTimer);
      entries.clear();
      listeners.clear();
      armedIds.length = 0;
    },
  };
}

/**
 * A store that reveals everything, for transcripts that are only being read
 * back (the mentor run view). Stable identity so it can be a default prop.
 */
export const completedRevealStore: RevealStore = {
  subscribe: () => () => {},
  getWordCount: () => Infinity,
  arm: () => {},
  driveWithTimer: () => {},
  setAudioProgress: () => {},
  finishAudio: () => {},
  complete: () => {},
  dispose: () => {},
};
