"use client";

import { useT, type StringKey, type Translator } from "@/lib/i18n/strings";
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

type FeedbackTone = "emerald" | "amber" | "rose" | "blue";

/** Thresholds match `scoreBand` in progressModel, so bands read the same everywhere. */
function scoreLabel(t: Translator, score: number): string {
  if (score >= 8) {
    return t("band.strong");
  }

  if (score >= 6) {
    return t("band.developing");
  }

  return t("band.needsFocus");
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
  const t = useT();

  return (
    <InfoCard label={label} title={t("report.notes", { count: items.length })} tone={tone}>
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
  const t = useT();
  const responded = resolveRespondedMessage(entry, scenarioMessages);
  const speaker = responded?.speaker ? t(`speaker.${responded.speaker}` as StringKey) : null;

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      {responded ? (
        <div className="border-b border-[var(--color-border)] bg-[var(--color-canvas-soft)] px-4 py-2.5">
          <p className="eyebrow eyebrow-tight text-[var(--color-ink-soft)]">
            {speaker
              ? t("report.whenSaid", { speaker: speaker.toLowerCase() })
              : t("report.inResponseTo")}
            {entry.respondsToTurn ? t("report.turn", { n: entry.respondsToTurn }) : ""}
          </p>
          <p className="mt-1 text-[0.9375rem] italic leading-6 text-[var(--color-ink-muted)]">
            &ldquo;{responded.content}&rdquo;
          </p>
        </div>
      ) : null}
      <div className="border-l-4 border-l-[var(--color-primary)] px-4 py-3">
        <p className="eyebrow eyebrow-tight text-[var(--color-primary)]">
          {t("report.couldHaveSaid")}
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
  t: Translator,
): DeckPage[] {
  const score = Math.max(1, Math.min(10, report.overallScore));
  const topStrength = report.whatWentWell[0] || t("report.defaultStrength");
  const topFocus =
    report.whatCouldImprove[0] ||
    report.communicationGaps[0] ||
    t("report.defaultFocus");
  const customCriteriaFeedback = report.customCriteriaFeedback || [];
  const deliveryFeedback = report.deliveryFeedback || [];

  const pages: DeckPage[] = [
    {
      id: "overview",
      label: t("report.page.overview"),
      eyebrow: t("report.atAGlance"),
      title: t("report.howItWent"),
      body: (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <ScoreCard score={score} label={scoreLabel(t, score)} />
          <div className="space-y-4">
            <InfoCard label={t("report.summary")} title={t("report.quickRead")} tone="slate">
              <ReadMoreText text={report.summary} maxLength={170} />
            </InfoCard>
            <div className="grid gap-3 md:grid-cols-2">
              <InfoCard label={t("report.strength")} title={t("report.whatWorked")} tone="emerald">
                <ReadMoreText text={topStrength} maxLength={120} />
              </InfoCard>
              <InfoCard label={t("report.improve")} title={t("report.nextFocus")} tone="amber">
                <ReadMoreText text={topFocus} maxLength={120} />
              </InfoCard>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "detail",
      label: t("report.page.detail"),
      eyebrow: t("report.fullNotes"),
      title: t("report.detailTitle"),
      body: (
        <div className="grid gap-4 lg:grid-cols-3">
          <FeedbackItemGrid
            label={t("report.whatWentWell")}
            items={report.whatWentWell}
            tone="emerald"
          />
          <FeedbackItemGrid
            label={t("report.improveNextTime")}
            items={report.whatCouldImprove}
            tone="amber"
          />
          <FeedbackItemGrid
            label={t("report.watchGaps")}
            items={report.communicationGaps}
            tone="rose"
          />
        </div>
      ),
    },
    {
      id: "examples",
      label: t("report.page.examples"),
      eyebrow: t("report.example"),
      title: t("report.examplesTitle"),
      body: (
        <InfoCard label={t("report.example")} title={t("report.linesYouCouldHaveUsed")} tone="blue">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-info-soft)] text-[0.6875rem] font-semibold text-[var(--color-info)]">
              FD
            </span>
            <span className="eyebrow text-[var(--color-info)]">{t("report.coach")}</span>
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
      label: t("report.page.skills"),
      eyebrow: t("report.byDimension"),
      title: t("report.whereFrom"),
      body: (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <InfoCard label={t("report.dimensions")} title={t("report.fiveSkills")} tone="slate">
            <SubscoreBars subscores={report.subscores} />
          </InfoCard>
          <InfoCard label={t("report.readingThis")} title={t("report.whatItMeans")} tone="blue">
            <p className="text-[0.9375rem] leading-6">{t("report.dimensionsBody")}</p>
            <p className="mt-3 text-xs leading-5 text-[var(--color-ink-soft)]">
              {t("report.overallNote")}
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
      label: t("report.page.delivery"),
      eyebrow: t("report.delivery"),
      title: t("report.howYouSounded"),
      body: (
        <InfoCard label={t("report.delivery")} title={t("report.howYouSounded")} tone="blue">
          <p className="text-xs leading-5 text-[var(--color-ink-soft)]">
            {t("report.deliveryNote")}
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
      label: t("report.page.criteria"),
      eyebrow: t("report.customCriteria"),
      title: t("report.yourAddedCriteria"),
      body: (
        <InfoCard
          label={t("report.customCriteria")}
          title={t("report.yourAddedCriteria")}
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
    label: t("report.page.advice"),
    eyebrow: t("report.finalAdvice"),
    title: t("report.carryForward"),
    body: (
      <InfoCard label={t("report.finalAdvice")} title={t("report.carryForward")} tone="slate">
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
  const t = useT();
  const pages = useMemo(
    () => buildPages(report, scenarioMessages, t),
    // `t` changes identity only with the language, which is exactly when the
    // page labels have to be rebuilt.
    [report, scenarioMessages, t],
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
          {/* The route's own reason is English prose, so the reader gets the
              translated explanation instead of it. */}
          {t("feedback.fallback")}
        </div>
      ) : null}

      <div
        ref={deckRef}
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label={t("report.pages")}
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
              {t("common.previous")}
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
                    aria-label={t("report.goTo", { label: entry.label })}
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
              {t("common.next")}
              <ArrowIcon direction="right" />
            </button>
          </div>
        </div>
      </div>

      <p className="text-center text-[0.8125rem] leading-4 text-[var(--color-ink-soft)]">
        {t("report.pageOf", { n: safeIndex + 1, total: pages.length })}
      </p>
    </div>
  );
}
