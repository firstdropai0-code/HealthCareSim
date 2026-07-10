"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/common/LoadingButton";
import { MicButton } from "@/components/common/MicButton";
import { SafetyNotice } from "@/components/common/SafetyNotice";
import {
  InfoCard,
  MetricChip,
  StepProgress,
} from "@/components/common/VisualCards";
import { AppShell } from "@/components/layout/AppShell";
import { ChatMessageList, TypingIndicator } from "@/components/simulation/ChatMessageList";
import { TensionBadge } from "@/components/simulation/TensionBadge";
import { generateNextSimulationTurn } from "@/lib/ai/geminiClient";
import { speakText, type SpeechPlayback } from "@/lib/ai/openaiClient";
import { appendSimulationTurn } from "@/lib/simulation/simulationEngine";
import {
  clearFeedbackReport,
  loadFeedbackReport,
  loadSimulationState,
  savePendingFeedbackGeneration,
  saveSimulationState,
} from "@/lib/storage/localSimulationStorage";
import type {
  ScenarioSpeaker,
  SimulationMessage,
  SimulationState,
} from "@/types/simulation";

const speakerLabels: Record<ScenarioSpeaker, string> = {
  patient: "Patient",
  family_member: "Family member",
  nurse: "Nurse",
  bystander: "Bystander",
  narrator: "Narrator",
};

