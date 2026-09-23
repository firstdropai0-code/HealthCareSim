"use client";

import { useSyncExternalStore } from "react";
import { isAppLanguage, type AppLanguage } from "@/types/language";

/**
 * The UI language preference, held in localStorage and read through
 * `useSyncExternalStore`.
 *
 * Deliberately NOT React state in a provider: the value has to be readable
 * during the first client render to avoid a flash of English, and a provider
 * seeded from an effect cannot do that. The server snapshot is always "en", so
 * the prerendered HTML and the first hydration pass agree; React then swaps to
 * the stored value immediately after hydrating. That is the same contract
 * `revealStore` uses.
 *
 * It is not on the user profile on purpose. A trainee's language is how they
 * want to read, not something a mentor assigns, and keeping it out of Firestore
 * means no rules change and no Console paste to try it.
 */
const STORAGE_KEY = "firstdrop.language";

const listeners = new Set<() => void>();

/** Mirrors localStorage so getSnapshot stays synchronous and cheap. */
let current: AppLanguage = "en";
let hydrated = false;

function readStored(): AppLanguage {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isAppLanguage(raw) ? raw : "en";
  } catch {
    // Private mode, blocked site data, or a sandboxed frame. English is a
    // working app, so a failed read is not worth surfacing.
    return "en";
  }
}

function subscribe(listener: () => void): () => void {
  if (!hydrated) {
    hydrated = true;
    current = readStored();
  }

  listeners.add(listener);

  // Another tab changing the preference should move this one too.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      current = readStored();
      listeners.forEach((notify) => notify());
    }
  };

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): AppLanguage {
  return current;
}

/** Always English, so prerendered HTML matches the first hydration pass. */
function getServerSnapshot(): AppLanguage {
  return "en";
}

export function useLanguage(): AppLanguage {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * The language outside React, for copy produced by library code -- an error a
 * repository throws, say -- where there is no hook to call.
 *
 * Reads the same mirror `useLanguage` does, so it is English until the first
 * subscriber has hydrated. That is the right answer rather than a gap: nothing
 * that calls this runs before hydration (it is all event handlers and fetch
 * callbacks), and reading localStorage directly here would let a string built
 * during the hydration render disagree with the server's English.
 */
export function getLanguage(): AppLanguage {
  return current;
}

export function setLanguage(next: AppLanguage): void {
  current = next;

  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // The choice still applies for this session; it just will not persist.
  }

  // Notify first so anything mounted repaints even if the reload below is
  // slow or blocked; the storage event also drives other tabs this way.
  listeners.forEach((notify) => notify());

  /*
   * Then reload.
   *
   * Re-rendering alone is not enough in practice. Pages fetch on mount keyed to
   * things like the active group, not the language, so a screen that had
   * already loaded could keep showing data gathered under the previous
   * language until it happened to refetch. Reloading makes every screen agree
   * on the language in one step rather than leaving each one to remember.
   *
   * `<html lang>` is not set here either: on its own that would be replayed by
   * nothing after a reload. AppShell owns it through an effect on the value.
   *
   * The cost is any unsaved in-page state. The simulation transcript itself
   * lives in localStorage and survives, but a half-typed response in the reply
   * box does not -- which is why this runs only from an explicit language
   * choice, never from anything automatic.
   */
  window.location.reload();
}

/*
 * The "this site is also in Hindi" callout under the language toggle.
 *
 * Shown only to someone who has never picked a language and never closed the
 * callout: once either has happened they know the switcher exists, and a
 * reminder on every visit would be noise. Both facts live in localStorage for
 * the same reason the preference does -- it is per browser, not per account.
 */
const HINT_DISMISSED_KEY = "firstdrop.languageHintDismissed";
const hintListeners = new Set<() => void>();

function readHintVisible(): boolean {
  try {
    return (
      window.localStorage.getItem(STORAGE_KEY) === null &&
      window.localStorage.getItem(HINT_DISMISSED_KEY) === null
    );
  } catch {
    // Storage blocked: the callout could never be dismissed for good, so it
    // is better not to show it at all than to show it on every page.
    return false;
  }
}

function subscribeHint(listener: () => void): () => void {
  hintListeners.add(listener);
  return () => {
    hintListeners.delete(listener);
  };
}

/** False on the server and during hydration, so the prerendered header never carries it. */
export function useLanguageHintVisible(): boolean {
  return useSyncExternalStore(subscribeHint, readHintVisible, () => false);
}

export function dismissLanguageHint(): void {
  try {
    window.localStorage.setItem(HINT_DISMISSED_KEY, "1");
  } catch {
    // Nothing to persist to; readHintVisible already hides it in this case.
  }

  hintListeners.forEach((notify) => notify());
}
