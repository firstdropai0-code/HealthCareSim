"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  InfoCard,
  ReadMoreText,
  ScoreCard,
} from "@/components/common/VisualCards";
import { SubscoreBars } from "@/components/feedback/SubscoreBars";
import { EASE_OUT_CUBIC } from "@/components/motion/motionConfig";
import { useShouldAnimate } from "@/components/motion/useShouldAnimate";
import { resolveRespondedMessage } from "@/lib/feedback/betterResponses";
import type { BetterResponse, FeedbackReport } from "@/types/feedback";
import type { SimulationMessage } from "@/types/simulation";

const speakerLabels: Record<string, string> = {
  patient: "Patient",
  family_member: "Family member",
  nurse: "Nurse",
  bystander: "Bystander",
  narrator: "Narrator",
};

type FeedbackTone = "emerald" | "amber" | "rose" | "blue";

function scoreLabel(score: number): string {
  if (score >= 8) {
    return "Strong";
  }

  if (score >= 6) {
    return "Developing";
  }

  return "Needs focus";
}

function FeedbackItemGrid({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: FeedbackTone;
}) {
  return (
    <InfoCard label={label} title={`${items.length} notes`} tone={tone}>
      <div className="grid gap-2">
        {items.map((item) => (
          <div
            key={item}
            className="border-l border-[var(--color-border-strong)] px-3 py-2 text-[var(--color-ink)]"
          >
            <ReadMoreText text={item} maxLength={115} />
          </div>
        ))}
      </div>
    </InfoCard>
  );
}

/**
 * A suggested line shown against the moment it answers. The quoted line comes
 * from the transcript rather than the model's own paraphrase, so what is shown
 * is always something that was genuinely said; when a suggestion carries no
 * usable turn the card degrades to the bare line.
 */
