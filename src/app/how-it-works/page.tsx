"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DropGlyph } from "@/components/common/DropGlyph";
import { SafetyNotice } from "@/components/common/SafetyNotice";
import {
  InfoCard,
  MetricChip,
  ScoreCard,
} from "@/components/common/VisualCards";
import { AnimatePresence, motion } from "framer-motion";
import { Section } from "@/components/editorial/Section";
import { WalkthroughVideo } from "@/components/howItWorks/WalkthroughVideo";
import { AppShell } from "@/components/layout/AppShell";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { EASE_OUT_CUBIC, springSnappy } from "@/components/motion/motionConfig";
import { useShouldAnimate } from "@/components/motion/useShouldAnimate";
import {
  PreviewBubble,
  TYPED_WORD_DELAY_MS,
  usePrefersReducedMotion,
} from "@/components/preview/PreviewChat";
import { TypingIndicator } from "@/components/simulation/ChatMessageList";
import { useT, type StringKey } from "@/lib/i18n/strings";

// Everything below is hardcoded sample data for the static preview.
// No storage, no AI calls, no navigation into the real app. The words are
// dictionary keys (`how.sample.*`) so the preview reads in the chosen language.
const sampleMessages: { id: string; speaker: StringKey; isTrainee: boolean; content: StringKey }[] = [
  { id: "preview-1", speaker: "how.sample.parent", isTrainee: false, content: "how.sample.msg1" },
  { id: "preview-2", speaker: "how.sample.trainee", isTrainee: true, content: "how.sample.msg2" },
  { id: "preview-3", speaker: "how.sample.parent", isTrainee: false, content: "how.sample.msg3" },
];

const sampleScore = 8;
const sampleWentWell: StringKey[] = ["how.sample.well1", "how.sample.well2"];
const sampleCouldImprove: StringKey[] = ["how.sample.improve1", "how.sample.improve2"];

const previewSteps: { id: string; label: StringKey; caption: StringKey }[] = [
  { id: "scenario", label: "how.step.scenario", caption: "how.step.scenarioCaption" },
  { id: "simulation", label: "how.step.simulation", caption: "how.step.simulationCaption" },
  { id: "feedback", label: "how.step.feedback", caption: "how.step.feedbackCaption" },
];

function ScenarioPreview() {
  const t = useT();

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
      <p className="eyebrow text-[var(--color-primary)]">{t("how.trainingBrief")}</p>
      <h4 className="display-sm mt-3 text-[var(--color-ink)]">
        {t("how.sample.title")}
      </h4>
      <p className="mt-3 text-sm leading-7 text-[var(--color-ink-muted)]">
        {t("how.sample.summary")}
      </p>

      <div className="mt-6 grid gap-5 border-t border-[var(--color-border)] pt-5 sm:grid-cols-2">
        <div>
          <p className="eyebrow text-[var(--color-ink-soft)]">{t("how.setting")}</p>
          <p className="mt-2 text-sm leading-7 text-[var(--color-ink-muted)]">
            {t("how.sample.setting")}
          </p>
        </div>
        <div>
          <p className="eyebrow text-[var(--color-primary)]">{t("how.goal")}</p>
          <p className="mt-2 text-sm leading-7 text-[var(--color-ink-muted)]">
            {t("how.sample.objective")}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <p className="eyebrow text-[var(--color-warning)]">{t("how.challenge")}</p>
        <p className="mt-2 text-sm leading-7 text-[var(--color-ink-muted)]">
          {t("how.sample.challenge")}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <MetricChip
          label={t("how.patient")}
          value={t("how.sample.emotion")}
          tone="amber"
        />
      </div>
    </div>
  );
}

// Playback phases for the sample conversation. The component is mounted only
// while step 2 is active, so leaving and returning replays from PHASE_START.
const PHASE_START = 0;
const PHASE_PARENT_1 = 1;
const PHASE_TYPING = 2;
const PHASE_TRAINEE = 3;
const PHASE_PARENT_2 = 4;

