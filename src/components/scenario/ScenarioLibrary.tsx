"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { EASE_OUT_CUBIC, springSoft } from "@/components/motion/motionConfig";
import { useShouldAnimate } from "@/components/motion/useShouldAnimate";
import {
  difficultyMeta,
  difficultyOrder,
  pickRandomScenario,
  scenarioLibrary,
  type LibraryScenario,
  type ScenarioDifficulty,
} from "@/lib/scenarios/scenarioLibrary";

type Filter = ScenarioDifficulty | "all";

/**
 * False until React has finished hydrating, then true forever.
 *
 * The drawer portals into `document.body`, which is itself part of the tree the
 * App Router hydrates. Mounting the portal during the hydration render puts
 * nodes in `body` that the server never sent, which React reports as a
 * mismatch — so the portal waits for hydration to finish. `useSyncExternalStore`
 * is how that is expressed without a setState-in-effect.
 */
const subscribeToNothing = () => () => {};

function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

/** How long the shuffle reel flickers before it settles on a case. */
const REEL_DURATION_MS = 780;
const REEL_TICK_MS = 65;

/* Drawer motion. Spring in, short tween out — the panel should be gone the
   moment the trainer has chosen, but arrive with some weight. A transition
   inside a variant beats the `transition` prop, so the reduced-motion case has
   to be built into the variants rather than layered on top. */
function drawerVariants(animate: boolean): {
  backdrop: Variants;
  panel: Variants;
} {
  const instant = { duration: 0 };

  return {
    backdrop: {
      hidden: {
        opacity: 0,
        transition: animate ? { duration: 0.18, ease: EASE_OUT_CUBIC } : instant,
      },
      visible: {
        opacity: 1,
        transition: animate ? { duration: 0.22, ease: EASE_OUT_CUBIC } : instant,
      },
    },
    panel: {
      hidden: {
        x: "100%",
        transition: animate ? { duration: 0.24, ease: EASE_OUT_CUBIC } : instant,
      },
      visible: { x: 0, transition: animate ? springSoft : instant },
    },
  };
}

function BooksIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10v16H5.5A1.5 1.5 0 0 1 4 18.5Z" />
      <path d="M10 4h4.5A1.5 1.5 0 0 1 16 5.5v13a1.5 1.5 0 0 1-1.5 1.5H10Z" />
      <path d="m18 6 2.4 12.2" />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15l6 6" />
      <path d="M4 4l5 5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

