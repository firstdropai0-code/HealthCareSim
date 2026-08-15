"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { useShouldAnimate } from "@/components/motion/useShouldAnimate";
import { CLEAR_SCORE, type SkillNodeProgress } from "@/lib/progress/skillTree";
import { difficultyMeta, difficultyOrder } from "@/lib/scenarios/scenarioLibrary";
import type { AssignedCase } from "@/types/assignedCase";

/** Both faces occupy the same box, so the flip cannot change the row height. */
const CELL_MIN_HEIGHT = "6.5rem";

/**
 * The back of a playable cell: what they scored here, and the way back in.
 * Reached by clicking the card; the button is what actually starts the run, so
 * a stray click on the card can never drop someone into a simulation.
 */
function RetryFace({
  node,
  entry,
  onStart,
  onClose,
}: {
  node: SkillNodeProgress;
  entry: AssignedCase;
  onStart: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full flex-col justify-between rounded-[var(--radius-sm)] border border-[var(--color-primary)] bg-[var(--color-surface)] p-3">
      <div>
        <div className="flex items-start justify-between gap-2">
          <p className="eyebrow eyebrow-tight text-[var(--color-primary)]">
            {node.bestScore === null ? "Not tried yet" : `Best ${node.bestScore}/10`}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-1 px-1.5 text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]"
          >
            &times;
          </button>
        </div>
        <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-5 text-[var(--color-ink-muted)]">
          {entry.title}
        </p>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="btn-editorial btn-editorial--accent mt-2 min-h-8 w-full justify-center px-2 py-1 text-xs"
      >
        {node.runCount > 0 ? "Try again" : "Start case"}
      </button>
    </div>
  );
}