export default function SimulationPage() {
  const router = useRouter();
  const [state, setState] = useState<SimulationState | null>(null);
  const [response, setResponse] = useState("");
  const [hasFeedbackReport, setHasFeedbackReport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [autoRead, setAutoRead] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const playbackRef = useRef<SpeechPlayback | null>(null);
  const autoReadHandledIds = useRef<Set<string>>(new Set());
  const autoReadSeeded = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setState(loadSimulationState());
      setHasFeedbackReport(Boolean(loadFeedbackReport()));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const stopSpeaking = useCallback(() => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    setSpeakingMessageId(null);
  }, []);

  // Stop any in-flight playback when leaving the page.
  useEffect(() => stopSpeaking, [stopSpeaking]);

  const speakMessage = useCallback(
    async (message: SimulationMessage) => {
      // Toggle off if this exact message is already being read.
      if (speakingMessageId === message.id) {
        stopSpeaking();
        return;
      }

      stopSpeaking();
      setTtsError(null);
      setSpeakingMessageId(message.id);

      try {
        const playback = await speakText(message.content);
        playbackRef.current = playback;
        await playback.finished;
      } catch (err) {
        setTtsError(err instanceof Error ? err.message : "Could not play audio.");
      } finally {
        playbackRef.current = null;
        setSpeakingMessageId((current) => (current === message.id ? null : current));
      }
    },
    [speakingMessageId, stopSpeaking],
  );

  // Seed the "already handled" set once so auto-read only fires for genuinely
  // new AI turns, never for messages already on screen when the toggle flips on.
  useEffect(() => {
    if (state && !autoReadSeeded.current) {
      state.messages.forEach((message) => autoReadHandledIds.current.add(message.id));
      autoReadSeeded.current = true;
    }
  }, [state]);

  // Auto-read the newest scenario message when the toggle is on.
  useEffect(() => {
    if (!autoRead || !state) {
      return;
    }

    const latest = state.messages.findLast(
      (message) => message.role === "scenario" && message.content.trim().length > 0,
    );

    if (!latest || autoReadHandledIds.current.has(latest.id)) {
      return;
    }

    autoReadHandledIds.current.add(latest.id);
    void speakMessage(latest);
  }, [autoRead, state, speakMessage]);

  function handleTranscript(text: string) {
    setResponse((current) => (current.trim() ? `${current.trim()} ${text}` : text));
  }

  async function handleSend() {
    if (!state || !response.trim()) {
      return;
    }

    setLoading(true);
    setError(null);
    const traineeResponse = response.trim();

    try {
      const turn = await generateNextSimulationTurn(state, traineeResponse);
      const updatedState = appendSimulationTurn(
        state,
        traineeResponse,
        turn.message,
        turn.speaker,
        turn.tensionLevel,
        turn.shouldEnd,
      );

      setState(updatedState);
      saveSimulationState(updatedState);
      clearFeedbackReport();
      setHasFeedbackReport(false);
      setResponse("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue simulation.");
    } finally {
      setLoading(false);
    }
  }

  function completeSimulation(): SimulationState | null {
    if (!state) {
      return null;
    }

    const completedState: SimulationState = { ...state, status: "completed" };
    setState(completedState);
    saveSimulationState(completedState);
    return completedState;
  }

  function handleEndSimulation() {
    completeSimulation();
  }

  function handleFinishAndGenerateFeedback() {
    const completedState = completeSimulation();

    if (!completedState) {
      return;
    }

    savePendingFeedbackGeneration();
    router.push("/feedback");
  }

  function handleGenerateFeedback() {
    if (!state) {
      return;
    }

    savePendingFeedbackGeneration();
    router.push("/feedback");
  }

  if (!state) {
    return (
      <AppShell>
        <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-[var(--shadow-soft)]">
          <h1 className="text-2xl font-semibold text-[var(--color-ink)]">No active simulation</h1>
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
            Create a structured scenario before entering the simulation room.
          </p>
          <Link
            href="/scenario"
            className="btn-shine mt-6 inline-flex min-h-11 items-center rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-strong)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-lift)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(15,118,110,0.32)]"
          >
            Create scenario
          </Link>
        </section>
      </AppShell>
    );
  }

  const completed = state.status === "completed";
  const coachCues = ["Name emotion", "Share next step", "Check understanding"];
  const latestScenarioMessage = state.messages.findLast(
    (message) => message.role === "scenario" && message.speaker,
  );
  const currentSpeaker = latestScenarioMessage?.speaker
    ? speakerLabels[latestScenarioMessage.speaker]
    : "Narrator";

  return (
    <AppShell>
      <div className="animate-fade-up space-y-6">
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
          <div className="relative grid gap-5 overflow-hidden bg-gradient-to-br from-[var(--color-primary-ink)] via-[var(--color-primary-strong)] to-[var(--color-primary-ink)] p-5 text-white lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center sm:p-6">
            <div
              aria-hidden
              className="animate-pulse-glow pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-300/25 blur-3xl"
            />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-100">Simulation room</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                {state.scenario.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-teal-50">
                {state.scenario.summary}
              </p>
            </div>
            <div className="relative space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetricChip label="Speaker" value={currentSpeaker} tone="blue" />
                <TensionBadge level={state.tensionLevel} />
              </div>
              <StepProgress current={state.currentTurn} total={state.maxTurns} />
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-6">
            <section className="min-h-[440px] rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 shadow-[var(--shadow-card)] md:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">Live roleplay</p>
                  <h2 className="text-lg font-semibold text-[var(--color-ink)]">Conversation</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--color-ink)]">
                    <input
                      type="checkbox"
                      checked={autoRead}
                      onChange={(event) => {
                        setAutoRead(event.target.checked);
                        if (!event.target.checked) {
                          stopSpeaking();
                        }
                      }}
                      className="h-4 w-4 rounded border-[var(--color-border-strong)] accent-[var(--color-primary)]"
                    />
                    Auto-read new patient messages
                  </label>
                  <MetricChip label="Messages" value={`${state.messages.length}`} tone="slate" />
                </div>
              </div>
              <ChatMessageList
                messages={state.messages}
                onSpeak={speakMessage}
                speakingMessageId={speakingMessageId}
              />
              {speakingMessageId ? (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full border border-rose-300 bg-[var(--color-danger-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-danger)] transition-colors hover:border-rose-400"
                >
                  <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--color-danger)]" />
                  Stop reading aloud
                </button>
              ) : null}
              {ttsError ? (
                <p className="mt-2 text-xs font-medium text-[var(--color-danger)]">{ttsError}</p>
              ) : null}
              <p className="mt-2 text-[11px] leading-4 text-[var(--color-ink-soft)]">
                Read-aloud audio is AI-generated (OpenAI) and voices only the text shown above.
              </p>
              {loading ? (
                <div className="mt-4">
                  <TypingIndicator />
                </div>
              ) : null}
            </section>

            {!completed ? (
              <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] md:p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <label
                      htmlFor="trainee-response"
                      className="text-sm font-semibold text-[var(--color-ink)]"
                    >
                      Your next response
                    </label>
                    <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                      Keep it clear: acknowledge, explain, confirm.
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <p className="text-xs font-medium text-[var(--color-ink-soft)]">
                      {response.trim().length} characters
                    </p>
                    <MicButton onTranscript={handleTranscript} disabled={loading} />
                  </div>
                </div>
                <textarea
                  id="trainee-response"
                  rows={3}
                  value={response}
                  onChange={(event) => setResponse(event.target.value)}
                  placeholder="Type what the trainee says or does next."
                  className="mt-3 w-full resize-y rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] p-4 text-sm leading-6 text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:bg-white focus:ring-4 focus:ring-teal-100"
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  {coachCues.map((cue) => (
                    <MetricChip key={cue} label={cue} tone="emerald" />
                  ))}
                </div>

                {error ? (
                  <div className="mt-3 rounded-2xl border border-rose-200 bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
                    {error}
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!response.trim() || loading}
                      className="ml-3 font-semibold underline disabled:text-rose-300"
                    >
                      Retry
                    </button>
                  </div>
                ) : null}

                <div className="mt-4">
                  <LoadingButton
                    type="button"
                    loading={loading}
                    disabled={!response.trim()}
                    onClick={handleSend}
                    className="min-h-12 w-full"
                  >
                    Send Response
                  </LoadingButton>
                </div>
              </section>
            ) : (
              <InfoCard label="Complete" title="Simulation completed" tone="blue">
                <p className="text-sm leading-6">
                  Generate a feedback report focused on communication, empathy, clarity, and pressure handling.
                </p>
              </InfoCard>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <InfoCard label="Training brief" title={state.scenario.setting} tone="slate">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-primary-strong)]">Goal</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-ink-muted)]">
                    {state.scenario.traineeObjective}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Challenge</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-ink-muted)]">
                    {state.scenario.communicationChallenge}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <MetricChip label="Patient" value={state.scenario.patientEmotion} tone="amber" />
                  <MetricChip label="Status" value={state.status.replace("_", " ")} tone="slate" />
                </div>
              </div>
            </InfoCard>

            <InfoCard label="Response cues" title="Use this pattern" tone="emerald">
              <div className="grid gap-2">
                {coachCues.map((cue, index) => (
                  <div key={cue} className="flex items-center gap-3 rounded-2xl bg-[var(--color-primary-soft)] px-3 py-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-semibold text-[var(--color-primary-ink)] shadow-sm">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-[var(--color-ink)]">{cue}</span>
                  </div>
                ))}
              </div>
            </InfoCard>

            <SafetyNotice />
          </aside>
        </div>

        <div className="sticky bottom-4 z-10 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.92)] p-3 shadow-[var(--shadow-soft)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--color-ink)]">
                {completed ? "Simulation completed" : "Wrap up when ready"}
              </p>
              <p className="text-xs text-[var(--color-ink-soft)]">
                {completed ? "Open the feedback report for this roleplay." : "Finish now or end without feedback."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:flex md:flex-wrap">
              {!completed ? (
                <>
                  <button
                    type="button"
                    onClick={handleEndSimulation}
                    className="min-h-11 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-3 text-sm font-semibold text-[var(--color-ink)] shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:border-rose-400 hover:text-rose-700"
                  >
                    End Simulation
                  </button>
                  <button
                    type="button"
                    onClick={handleFinishAndGenerateFeedback}
                    className="btn-shine min-h-11 rounded-full bg-gradient-to-r from-[var(--color-info)] to-blue-900 px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(49,86,163,0.32)]"
                  >
                    Finish & Generate Feedback
                  </button>
                </>
              ) : hasFeedbackReport ? (
                <button
                  type="button"
                  onClick={() => router.push("/feedback")}
                  className="btn-shine min-h-11 rounded-full bg-gradient-to-r from-[var(--color-info)] to-blue-900 px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(49,86,163,0.32)]"
                >
                  View Feedback
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateFeedback}
                  className="btn-shine min-h-11 rounded-full bg-gradient-to-r from-[var(--color-info)] to-blue-900 px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(49,86,163,0.32)]"
                >
                  Generate Feedback
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
