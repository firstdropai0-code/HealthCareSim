"use client";

import { useReducedMotion } from "framer-motion";
import { useSyncExternalStore } from "react";

/**
 * Whether the document was visible when the app first rendered.
 *
 * Decided once, at module level, and never revised: animation frames are
 * suspended on a hidden document, so a component that starts at `opacity: 0`
 * and relies on an animation to become visible would stay invisible. A page
 * opened in a background tab would render blank. Callers therefore skip the
 * hidden start state entirely and render the settled state instead — nobody is
 * watching the entrance in that case anyway.
 *
 * Caching the answer also keeps the decision consistent for every component and
 * gives `useSyncExternalStore` the stable snapshot it requires.
 */
let wasVisibleAtStartup: boolean | null = null;

function getSnapshot(): boolean {
  if (wasVisibleAtStartup === null) {
    wasVisibleAtStartup = !document.hidden;
  }

  return wasVisibleAtStartup;
}

// The value never changes, so there is nothing to subscribe to.
function subscribe(): () => void {
  return () => {};
}

// Assume visible while server-rendering. React uses this during hydration and
// only then swaps to the client snapshot, so there is no hydration mismatch.
function getServerSnapshot(): boolean {
  return true;
}

/** True when entrance animations should actually run. */
export function useShouldAnimate(): boolean {
  const startedVisible = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const reducedMotion = useReducedMotion();

  return startedVisible && !reducedMotion;
}