function SimulationPreview() {
  const t = useT();
  const prefersReducedMotion = usePrefersReducedMotion();
  // Counted from the translated reply, so the pause before the parent's second
  // line fits the words actually being typed in this language.
  const traineeWordCount = t(sampleMessages[1].content).split(" ").length;
  // Index i holds the pause before advancing from phase i to phase i + 1.
  // Memoised, or the effect below sees a new array every render and restarts
  // its timer instead of letting a phase run out.
  const phaseDelaysMs = useMemo(
    () => [250, 900, 1200, traineeWordCount * TYPED_WORD_DELAY_MS + 500],
    [traineeWordCount],
  );
  const [rawPhase, setRawPhase] = useState(PHASE_START);
  // Reduced motion jumps straight to the settled end state.
  const phase = prefersReducedMotion ? PHASE_PARENT_2 : rawPhase;

  useEffect(() => {
    if (prefersReducedMotion || rawPhase >= PHASE_PARENT_2) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setRawPhase((current) => current + 1);
    }, phaseDelaysMs[rawPhase]);

    return () => window.clearTimeout(timer);
  }, [phaseDelaysMs, prefersReducedMotion, rawPhase]);

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-canvas-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3.5">
        <div>
          <p className="eyebrow text-[var(--color-ink-soft)]">{t("how.live")}</p>
          <h4 className="display-sm mt-1.5 text-[var(--color-ink)]">
            {t("how.conversation")}
          </h4>
        </div>
        <MetricChip label={t("how.speaker")} value={t("how.sample.parent")} tone="blue" />
      </div>

      {/* Reserved height keeps the frame from jumping as bubbles arrive. */}
      <div className="min-h-[320px] space-y-4 px-4 py-4">
        {phase >= PHASE_PARENT_1 ? (
          <PreviewBubble
            speaker={t(sampleMessages[0].speaker)}
            content={t(sampleMessages[0].content)}
            isTrainee={false}
            typeOut={false}
          />
        ) : null}

        {phase === PHASE_TYPING ? <TypingIndicator /> : null}

        {phase >= PHASE_TRAINEE ? (
          <PreviewBubble
            speaker={t(sampleMessages[1].speaker)}
            content={t(sampleMessages[1].content)}
            isTrainee
            typeOut={!prefersReducedMotion}
          />
        ) : null}

        {phase >= PHASE_PARENT_2 ? (
          <PreviewBubble
            speaker={t(sampleMessages[2].speaker)}
            content={t(sampleMessages[2].content)}
            isTrainee={false}
            typeOut={false}
          />
        ) : null}
      </div>
    </div>
  );
}

function FeedbackPreview() {
  const t = useT();

  return (
    <div className="grid gap-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)] lg:grid-cols-[200px_1fr]">
      <div>
        <ScoreCard score={sampleScore} label={t("how.strong")} />
      </div>

      <div className="space-y-3">
        <div>
          <InfoCard label={t("how.summary")} title={t("how.quickRead")} tone="slate">
            <p className="text-sm leading-6">{t("how.sample.feedbackSummary")}</p>
          </InfoCard>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <InfoCard label={t("how.whatWentWell")} tone="emerald">
            <ul className="grid gap-2">
              {sampleWentWell.map((item) => (
                <li
                  key={item}
                  className="border-l border-[var(--color-border-strong)] px-3 py-2 text-sm leading-6 text-[var(--color-ink)]"
                >
                  {t(item)}
                </li>
              ))}
            </ul>
          </InfoCard>
          <InfoCard label={t("how.whatCouldImprove")} tone="amber">
            <ul className="grid gap-2">
              {sampleCouldImprove.map((item) => (
                <li
                  key={item}
                  className="border-l border-[var(--color-border-strong)] px-3 py-2 text-sm leading-6 text-[var(--color-ink)]"
                >
                  {t(item)}
                </li>
              ))}
            </ul>
          </InfoCard>
        </div>
      </div>
    </div>
  );
}

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]";

