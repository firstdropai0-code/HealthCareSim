"use client";

import type { ReactNode } from "react";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { categoryLabel, useT, type Translator } from "@/lib/i18n/strings";
import { CLEAR_SCORE, type SkillNodeProgress } from "@/lib/progress/skillTree";
import { difficultyOrder } from "@/lib/scenarios/scenarioLibrary";
import type { AssignedCase } from "@/types/assignedCase";

/**
 * Every level is in exactly one of these, and each gets its own word, icon and
 * colour. The previous grid told them apart by dashed-versus-solid borders and
 * opacity alone, which nobody could read without being told the code.
 *
 * There is no "locked": any level with a case can be started. The order is a
 * suggestion, carried separately by `node.suggested`.
 */
type LevelStatus = "cleared" | "tried" | "open" | "none";

function statusOf(node: SkillNodeProgress | undefined): LevelStatus {
  if (!node || node.unset) {
    return "none";
  }

  if (node.cleared) {
    return "cleared";
  }

  return node.runCount > 0 ? "tried" : "open";
}

const statusStyles: Record<LevelStatus, { card: string; icon: string }> = {
  cleared: {
    card: "border-[var(--color-primary)] bg-[var(--color-primary-soft)]",
    icon: "bg-[var(--color-primary)] text-white",
  },
  tried: {
    card: "border-[var(--color-warning)] bg-[var(--color-surface)]",
    icon: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  },
  open: {
    card: "border-[var(--color-border-strong)] bg-[var(--color-surface)]",
    icon: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
  },
  none: {
    card: "border-dashed border-[var(--color-border)] bg-transparent opacity-70",
    icon: "bg-transparent text-[var(--color-ink-soft)]",
  },
};

function StatusGlyph({ status }: { status: LevelStatus }): ReactNode {
  const paths: Record<LevelStatus, ReactNode> = {
    cleared: <path d="m5 13 4 4L19 7" />,
    tried: <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
    open: <path d="M8 5.5v13l10-6.5-10-6.5Z" />,
    none: <path d="M6 12h12" />,
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-3.5 w-3.5"
    >
      {paths[status]}
    </svg>
  );
}

