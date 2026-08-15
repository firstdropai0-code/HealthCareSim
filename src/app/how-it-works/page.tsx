"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

// Everything below is hardcoded sample data for the static preview.
// No storage, no AI calls, no navigation into the real app.
const sampleScenario = {
  title: "Anxious parent in the ER",
  summary:
    "A parent waiting on test results for their child is growing frightened and impatient.",
  setting: "Emergency Department",
  traineeObjective: "Acknowledge the fear before explaining what happens next.",
  communicationChallenge:
    "Give an honest timeline without dismissing the worry behind the question.",
  patientEmotion: "Anxious",
};

const sampleMessages = [
  {
    id: "preview-1",
    speaker: "Parent",
    isTrainee: false,
    content:
      "Nobody has told me anything for an hour. Is my daughter going to be okay?",
  },
  {
    id: "preview-2",
    speaker: "Trainee",
    isTrainee: true,
    content:
      "I can hear how frightening this wait has been. Her results are back with the doctor now, and I'll come find you the moment we know more.",
  },
  {
    id: "preview-3",
    speaker: "Parent",
    isTrainee: false,
    content: "Okay. Just please don't forget about us in here.",
  },
];

const sampleFeedback = {
  score: 8,
  summary:
    "You led with the emotion and gave a concrete next step, which settled the conversation.",
  whatWentWell: [
    "Named the parent's fear before giving facts.",
    "Committed to a specific follow-up.",
  ],
  whatCouldImprove: [
    "Check understanding before moving on.",
    "Offer a rough timeframe for the update.",
  ],
};

const previewSteps = [
  {
    id: "scenario",
    label: "Scenario",
    caption:
      "You start from one rough idea and get a structured practice scenario.",
  },
  {
    id: "simulation",
    label: "Simulation",
    caption:
      "You roleplay the conversation turn by turn; the AI plays the patient, family, or nurse.",
  },
  {
    id: "feedback",
    label: "Feedback",
    caption: "You get scored, communication-focused coaching in seconds.",
  },
];

function ScenarioPreview() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
      <p className="eyebrow text-[var(--color-primary)]">Training brief</p>
      <h4 className="display-sm mt-3 text-[var(--color-ink)]">
        {sampleScenario.title}
      </h4>
      <p className="mt-3 text-sm leading-7 text-[var(--color-ink-muted)]">
        {sampleScenario.summary}
      </p>

      <div className="mt-6 grid gap-5 border-t border-[var(--color-border)] pt-5 sm:grid-cols-2">
        <div>
          <p className="eyebrow text-[var(--color-ink-soft)]">Setting</p>
          <p className="mt-2 text-sm leading-7 text-[var(--color-ink-muted)]">
            {sampleScenario.setting}
          </p>
        </div>
        <div>
          <p className="eyebrow text-[var(--color-primary)]">Goal</p>
          <p className="mt-2 text-sm leading-7 text-[var(--color-ink-muted)]">
            {sampleScenario.traineeObjective}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <p className="eyebrow text-[var(--color-warning)]">Challenge</p>
        <p className="mt-2 text-sm leading-7 text-[var(--color-ink-muted)]">
          {sampleScenario.communicationChallenge}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <MetricChip
          label="Patient"
          value={sampleScenario.patientEmotion}
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

const traineeWordCount = sampleMessages[1].content.split(" ").length;

// Index i holds the pause before advancing from phase i to phase i + 1.
const phaseDelaysMs = [
  250,
  900,
  1200,
  traineeWordCount * TYPED_WORD_DELAY_MS + 500,
];

