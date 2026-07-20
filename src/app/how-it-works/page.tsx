"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SafetyNotice } from "@/components/common/SafetyNotice";
import { InfoCard, MetricChip, ScoreCard } from "@/components/common/VisualCards";
import { AppShell } from "@/components/layout/AppShell";
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
  summary: "A parent waiting on test results for their child is growing frightened and impatient.",
  setting: "Emergency Department",
  traineeObjective: "Acknowledge the fear before explaining what happens next.",
  communicationChallenge: "Give an honest timeline without dismissing the worry behind the question.",
  patientEmotion: "Anxious",
};

const sampleMessages = [
  {
    id: "preview-1",
    speaker: "Parent",
    isTrainee: false,
    content: "Nobody has told me anything for an hour. Is my daughter going to be okay?",
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
  summary: "You led with the emotion and gave a concrete next step, which settled the conversation.",
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
    caption: "You start from one rough idea and get a structured practice scenario.",
  },
  {
    id: "simulation",
    label: "Simulation",
    caption: "You roleplay the conversation turn by turn; the AI plays the patient, family, or nurse.",
  },
  {
    id: "feedback",
    label: "Feedback",
    caption: "You get scored, communication-focused coaching in seconds.",
  },
];

function ScenarioPreview() {
  return (
    <div className="animate-fade-up rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-primary-strong)]">
        Training brief
      </p>
      <h4 className="animate-fade-up mt-1 text-base font-semibold text-[var(--color-ink)]">
        {sampleScenario.title}
      </h4>
      <p className="animate-fade-up animate-fade-up-1 mt-1 text-sm leading-6 text-[var(--color-ink-muted)]">
        {sampleScenario.summary}
      </p>

      <div className="animate-fade-up animate-fade-up-2 mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
            Setting
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--color-ink-muted)]">{sampleScenario.setting}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-primary-strong)]">
            Goal
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--color-ink-muted)]">
            {sampleScenario.traineeObjective}
          </p>
        </div>
      </div>

      <div className="animate-fade-up animate-fade-up-3 mt-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Challenge</p>
        <p className="mt-1 text-sm leading-6 text-[var(--color-ink-muted)]">
          {sampleScenario.communicationChallenge}
        </p>
      </div>

      <div className="animate-fade-up animate-fade-up-4 mt-3 flex flex-wrap gap-2">
        <MetricChip label="Patient" value={sampleScenario.patientEmotion} tone="amber" />
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
    <div className="animate-fade-up overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
            Live roleplay
          </p>
          <h4 className="text-base font-semibold text-[var(--color-ink)]">Conversation</h4>
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
    <div className="animate-fade-up grid gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)] lg:grid-cols-[200px_1fr]">
      <div className="animate-fade-up">
        <ScoreCard score={sampleFeedback.score} label="Strong" />
      </div>

      <div className="space-y-3">
        <div className="animate-fade-up animate-fade-up-1">
          <InfoCard label="Summary" title="Quick read" tone="slate">
            <p className="text-sm leading-6">{sampleFeedback.summary}</p>
          </InfoCard>
        </div>

        <div className="animate-fade-up animate-fade-up-3 grid gap-3 md:grid-cols-2">
          <InfoCard label="What went well" tone="emerald">
            <ul className="grid gap-2">
              {sampleFeedback.whatWentWell.map((item) => (
                <li
                  key={item}
                  className="rounded-2xl bg-[var(--color-surface-muted)] px-3 py-2 text-sm leading-6 text-[var(--color-ink)]"
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
                  className="rounded-2xl bg-[var(--color-surface-muted)] px-3 py-2 text-sm leading-6 text-[var(--color-ink)]"
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
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 focus-visible:border-[var(--color-primary)]";

export default function HowItWorksPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const activeStep = previewSteps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === previewSteps.length - 1;

  return (
    <AppShell>
      <div className="animate-fade-up space-y-6">
        <header>
          <p className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-primary-strong)] shadow-sm">
            How it works
          </p>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
            See it before you try it
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-ink-muted)] sm:text-base sm:leading-7">
            FirstDropAI is an AI roleplay room for practicing difficult healthcare conversations,
            with scored feedback in seconds.
          </p>
        </header>

        {/* Static, fully mocked preview — sample data only. */}
        <section
          aria-labelledby="preview-heading"
          className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] shadow-[var(--shadow-soft)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[rgba(255,255,255,0.7)] px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
                Sample preview
              </p>
              <h2 id="preview-heading" className="text-base font-semibold text-[var(--color-ink)]">
                Step {stepIndex + 1} of {previewSteps.length} &middot; {activeStep.label}
              </h2>
            </div>
            <MetricChip label="Example data" tone="slate" />
          </div>

          <div className="px-4 py-4 sm:px-5 sm:py-5">
            <h3 className="sr-only">{activeStep.label} preview</h3>
            {/* Each branch is a distinct component, so switching steps remounts
                it and restarts that step's entrance animation from the top. */}
            {stepIndex === 0 ? <ScenarioPreview /> : null}
            {stepIndex === 1 ? <SimulationPreview /> : null}
            {stepIndex === 2 ? <FeedbackPreview /> : null}

            <p className="mt-4 text-sm leading-6 text-[var(--color-ink-muted)]">
              {activeStep.caption}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[rgba(255,255,255,0.7)] px-4 py-3">
            <div className="flex items-center gap-2" role="tablist" aria-label="Preview steps">
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
                    className={`h-3 w-3 rounded-full border transition-all duration-300 ${focusRing} ${
                      isActive
                        ? "w-7 border-transparent bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-strong)]"
                        : "border-[var(--color-border-strong)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]"
                    }`}
                  />
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
                disabled={isFirst}
                className={`min-h-11 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--color-ink)] shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:text-[var(--color-primary-strong)] disabled:pointer-events-none disabled:opacity-45 ${focusRing}`}
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() =>
                  setStepIndex((current) => Math.min(previewSteps.length - 1, current + 1))
                }
                disabled={isLast}
                className={`btn-shine min-h-11 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-strong)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-lift)] transition-all duration-300 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-45 ${focusRing}`}
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <p className="text-sm leading-6 text-[var(--color-ink-soft)]">
          Optional voice features: dictate your response with the mic, or have messages read aloud.
        </p>

        <SafetyNotice />

        <div>
          <Link
            href="/scenario"
            className="btn-shine inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-strong)] px-6 py-3 text-sm font-semibold text-white shadow-[var(--shadow-lift)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(15,118,110,0.32)]"
          >
            Try it yourself
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