function BetterResponseCard({
  entry,
  scenarioMessages,
}: {
  entry: BetterResponse;
  scenarioMessages: SimulationMessage[];
}) {
  const responded = resolveRespondedMessage(entry, scenarioMessages);
  const speaker = responded?.speaker ? speakerLabels[responded.speaker] : null;

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      {responded ? (
        <div className="border-b border-[var(--color-border)] bg-[var(--color-canvas-soft)] px-4 py-2.5">
          <p className="eyebrow eyebrow-tight text-[var(--color-ink-soft)]">
            {speaker ? `When the ${speaker.toLowerCase()} said` : "In response to"}
            {entry.respondsToTurn ? ` · turn ${entry.respondsToTurn}` : ""}
          </p>
          <p className="mt-1 text-[0.9375rem] italic leading-6 text-[var(--color-ink-muted)]">
            &ldquo;{responded.content}&rdquo;
          </p>
        </div>
      ) : null}
      <div className="border-l-4 border-l-[var(--color-primary)] px-4 py-3">
        <p className="eyebrow eyebrow-tight text-[var(--color-primary)]">
          You could have said
        </p>
        <div className="mt-1 text-[var(--color-ink)]">
          <ReadMoreText text={entry.suggestion} maxLength={160} />
        </div>
      </div>
    </div>
  );
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 ${direction === "left" ? "" : "rotate-180"}`}
      aria-hidden
    >
      <path d="M15 5 8 12l7 7" />
    </svg>
  );
}

/* A page turn: the outgoing leaf swings away and the incoming one swings in
   from the opposite edge, around the spine on the left. */
const pageVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 48 : -48,
    rotateY: direction > 0 ? 7 : -7,
  }),
  center: { opacity: 1, x: 0, rotateY: 0 },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -48 : 48,
    rotateY: direction > 0 ? -7 : 7,
  }),
};

type DeckPage = {
  id: string;
  /** Short name for the page indicator. */
  label: string;
  eyebrow: string;
  title: string;
  body: ReactNode;
};

function buildPages(
  report: FeedbackReport,
  scenarioMessages: SimulationMessage[],
): DeckPage[] {
  const score = Math.max(1, Math.min(10, report.overallScore));
  const topStrength = report.whatWentWell[0] || "Stayed engaged in the scenario.";
  const topFocus =
    report.whatCouldImprove[0] ||
    report.communicationGaps[0] ||
    "Use clearer structure in the next response.";
  const customCriteriaFeedback = report.customCriteriaFeedback || [];
  const deliveryFeedback = report.deliveryFeedback || [];

  const pages: DeckPage[] = [
    {
      id: "overview",
      label: "Overview",
      eyebrow: "At a glance",
      title: "How it went",
      body: (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <ScoreCard score={score} label={scoreLabel(score)} />
          <div className="space-y-4">
            <InfoCard label="Summary" title="Quick read" tone="slate">
              <ReadMoreText text={report.summary} maxLength={170} />
            </InfoCard>
            <div className="grid gap-3 md:grid-cols-2">
              <InfoCard label="Strength" title="What worked" tone="emerald">
                <ReadMoreText text={topStrength} maxLength={120} />
              </InfoCard>
              <InfoCard label="Improve" title="Next focus" tone="amber">
                <ReadMoreText text={topFocus} maxLength={120} />
              </InfoCard>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "detail",
      label: "Detail",
      eyebrow: "The full notes",
      title: "Went well, improve, gaps",
      body: (
        <div className="grid gap-4 lg:grid-cols-3">
          <FeedbackItemGrid
            label="What went well"
            items={report.whatWentWell}
            tone="emerald"
          />
          <FeedbackItemGrid
            label="Improve next time"
            items={report.whatCouldImprove}
            tone="amber"
          />
          <FeedbackItemGrid
            label="Watch gaps"
            items={report.communicationGaps}
            tone="rose"
          />
        </div>
      ),
    },
    {
      id: "examples",
      label: "Examples",
      eyebrow: "Example",
      title: "Better response examples",
      body: (
        <InfoCard label="Example" title="Lines you could have used" tone="blue">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-info-soft)] text-[0.6875rem] font-semibold text-[var(--color-info)]">
              FD
            </span>
            <span className="eyebrow text-[var(--color-info)]">FirstDrop Coach</span>
          </div>
          <div className="mt-4 grid gap-3">
            {report.betterResponses.map((item, index) => (
              <BetterResponseCard
                key={`better-${index}`}
                entry={item}
                scenarioMessages={scenarioMessages}
              />
            ))}
          </div>
        </InfoCard>
      ),
    },
  ];

  // Skills sits right after the overview it breaks down. Only present when the
  // model returned subscores, so reports generated before this existed — and
  // the fallback report, which deliberately has none — still render.
  if (report.subscores) {
    pages.splice(1, 0, {
      id: "skills",
      label: "Skills",
      eyebrow: "By dimension",
      title: "Where the score came from",
      body: (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <InfoCard label="Dimensions" title="Five communication skills" tone="slate">
            <SubscoreBars subscores={report.subscores} />
          </InfoCard>
          <InfoCard label="Reading this" title="What it means" tone="blue">
            <p className="text-[0.9375rem] leading-6">
              Each dimension is scored on its own, so being warm but unclear looks different
              from being clear but cold. These are what your progress tracks over time.
            </p>
            <p className="mt-3 text-xs leading-5 text-[var(--color-ink-soft)]">
              The overall score is a judgement of the whole conversation, not the average of
              these five.
            </p>
          </InfoCard>
        </div>
      ),
    });
  }

  // Conditional sections become pages only when they have content, so the deck
  // never turns to a blank leaf.
  if (deliveryFeedback.length > 0) {
    pages.push({
      id: "delivery",
      label: "Delivery",
      eyebrow: "Delivery",
      title: "How you sounded",
      body: (
        <InfoCard label="Delivery" title="How you sounded" tone="blue">
          <p className="text-xs leading-5 text-[var(--color-ink-soft)]">
            Measured from your spoken turns. These are cues about delivery, not a
            score — the overall score reflects what you said.
          </p>
          <div className="mt-3 grid gap-2">
            {deliveryFeedback.map((item, index) => (
              <div
                key={`delivery-${index}`}
                className="border-l border-[var(--color-border-strong)] px-3 py-2 text-[var(--color-ink)]"
              >
                <ReadMoreText text={item} maxLength={140} />
              </div>
            ))}
          </div>
        </InfoCard>
      ),
    });
  }

  if (customCriteriaFeedback.length > 0) {
    pages.push({
      id: "criteria",
      label: "Criteria",
      eyebrow: "Custom criteria",
      title: "Your added evaluation criteria",
      body: (
        <InfoCard
          label="Custom criteria"
          title="Your added evaluation criteria"
          tone="indigo"
        >
          <div className="grid gap-3 md:grid-cols-2">
            {customCriteriaFeedback.map((item) => (
              <div
                key={item.criterion}
                className="card-hover rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-3 text-[var(--color-ink)]"
              >
                <p className="eyebrow text-[var(--color-ink-muted)]">{item.criterion}</p>
                <div className="mt-1 text-sm leading-6">
                  <ReadMoreText text={item.assessment} maxLength={140} />
                </div>
              </div>
            ))}
          </div>
        </InfoCard>
      ),
    });
  }

  pages.push({
    id: "advice",
    label: "Carry forward",
    eyebrow: "Final advice",
    title: "Carry forward",
    body: (
      <InfoCard label="Final advice" title="Carry forward" tone="slate">
        <ReadMoreText text={report.finalAdvice} maxLength={170} />
      </InfoCard>
    ),
  });

  return pages;
}

export function FeedbackReportView({
  report,
  scenarioMessages = [],
}: {
  report: FeedbackReport;
  /** The scenario-side transcript, used to anchor suggested lines to a moment. */
  scenarioMessages?: SimulationMessage[];
}) {
  const shouldAnimate = useShouldAnimate();
  const pages = useMemo(
    () => buildPages(report, scenarioMessages),
    [report, scenarioMessages],
  );
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const deckRef = useRef<HTMLDivElement>(null);

  const safeIndex = Math.min(index, pages.length - 1);
  const page = pages[safeIndex];
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === pages.length - 1;

  function goTo(nextIndex: number) {
    const clamped = Math.max(0, Math.min(pages.length - 1, nextIndex));

    if (clamped === safeIndex) {
      return;
    }

    setDirection(clamped > safeIndex ? 1 : -1);
    setIndex(clamped);
  }

  // Arrow keys page the deck while it holds focus, so a keyboard user is not
  // forced through the buttons for every turn. Scoped to the deck rather than
  // the document so arrow keys keep working normally everywhere else.
  const pageCount = pages.length;

  useEffect(() => {
    const el = deckRef.current;

    if (!el) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;

      if (step === 0) {
        return;
      }

      event.preventDefault();
      setIndex((current) => {
        const next = Math.max(0, Math.min(pageCount - 1, current + step));
        if (next !== current) {
          setDirection(step);
        }
        return next;
      });
    }

    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [pageCount]);

  const pageBody = (
    <div className="px-4 py-5 sm:px-6">
      <p className="eyebrow text-[var(--color-primary)]">{page.eyebrow}</p>
      <h2 className="display-md mt-1.5">{page.title}</h2>
      <div className="mt-4">{page.body}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      {report.source === "fallback" ? (
        <div className="rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-warning)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm text-[var(--color-ink)]">
          {report.fallbackReason ||
            "Basic fallback feedback generated because Gemini feedback was unavailable."}
        </div>
      ) : null}

      <div
        ref={deckRef}
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label="Feedback report pages"
        className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]"
      >
        {/* The spine: a bound edge on the left, so turning a page reads as a
            book rather than a horizontal carousel. */}
        <div className="relative border-l-[3px] border-l-[var(--color-primary)]">
          <div
            className="min-h-[22rem]"
            style={shouldAnimate ? { perspective: "1400px" } : undefined}
          >
            {shouldAnimate ? (
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.div
                  key={page.id}
                  custom={direction}
                  variants={pageVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: EASE_OUT_CUBIC }}
                  style={{ transformOrigin: "left center" }}
                >
                  {pageBody}
                </motion.div>
              </AnimatePresence>
            ) : (
              pageBody
            )}
          </div>

          {/* Page controls sit with the pages they turn. */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-canvas-soft)] px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => goTo(safeIndex - 1)}
              disabled={isFirst}
              className="btn-editorial btn-editorial--quiet min-h-9 px-3 py-1.5 text-xs"
            >
              <ArrowIcon direction="left" />
              Previous
            </button>

            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {pages.map((entry, entryIndex) => {
                const isCurrent = entryIndex === safeIndex;

                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => goTo(entryIndex)}
                    aria-current={isCurrent ? "true" : undefined}
                    aria-label={`Go to ${entry.label}`}
                    className={`eyebrow eyebrow-tight min-h-7 rounded-full border px-2.5 py-1 transition-colors duration-200 ${
                      isCurrent
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]"
                        : "border-transparent text-[var(--color-ink-soft)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]"
                    }`}
                  >
                    {entry.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => goTo(safeIndex + 1)}
              disabled={isLast}
              className="btn-editorial btn-editorial--quiet min-h-9 px-3 py-1.5 text-xs"
            >
              Next
              <ArrowIcon direction="right" />
            </button>
          </div>
        </div>
      </div>

      <p className="text-center text-[0.8125rem] leading-4 text-[var(--color-ink-soft)]">
        Page {safeIndex + 1} of {pages.length} — use the arrows or arrow keys to turn.
      </p>
    </div>
  );
}