function StatusIcon({ status }: { status: LevelStatus }) {
  return (
    <span
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${statusStyles[status].icon}`}
    >
      <StatusGlyph status={status} />
    </span>
  );
}

/** The one line under the status: how it went here, and what clears it. */
function detailFor(t: Translator, node: SkillNodeProgress | undefined, status: LevelStatus): string {
  if (!node || status === "none") {
    return t("tree.detail.none");
  }

  // Best score, not the average: the best is what clears a level, so it is the
  // number that explains why a level is (or is not yet) cleared. Showing the
  // average beside a "cleared" tick read as a contradiction whenever an early
  // low score dragged it under 6.
  if (status === "cleared" && node.bestScore !== null) {
    return t("tree.detail.cleared", { score: node.bestScore });
  }

  if (status === "tried" && node.bestScore !== null) {
    return t("tree.detail.tried", { score: node.bestScore, target: CLEAR_SCORE });
  }

  return t("tree.detail.open", { target: CLEAR_SCORE });
}

function LevelCard({
  node,
  difficultyLabel,
  startCase,
  onStart,
}: {
  node: SkillNodeProgress | undefined;
  difficultyLabel: string;
  /** The case the button runs: the one they already tried here, if any. */
  startCase: AssignedCase | null;
  onStart?: (entry: AssignedCase) => void;
}) {
  const t = useT();
  const status = statusOf(node);
  const suggested = Boolean(node?.suggested);
  const canStart = Boolean(onStart && startCase) && status !== "none";

  return (
    <div
      className={`relative flex h-full flex-col rounded-[var(--radius-sm)] border p-3 ${statusStyles[status].card} ${
        suggested ? "ring-2 ring-[var(--color-primary)] ring-offset-1" : ""
      }`}
    >
      {suggested ? (
        <span className="eyebrow eyebrow-tight mb-2 self-start rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-white">
          {t("tree.suggested")}
        </span>
      ) : null}
      <div className="flex items-center gap-2">
        <StatusIcon status={status} />
        <div className="min-w-0">
          <p className="eyebrow eyebrow-tight text-[var(--color-ink-soft)]">{difficultyLabel}</p>
          <p className="text-sm font-semibold leading-5 text-[var(--color-ink)]">
            {t(`tree.status.${status}`)}
          </p>
        </div>
      </div>

      <p className="mt-2 text-[0.8125rem] leading-5 text-[var(--color-ink-muted)]">
        {detailFor(t, node, status)}
      </p>

      {/* Naming the case makes the button concrete: it is this conversation,
          not an abstract "level", that the trainee is about to walk into. */}
      {canStart && startCase ? (
        <div className="mt-auto pt-3">
          <p className="line-clamp-1 text-xs text-[var(--color-ink-soft)]" title={startCase.title}>
            {startCase.title}
          </p>
          <button
            type="button"
            onClick={() => onStart?.(startCase)}
            className={`btn-editorial mt-1.5 min-h-8 w-full justify-center px-2 py-1 text-xs ${
              suggested ? "btn-editorial--accent" : "btn-editorial--quiet"
            }`}
          >
            {status === "open"
              ? t("tree.start")
              : status === "tried"
                ? t("tree.tryAgain")
                : t("tree.practiseAgain")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function StepArrow() {
  return (
    <span aria-hidden className="hidden items-center text-[var(--color-border-strong)] sm:flex">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="m9 6 6 6-6 6" />
      </svg>
    </span>
  );
}

const legendOrder: LevelStatus[] = ["cleared", "tried", "open"];

/**
 * One card per track, its three levels laid out left to right from easiest to
 * hardest, so the suggested order reads from the layout before a word is read.
 * Every level with a case can be started; the arrows are advice, not a gate.
 * Deliberately no medals or badges — the rest of the product reads as a
 * clinical training tool, and a trophy case would undercut that.
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
  const t = useT();
  const allCategories = [...new Set(nodes.map((node) => node.category))];

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
        <p className="text-sm font-medium text-[var(--color-ink)]">{t("tree.emptyTitle")}</p>
        <p className="mt-1.5 text-xs leading-5 text-[var(--color-ink-soft)]">{t("tree.emptyBody")}</p>
      </div>
    );
  }

  // Levels with nothing in them are not something anyone can clear, so they
  // count in neither half of "x of y cleared".
  const liveNodes = nodes.filter((node) => categories.includes(node.category) && !node.unset);
  const clearedTotal = liveNodes.filter((node) => node.cleared).length;

  return (
    <div>
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-canvas-soft)] px-4 py-3">
        <p className="text-[0.9375rem] leading-6 text-[var(--color-ink)]">
          {t.rich("tree.overall", {
            done: <strong className="tabular-nums">{clearedTotal}</strong>,
            total: <strong className="tabular-nums">{liveNodes.length}</strong>,
          })}
        </p>
        <p className="mt-1 text-[0.8125rem] leading-5 text-[var(--color-ink-muted)]">
          {t("tree.rule", { score: CLEAR_SCORE })}
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2" aria-label={t("tree.legend")}>
          {legendOrder.map((status) => (
            <li key={status} className="flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
              <StatusIcon status={status} />
              {t(`tree.status.${status}`)}
            </li>
          ))}
          <li className="flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
            <span className="eyebrow eyebrow-tight rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-white">
              {t("tree.suggested")}
            </span>
            {t("tree.suggestedLegend")}
          </li>
        </ul>
      </div>

      <RevealGroup stagger={0.04} className="mt-4 grid gap-3">
        {categories.map((category) => {
          const row = difficultyOrder.map((difficulty) =>
            nodes.find((node) => node.category === category && node.difficulty === difficulty),
          );
          const live = row.filter((node) => node && !node.unset);
          const clearedHere = live.filter((node) => node?.cleared).length;

          return (
            <RevealItem key={category}>
              <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 className="text-[0.9375rem] font-semibold text-[var(--color-ink)]">
                    {categoryLabel(t, category)}
                  </h3>
                  <p className="text-xs tabular-nums text-[var(--color-ink-soft)]">
                    {t("tree.trackProgress", { done: clearedHere, total: live.length })}
                  </p>
                </div>

                <div className="mt-3 grid items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
                  {row.map((node, index) => {
                    const difficulty = difficultyOrder[index];

                    return [
                      index > 0 ? <StepArrow key={`${category}-arrow-${index}`} /> : null,
                      <LevelCard
                        key={`${category}-${difficulty}`}
                        node={node}
                        difficultyLabel={t(`difficulty.${difficulty}`)}
                        startCase={
                          node
                            ? (cases.find((entry) => entry.id === node.availableCaseIds[0]) ?? null)
                            : null
                        }
                        onStart={onStart}
                      />,
                    ];
                  })}
                </div>
              </section>
            </RevealItem>
          );
        })}
      </RevealGroup>

      {dormant.length > 0 ? (
        <p className="mt-3 text-xs leading-5 text-[var(--color-ink-soft)]">
          {t("tree.dormant", {
            tracks: dormant.map((category) => categoryLabel(t, category)).join(", "),
          })}
        </p>
      ) : null}
    </div>
  );
}