export default function HowItWorksPage() {
  const shouldAnimate = useShouldAnimate();
  const t = useT();
  const [stepIndex, setStepIndex] = useState(0);
  const activeStep = previewSteps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === previewSteps.length - 1;

  return (
    <AppShell>
      <div className="space-y-12">
        <RevealGroup as="header" stagger={0.08}>
          <RevealItem>
            <p className="eyebrow inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[var(--color-primary)] shadow-[var(--shadow-card)]">
              <DropGlyph />
              {t("how.eyebrow")}
            </p>
          </RevealItem>
          <RevealItem>
            <h1 className="display-xl mt-4 max-w-2xl">
              {t("how.title")}
            </h1>
          </RevealItem>
          <RevealItem>
            <p className="lede mt-4 max-w-2xl">
              {t("how.lede")}
            </p>
          </RevealItem>
        </RevealGroup>

        <Reveal>
          <WalkthroughVideo />
        </Reveal>

        {/* Static, fully mocked preview — sample data only. */}
        <Reveal>
          <section
            aria-labelledby="preview-heading"
            className="accent-edge overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-canvas-soft)] px-5 py-3.5">
              <div>
                <p className="eyebrow text-[var(--color-ink-soft)]">
                  {t("how.samplePreview")}
                </p>
                <h2
                  id="preview-heading"
                  className="display-sm mt-2 text-[var(--color-ink)]"
                >
                  {t("how.stepHeading", {
                    n: stepIndex + 1,
                    total: previewSteps.length,
                    label: t(activeStep.label),
                  })}
                </h2>
              </div>
              <MetricChip label={t("how.exampleData")} tone="slate" />
            </div>

            <div className="px-4 py-5 sm:px-5 sm:py-6">
              <h3 className="sr-only">{t("how.stepPreview", { label: t(activeStep.label) })}</h3>
              {/* Each branch is a distinct component, so switching steps remounts
 it and restarts that step's entrance animation from the top.
 `mode="wait"` lets the outgoing step clear before the next
 arrives, which keeps the panel from jumping mid-swap. */}
              {(() => {
                const stepBody = (
                  <>
                    {stepIndex === 0 ? <ScenarioPreview /> : null}
                    {stepIndex === 1 ? <SimulationPreview /> : null}
                    {stepIndex === 2 ? <FeedbackPreview /> : null}

                    <p className="mt-5 text-sm leading-7 text-[var(--color-ink-muted)]">
                      {t(activeStep.caption)}
                    </p>
                  </>
                );

                // Without animation the step content renders plainly, so the
                // preview is never blank.
                if (!shouldAnimate) {
                  return <div key={activeStep.id}>{stepBody}</div>;
                }

                return (
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={activeStep.id}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.28, ease: EASE_OUT_CUBIC }}
                    >
                      {stepBody}
                    </motion.div>
                  </AnimatePresence>
                );
              })()}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-5 py-4">
              <div
                className="flex items-center gap-2"
                role="tablist"
                aria-label={t("how.previewSteps")}
              >
                {previewSteps.map((step, index) => {
                  const isActive = index === stepIndex;

                  return (
                    <button
                      key={step.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-label={t("how.stepAria", { n: index + 1, label: t(step.label) })}
                      onClick={() => setStepIndex(index)}
                      className={`relative h-1.5 rounded-full transition-all duration-[350ms] ease-[cubic-bezier(0.215,0.61,0.355,1)] ${focusRing} ${
                        isActive
                          ? "w-7"
                          : "w-4 bg-[var(--color-border-strong)] hover:bg-[var(--color-ink-soft)]"
                      }`}
                    >
                      {isActive ? (
                        <motion.span
                          layoutId="step-dot"
                          className="absolute inset-0 rounded-full bg-[var(--color-primary)]"
                          transition={springSnappy}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setStepIndex((current) => Math.max(0, current - 1))
                  }
                  disabled={isFirst}
                  className={`btn-editorial btn-editorial--quiet disabled:pointer-events-none ${focusRing}`}
                >
                  {t("common.prev")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setStepIndex((current) =>
                      Math.min(previewSteps.length - 1, current + 1),
                    )
                  }
                  disabled={isLast}
                  className={`btn-editorial btn-editorial--accent disabled:pointer-events-none ${focusRing}`}
                >
                  {t("common.next")}
                </button>
              </div>
            </div>
          </section>
        </Reveal>

        <Section
          id="try"
          index={1}
          title={t("how.yourTurn")}
          description={t("how.yourTurnDescription")}
        >
          <RevealGroup className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <RevealItem className="card-hover accent-edge rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
              <h3 className="display-sm">{t("how.ready")}</h3>
              <p className="mt-2 max-w-xl text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
                {t("how.readyBody")}
              </p>
              <Link
                href="/scenario"
                className="btn-editorial btn-editorial--accent sheen mt-5"
              >
                {t("how.tryIt")}
              </Link>
            </RevealItem>

            <RevealItem>
              <SafetyNotice />
            </RevealItem>
          </RevealGroup>
        </Section>
      </div>
    </AppShell>
  );
}