function DifficultyChip({ difficulty }: { difficulty: ScenarioDifficulty }) {
  const meta = difficultyMeta[difficulty];

  return (
    <span
      className={`eyebrow eyebrow-tight inline-flex min-h-5 items-center gap-1.5 rounded-full border px-2 py-0.5 ${meta.chip}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function CaseCard({
  entry,
  isSelected,
  onSelect,
}: {
  entry: LibraryScenario;
  isSelected: boolean;
  onSelect: (entry: LibraryScenario) => void;
}) {
  const meta = difficultyMeta[entry.difficulty];

  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      aria-pressed={isSelected}
      aria-label={`Use ${entry.code}: ${entry.title}`}
      className={`card-hover relative w-full overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-4 pl-5 text-left shadow-[var(--shadow-card)] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-[''] ${meta.rule} ${
        isSelected
          ? "border-[var(--color-primary)] shadow-[var(--shadow-soft)]"
          : "border-[var(--color-border)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-num">{entry.code}</p>
          <h3 className="display-sm mt-1">{entry.title}</h3>
        </div>
        <DifficultyChip difficulty={entry.difficulty} />
      </div>

      <p className="mt-2 text-[0.8125rem] leading-6 text-[var(--color-ink-muted)]">
        {entry.summary}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="eyebrow eyebrow-tight text-[var(--color-ink-soft)]">
          {entry.category}
        </span>
        {entry.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-canvas-soft)] px-2 py-0.5 text-[0.6875rem] leading-5 text-[var(--color-ink-soft)]"
          >
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}

function LibraryDrawer({
  open,
  selectedId,
  onSelect,
  onClose,
}: {
  open: boolean;
  selectedId: string | null;
  onSelect: (entry: LibraryScenario) => void;
  onClose: () => void;
}) {
  const shouldAnimate = useShouldAnimate();
  const isHydrated = useIsHydrated();
  const panelRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const variants = drawerVariants(shouldAnimate);

  // Escape to close, and no background scrolling behind the panel.
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  const counts = useMemo(() => {
    return difficultyOrder.reduce<Record<ScenarioDifficulty, number>>(
      (totals, level) => {
        totals[level] = scenarioLibrary.filter(
          (entry) => entry.difficulty === level,
        ).length;
        return totals;
      },
      { foundational: 0, intermediate: 0, advanced: 0 },
    );
  }, []);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return scenarioLibrary.filter((entry) => {
      if (filter !== "all" && entry.difficulty !== filter) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return [entry.title, entry.summary, entry.category, entry.idea, ...entry.tags]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [filter, query]);

  const groups = useMemo(
    () =>
      difficultyOrder
        .map((level) => ({
          level,
          entries: results.filter((entry) => entry.difficulty === level),
        }))
        .filter((group) => group.entries.length > 0),
    [results],
  );

  // Nothing to portal into until hydration is done. The panel is only ever
  // opened by a click, so nothing is lost by sitting out the first render.
  if (!isHydrated) {
    return null;
  }

  const filters: Array<{ value: Filter; label: string; count: number }> = [
    { value: "all", label: "All", count: scenarioLibrary.length },
    ...difficultyOrder.map((level) => ({
      value: level as Filter,
      label: difficultyMeta[level].label,
      count: counts[level],
    })),
  ];

  // The panel stays mounted and moves between open and closed rather than
  // unmounting: `inert` keeps it out of tab order and away from screen readers
  // while closed, and there is no exit animation to coordinate.
  //
  // With animation off the shells are plain elements positioned by class. The
  // open state must never be reachable only by an animation having run — a
  // motion component in a document that has never been visible gets no frame,
  // and the panel would stay off screen.
  const Wrapper = shouldAnimate ? motion.div : "div";
  const Backdrop = shouldAnimate ? motion.button : "button";
  const Panel = shouldAnimate ? motion.div : "div";

  const motionProps = shouldAnimate
    ? {
        wrapper: { initial: false as const, animate: open ? "visible" : "hidden" },
        backdrop: { variants: variants.backdrop },
        panel: { variants: variants.panel },
      }
    : {
        wrapper: {},
        backdrop: { style: { opacity: open ? 1 : 0 } },
        panel: { style: { transform: open ? "none" : "translateX(100%)" } },
      };

  return createPortal(
    <Wrapper
      className="fixed inset-0 z-50 overflow-hidden"
      inert={open ? undefined : true}
      aria-hidden={open ? undefined : true}
      style={{ pointerEvents: open ? "auto" : "none" }}
      {...motionProps.wrapper}
    >
      <Backdrop
        type="button"
        aria-label="Close scenario library"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        className="absolute inset-0 h-full w-full cursor-default bg-[rgba(22,33,30,0.32)] backdrop-blur-[2px]"
        {...motionProps.backdrop}
      />

      <Panel
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scenario-library-title"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full max-w-[30rem] flex-col border-l border-[var(--color-border-strong)] bg-[var(--color-canvas)] shadow-[var(--shadow-lift)] outline-none"
        {...motionProps.panel}
      >
        <header className="accent-edge border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow text-[var(--color-primary)]">Scenario library</p>
              <h2 id="scenario-library-title" className="display-md mt-1.5">
                Pick a case study
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close scenario library"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              <CloseIcon />
            </button>
          </div>

          <p className="mt-2 text-xs leading-5 text-[var(--color-ink-soft)]">
            Choosing a case fills the idea box. You can still edit it before generating.
          </p>

          <div className="mt-4 flex items-center gap-2 border border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] px-3 transition focus-within:border-[var(--color-ink)] focus-within:bg-white">
            <span className="text-[var(--color-ink-soft)]">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cases, tags, or settings"
              aria-label="Search the scenario library"
              className="min-h-10 w-full bg-transparent text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-soft)]"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {filters.map((option) => {
              const isActive = filter === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  aria-pressed={isActive}
                  className={`eyebrow eyebrow-tight inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors duration-200 ${
                    isActive
                      ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  {option.value !== "all" ? (
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 rounded-full ${difficultyMeta[option.value].dot}`}
                    />
                  ) : null}
                  {option.label}
                  <span className="tabular-nums opacity-60">{option.count}</span>
                </button>
              );
            })}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {groups.length === 0 ? (
            <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] px-4 py-6 text-center text-sm text-[var(--color-ink-soft)]">
              No cases match that search.
            </p>
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <section key={group.level} className="space-y-3">
                  <div className="flex items-baseline justify-between gap-3 border-b border-[var(--color-border)] pb-2">
                    <p className="eyebrow text-[var(--color-ink)]">
                      {difficultyMeta[group.level].label}
                    </p>
                    <p className="text-[0.6875rem] leading-5 text-[var(--color-ink-soft)]">
                      {difficultyMeta[group.level].blurb}
                    </p>
                  </div>
                  {group.entries.map((entry) => (
                    <CaseCard
                      key={entry.id}
                      entry={entry}
                      isSelected={entry.id === selectedId}
                      onSelect={onSelect}
                    />
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </Wrapper>,
    document.body,
  );
}

/**
 * Entry point for the case library: a browse button, a shuffle reel that lands
 * on a random case, and the slide-in picker itself.
 */
export function ScenarioLibraryBar({
  selectedId,
  onSelect,
  disabled = false,
}: {
  selectedId: string | null;
  onSelect: (entry: LibraryScenario) => void;
  disabled?: boolean;
}) {
  const shouldAnimate = useShouldAnimate();
  const [open, setOpen] = useState(false);
  const [reelIndex, setReelIndex] = useState<number | null>(null);
  const timers = useRef<{ tick?: number; stop?: number }>({});

  const selected = useMemo(
    () => scenarioLibrary.find((entry) => entry.id === selectedId) ?? null,
    [selectedId],
  );

  useEffect(() => {
    const pending = timers.current;

    return () => {
      window.clearInterval(pending.tick);
      window.clearTimeout(pending.stop);
    };
  }, []);

  function commitPick(entry: LibraryScenario | null) {
    if (entry) {
      onSelect(entry);
    }
  }

  function handleShuffle() {
    if (reelIndex !== null) {
      return;
    }

    const pick = pickRandomScenario(scenarioLibrary, selectedId ?? undefined);

    // Reduced motion (or a hidden tab) gets the result without the flicker.
    if (!shouldAnimate) {
      commitPick(pick);
      return;
    }

    setReelIndex(Math.floor(Math.random() * scenarioLibrary.length));

    timers.current.tick = window.setInterval(() => {
      setReelIndex(Math.floor(Math.random() * scenarioLibrary.length));
    }, REEL_TICK_MS);

    timers.current.stop = window.setTimeout(() => {
      window.clearInterval(timers.current.tick);
      setReelIndex(null);
      commitPick(pick);
    }, REEL_DURATION_MS);
  }

  const isSpinning = reelIndex !== null;
  const reelEntry = isSpinning ? scenarioLibrary[reelIndex] : selected;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="btn-editorial sheen-idle min-h-9 px-3 py-1.5 text-xs"
      >
        <BooksIcon />
        Case library
        <span className="tabular-nums text-[var(--color-ink-soft)]">
          {scenarioLibrary.length}
        </span>
      </button>

      <button
        type="button"
        onClick={handleShuffle}
        disabled={disabled || isSpinning}
        aria-label="Load a random case from the library"
        className="btn-editorial btn-editorial--quiet min-h-9 px-3 py-1.5 text-xs"
      >
        <motion.span
          className="inline-flex"
          animate={shouldAnimate && isSpinning ? { rotate: 360 } : { rotate: 0 }}
          transition={
            isSpinning
              ? { duration: 0.6, ease: "linear", repeat: Infinity }
              : { duration: 0.2 }
          }
        >
          <ShuffleIcon />
        </motion.span>
        Surprise me
      </button>

      {/* The reel: flickers case names while spinning, then holds the pick.
          Takes its own row on narrow screens — squeezed between the two
          buttons there is no room left to read the case name. */}
      <div
        aria-live="polite"
        className={`flex min-w-0 items-center gap-2 overflow-hidden sm:min-h-9 sm:flex-1 ${
          reelEntry ? "min-h-9 basis-full sm:basis-0" : "basis-0"
        }`}
      >
        {reelEntry ? (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={reelEntry.id}
              initial={shouldAnimate ? { opacity: 0, y: 6 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldAnimate ? { opacity: 0, y: -6 } : undefined}
              transition={{ duration: 0.16, ease: EASE_OUT_CUBIC }}
              className="inline-flex min-w-0 items-center gap-2 truncate text-xs text-[var(--color-ink-muted)]"
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${difficultyMeta[reelEntry.difficulty].dot}`}
              />
              <span className="section-num shrink-0">{reelEntry.code}</span>
              <span className="truncate">{reelEntry.title}</span>
            </motion.span>
          </AnimatePresence>
        ) : null}
      </div>

      <LibraryDrawer
        open={open}
        selectedId={selectedId}
        onSelect={(entry) => {
          onSelect(entry);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