function NodeCell({
  node,
  flipped,
  onFlip,
  retryCase,
  onStart,
}: {
  node: SkillNodeProgress;
  flipped: boolean;
  onFlip: (next: boolean) => void;
  retryCase: AssignedCase | null;
  onStart?: (entry: AssignedCase) => void;
}) {
  const meta = difficultyMeta[node.difficulty];
  const shouldAnimate = useShouldAnimate();

  // Nothing published here and nothing run. Whether it is "locked" is beside
  // the point — there is no case to attempt — so it stays quiet rather than
  // showing a requirement the trainee cannot act on.
  if (node.unset) {
    return (
      <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] bg-transparent p-3">
        <p className="eyebrow eyebrow-tight text-[var(--color-ink-soft)] opacity-60">
          {meta.label}
        </p>
        <p className="mt-1.5 text-[0.8125rem] leading-4 text-[var(--color-ink-soft)] opacity-60">
          Not set by your mentor
        </p>
      </div>
    );
  }

  if (!node.unlocked) {
    return (
      <div
        className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] p-3"
        title={node.lockedHint}
      >
        <p className="eyebrow eyebrow-tight text-[var(--color-ink-soft)]">{meta.label}</p>
        <p className="mt-1.5 text-xs leading-5 text-[var(--color-ink-soft)]">{node.lockedHint}</p>
        <p className="mt-1.5 text-[0.8125rem] leading-4 text-[var(--color-ink-soft)]">
          {node.availableCount} {node.availableCount === 1 ? "case" : "cases"} waiting
        </p>
      </div>
    );
  }

  const playable = Boolean(onStart && retryCase);

  const front = (
    <div
      className={`h-full rounded-[var(--radius-sm)] border p-3 transition-colors ${
        node.cleared
          ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
          : "border-[var(--color-border-strong)] bg-[var(--color-surface)]"
      } ${playable ? "hover:border-[var(--color-primary)]" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className={`eyebrow eyebrow-tight ${node.cleared ? "text-[var(--color-primary-ink)]" : "text-[var(--color-ink-soft)]"}`}>
          {meta.label}
        </p>
        {node.mastery !== null ? (
          <p className="text-xs font-semibold tabular-nums text-[var(--color-ink)]">
            {node.mastery.toFixed(1)}
          </p>
        ) : null}
      </div>

      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
        <div
          className="h-full origin-left rounded-full bg-[var(--color-primary)]"
          style={{ transform: `scaleX(${node.mastery === null ? 0 : node.mastery / 10})` }}
        />
      </div>

      <p className="mt-2 text-[0.8125rem] leading-4 text-[var(--color-ink-soft)]">
        {node.runCount === 0
          ? `${node.availableCount} ${node.availableCount === 1 ? "case" : "cases"} to try`
          : `${node.runCount} ${node.runCount === 1 ? "run" : "runs"}${
              node.availableCount > node.runCount
                ? ` · ${node.availableCount - node.runCount} more to try`
                : ""
            }`}
      </p>

      {playable ? (
        <p className="eyebrow eyebrow-tight mt-1.5 text-[var(--color-primary)]">
          {node.runCount > 0 ? "Tap to try again" : "Tap to start"}
        </p>
      ) : null}
    </div>
  );

  if (!playable || !retryCase || !onStart) {
    return <div style={{ minHeight: CELL_MIN_HEIGHT }}>{front}</div>;
  }

  const back = (
    <RetryFace
      node={node}
      entry={retryCase}
      onStart={() => onStart(retryCase)}
      onClose={() => onFlip(false)}
    />
  );

  // Without motion the faces simply swap: a half-rotated card left mid-flip by
  // a disabled transition would be unreadable.
  if (!shouldAnimate) {
    return (
      <div style={{ minHeight: CELL_MIN_HEIGHT }}>
        {flipped ? (
          back
        ) : (
          <button
            type="button"
            onClick={() => onFlip(true)}
            aria-expanded={flipped}
            className="block h-full w-full text-left"
          >
            {front}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: CELL_MIN_HEIGHT, perspective: "1000px" }}>
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d", minHeight: CELL_MIN_HEIGHT }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.45, ease: [0.215, 0.61, 0.355, 1] }}
      >
        <button
          type="button"
          onClick={() => onFlip(true)}
          aria-expanded={flipped}
          aria-hidden={flipped}
          tabIndex={flipped ? -1 : 0}
          className="absolute inset-0 block h-full w-full text-left"
          style={{ backfaceVisibility: "hidden" }}
        >
          {front}
        </button>

        <div
          className="absolute inset-0 h-full w-full"
          aria-hidden={!flipped}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          {back}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * One row per track, one column per tier. Deliberately no medals or badges —
 * the rest of the product reads as a clinical training tool, and a trophy case
 * would undercut that.
 */
export function SkillTree({
  nodes,
  cases = [],
  onStart,
}: {
  nodes: SkillNodeProgress[];
  cases?: AssignedCase[];
  /** Omitted on the mentor's view of a trainee, where cards stay read-only. */
  onStart?: (entry: AssignedCase) => void;
}) {
  const allCategories = [...new Set(nodes.map((node) => node.category))];
  // One card open at a time, so the row never turns into a wall of back faces.
  const [flippedId, setFlippedId] = useState<string | null>(null);

  // A track where the mentor has published nothing and the trainee has run
  // nothing is three empty cells. Listing those by name at the bottom keeps the
  // map honest without spending most of the page on rows that say nothing.
  const categories = allCategories.filter((category) =>
    nodes.some((node) => node.category === category && !node.unset),
  );
  const dormant = allCategories.filter((category) => !categories.includes(category));

  if (categories.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] p-6 text-center">
        <p className="text-sm font-medium text-[var(--color-ink)]">
          Your mentor has not set any cases yet.
        </p>
        <p className="mt-1.5 text-xs leading-5 text-[var(--color-ink-soft)]">
          Tracks appear here as cases are published to your group.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 hidden grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,1fr))] gap-2 sm:grid">
        <span />
        {difficultyOrder.map((difficulty) => (
          <span key={difficulty} className="eyebrow eyebrow-tight text-[var(--color-ink-soft)]">
            {difficultyMeta[difficulty].label}
          </span>
        ))}
      </div>

      <RevealGroup stagger={0.04} className="grid gap-3">
        {categories.map((category) => {
          const row = difficultyOrder.map((difficulty) =>
            nodes.find((node) => node.category === category && node.difficulty === difficulty),
          );

          return (
            <RevealItem key={category}>
              <div className="grid items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,1fr))]">
                <p className="self-center text-sm font-medium text-[var(--color-ink)]">{category}</p>
                {row.map((node, index) =>
                  node ? (
                    <NodeCell
                      key={node.id}
                      node={node}
                      flipped={flippedId === node.id}
                      onFlip={(next) => setFlippedId(next ? node.id : null)}
                      retryCase={
                        cases.find((entry) => entry.id === node.availableCaseIds[0]) ?? null
                      }
                      onStart={onStart}
                    />
                  ) : (
                    <div
                      key={`${category}-empty-${index}`}
                      className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] p-3"
                    >
                      <p className="text-[0.8125rem] leading-4 text-[var(--color-ink-soft)]">
                        No case at this level yet.
                      </p>
                    </div>
                  ),
                )}
              </div>
            </RevealItem>
          );
        })}
      </RevealGroup>

      <p className="mt-4 text-xs leading-5 text-[var(--color-ink-soft)]">
        Clear one case at a level with a score of {CLEAR_SCORE} or better to open the next level in
        that track. Three runs at a level open the next one everywhere.
      </p>

      {dormant.length > 0 ? (
        <p className="mt-2 text-xs leading-5 text-[var(--color-ink-soft)]">
          Not in your programme yet: {dormant.join(", ")}.
        </p>
      ) : null}
    </div>
  );
}