function SimulationPreview() {
  const prefersReducedMotion = usePrefersReducedMotion();
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
  }, [prefersReducedMotion, rawPhase]);

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-canvas-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3.5">
        <div>
          <p className="eyebrow text-[var(--color-ink-soft)]">Live roleplay</p>
          <h4 className="display-sm mt-1.5 text-[var(--color-ink)]">
            Conversation
          </h4>
        </div>
        <MetricChip label="Speaker" value="Parent" tone="blue" />
      </div>

      {/* Reserved height keeps the frame from jumping as bubbles arrive. */}
      <div className="min-h-[320px] space-y-4 px-4 py-4">
        {phase >= PHASE_PARENT_1 ? (
          <PreviewBubble
            speaker={sampleMessages[0].speaker}
            content={sampleMessages[0].content}
            isTrainee={false}
            typeOut={false}
          />
        ) : null}

        {phase === PHASE_TYPING ? <TypingIndicator /> : null}

        {phase >= PHASE_TRAINEE ? (
          <PreviewBubble
            speaker={sampleMessages[1].speaker}
            content={sampleMessages[1].content}
            isTrainee
            typeOut={!prefersReducedMotion}
          />
        ) : null}

        {phase >= PHASE_PARENT_2 ? (
          <PreviewBubble
            speaker={sampleMessages[2].speaker}
            content={sampleMessages[2].content}
            isTrainee={false}
            typeOut={false}
          />
        ) : null}
      </div>
    </div>
  );
}

function FeedbackPreview() {
  return (
    <div className="grid gap-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)] lg:grid-cols-[200px_1fr]">
      <div>
        <ScoreCard score={sampleFeedback.score} label="Strong" />
      </div>

      <div className="space-y-3">
        <div>
          <InfoCard label="Summary" title="Quick read" tone="slate">
            <p className="text-sm leading-6">{sampleFeedback.summary}</p>
          </InfoCard>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <InfoCard label="What went well" tone="emerald">
            <ul className="grid gap-2">
              {sampleFeedback.whatWentWell.map((item) => (
                <li
                  key={item}
                  className="border-l border-[var(--color-border-strong)] px-3 py-2 text-sm leading-6 text-[var(--color-ink)]"
                >
                  {item}
                </li>
              ))}
            </ul>
          </InfoCard>
          <InfoCard label="What could improve" tone="amber">
            <ul className="grid gap-2">
              {sampleFeedback.whatCouldImprove.map((item) => (
                <li
                  key={item}
                  className="border-l border-[var(--color-border-strong)] px-3 py-2 text-sm leading-6 text-[var(--color-ink)]"
                >
                  {item}
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
              <span
                aria-hidden
                className="halo h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]"
              />
              How it works
            </p>
          </RevealItem>
          <RevealItem>
            <h1 className="display-xl mt-4 max-w-2xl">
              See it before you try it.
            </h1>
          </RevealItem>
          <RevealItem>
            <p className="lede mt-4 max-w-2xl">
              FirstDropAI is an AI roleplay room for practicing difficult
              healthcare conversations, with scored feedback in seconds.
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
                  Sample preview
                </p>
                <h2
                  id="preview-heading"
                  className="display-sm mt-2 text-[var(--color-ink)]"
                >
                  Step {stepIndex + 1} / {previewSteps.length} &middot;{" "}
                  {activeStep.label}
                </h2>
              </div>
              <MetricChip label="Example data" tone="slate" />
            </div>

            <div className="px-4 py-5 sm:px-5 sm:py-6">
              <h3 className="sr-only">{activeStep.label} preview</h3>
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
                      {activeStep.caption}
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
                aria-label="Preview steps"
              >
                {previewSteps.map((step, index) => {
                  const isActive = index === stepIndex;

                  return (
                    <button
                      key={step.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-label={`Step ${index + 1}: ${step.label}`}
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
                  Prev
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
                  Next
                </button>
              </div>
            </div>
          </section>
        </Reveal>

        <Section
          id="try"
          index={1}
          title="Your turn"
          description="Optional voice features: dictate your response with the mic, or have messages read aloud."
        >
          <RevealGroup className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <RevealItem className="card-hover accent-edge rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
              <h3 className="display-sm">Ready to practice</h3>
              <p className="mt-2 max-w-xl text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
                Start from a rough scenario idea and the app builds the training
                brief for you.
              </p>
              <Link
                href="/scenario"
                className="btn-editorial btn-editorial--accent sheen mt-5"
              >
                Try it yourself
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
