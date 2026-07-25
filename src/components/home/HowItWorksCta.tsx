"use client";

import { useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-2.5 w-2.5" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

/**
 * The "see how it works" entry point. It sits next to the primary CTA, so it
 * carries a soft idle cue — a pulsing play badge and a periodic sheen — to
 * invite anyone who does not yet know what the app does.
 *
 * The cue retires the moment the control is hovered or focused: once it has
 * been noticed it has done its job, and a loop that never stops reads as noise
 * rather than an invitation.
 */
export function HowItWorksCta() {
  // Reduced motion is the only gate here. The stricter `useShouldAnimate`
  // guard exists to stop *content* being hidden behind an animation; this cue
  // is decoration layered over an already-visible button, and its CSS resumes
  // by itself if the page was opened in a background tab.
  const reducedMotion = useReducedMotion();
  const [noticed, setNoticed] = useState(false);

  const cueing = !reducedMotion && !noticed;

  return (
    <Link
      href="/how-it-works"
      className={`btn-editorial group gap-2.5 ${cueing ? "sheen-idle" : "sheen"}`}
      onPointerEnter={() => setNoticed(true)}
      onFocus={() => setNoticed(true)}
    >
      <span
        aria-hidden
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] transition-all duration-[350ms] ease-[cubic-bezier(0.215,0.61,0.355,1)] group-hover:scale-110 group-hover:bg-[var(--color-primary)] group-hover:text-white ${
          cueing ? "halo" : ""
        }`}
      >
        {/* Nudged right a hair: a triangle looks off-centre when centred. */}
        <span className="ml-px">
          <PlayIcon />
        </span>
      </span>
      See how it works
    </Link>
  );
}
