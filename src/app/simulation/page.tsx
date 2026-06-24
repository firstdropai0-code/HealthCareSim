"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/common/LoadingButton";
import { SafetyNotice } from "@/components/common/SafetyNotice";
import {
  CollapsibleSection,
  InfoCard,
  MetricChip,
  StepProgress,
  VoiceMetricCard,
} from "@/components/common/VisualCards";
import { AppShell } from "@/components/layout/AppShell";
import { ChatMessageList } from "@/components/simulation/ChatMessageList";
import { TensionBadge } from "@/components/simulation/TensionBadge";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { useVoiceCapture } from "@/hooks/useVoiceCapture";
import { generateNextSimulationTurn } from "@/lib/ai/geminiClient";
import { appendSimulationTurn } from "@/lib/simulation/simulationEngine";
import {
  clearFeedbackReport,
  loadFeedbackReport,
  loadSimulationState,
  savePendingFeedbackGeneration,
  saveSimulationState,
} from "@/lib/storage/localSimulationStorage";
import type { ScenarioSpeaker, SimulationState } from "@/types/simulation";
import type { VoiceMetrics } from "@/types/voice";

const speakerLabels: Record<ScenarioSpeaker, string> = {
  patient: "Patient",
  family_member: "Family member",
  nurse: "Nurse",
  bystander: "Bystander",
  narrator: "Narrator",
};

function formatVoiceLabel(value: string): string {
  return value.replace(/_/g, " ");
}

function mergeTranscript(current: string, next: string): string {
  const currentText = current.trim();
  const nextText = next.trim();
  const normalizedCurrent = currentText.toLowerCase();
  const normalizedNext = nextText.toLowerCase();

  if (!nextText || normalizedCurrent.endsWith(normalizedNext)) {
    return current;
  }

  if (normalizedCurrent && normalizedNext.startsWith(`${normalizedCurrent} `)) {
    return nextText;
  }

  return `${currentText} ${nextText}`.trim();
}

function VoiceDeliverySummary({ metrics }: { metrics: VoiceMetrics }) {
  return (
    <InfoCard label="Voice delivery" title="Estimated pattern" tone="indigo">
      <VoiceMetricCard
        metrics={[
          { label: "Tone", value: formatVoiceLabel(metrics.toneEstimate), tone: "indigo" },
          { label: "Pace", value: formatVoiceLabel(metrics.paceLevel), tone: "blue" },
          { label: "Volume", value: formatVoiceLabel(metrics.volumeLevel), tone: "emerald" },
          { label: "Confidence", value: metrics.confidence, tone: "amber" },
        ]}
      />
      {metrics.confidence === "low" ? (
        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-indigo-900">
          Low confidence estimate. Use the transcript first.
        </p>
      ) : null}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase text-slate-500 hover:text-slate-800">
          View voice details
        </summary>
        <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
          <span>Pitch: {formatVoiceLabel(metrics.pitchLevel)}</span>
          <span>Pauses: {formatVoiceLabel(metrics.pausePattern)}</span>
          {metrics.raw?.wordsPerMinute ? <span>WPM: {Math.round(metrics.raw.wordsPerMinute)}</span> : null}
          {metrics.raw?.durationSeconds ? <span>Duration: {Math.round(metrics.raw.durationSeconds)}s</span> : null}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Approximate browser estimate only. No audio is stored or uploaded in this prototype.
        </p>
      </details>
    </InfoCard>
  );
}

type VoiceCaptureStatus = "idle" | "recording" | "analyzing" | "ready" | "unavailable";

export default function SimulationPage() {
  const router = useRouter();
  const [state, setState] = useState<SimulationState | null>(null);
  const [response, setResponse] = useState("");
  const [voiceMetrics, setVoiceMetrics] = useState<VoiceMetrics | null>(null);
  const [voiceCaptureStatus, setVoiceCaptureStatus] = useState<VoiceCaptureStatus>("idle");
  const [autoReadScenario, setAutoReadScenario] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [hasFeedbackReport, setHasFeedbackReport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const voiceCapture = useVoiceCapture();
  const {
    speak,
    stop: stopSpeech,
    speaking,
    supported: textToSpeechSupported,
    error: textToSpeechError,
  } = useTextToSpeech();

  const applyCapturedTranscript = useCallback((capturedTranscript: string) => {
    if (capturedTranscript.trim()) {
      setResponse((current) => mergeTranscript(current, capturedTranscript));
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setState(loadSimulationState());
      setHasFeedbackReport(Boolean(loadFeedbackReport()));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, [stopSpeech]);

  useEffect(() => {
    if (voiceCapture.stopReason !== "auto" || voiceCaptureStatus !== "recording") {
      return;
    }

    const timer = window.setTimeout(() => {
      applyCapturedTranscript(voiceCapture.transcript || voiceCapture.interimTranscript);
      setVoiceMetrics(voiceCapture.metrics);
      setVoiceCaptureStatus("ready");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [applyCapturedTranscript, voiceCapture, voiceCaptureStatus]);

  useEffect(() => {
    if (voiceCapture.supported) {
      return;
    }

    const timer = window.setTimeout(() => {
      setVoiceCaptureStatus("unavailable");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [voiceCapture.supported]);

  const handleSpeakMessage = useCallback(
    (message: SimulationState["messages"][number]) => {
      stopSpeech();
      setSpeakingMessageId(message.id);
      speak(message.content);
    },
    [speak, stopSpeech],
  );

  const handleStopSpeech = useCallback(() => {
    stopSpeech();
    setSpeakingMessageId(null);
  }, [stopSpeech]);

  async function handleStartVoiceCapture() {
    setError(null);
    setVoiceMetrics(null);
    setVoiceCaptureStatus(voiceCapture.supported ? "recording" : "unavailable");
    handleStopSpeech();
    await voiceCapture.startCapture();
  }

  function handleStopVoiceCapture() {
    setVoiceCaptureStatus("analyzing");
    const result = voiceCapture.stopCapture();
    applyCapturedTranscript(result.transcript);
    setVoiceMetrics(result.metrics);
    window.setTimeout(() => {
      setVoiceCaptureStatus("ready");
    }, 450);
  }

  async function handleSend() {
    if (!state || !response.trim()) {
      return;
    }

    setLoading(true);
    setError(null);
    const traineeResponse = response.trim();
    const responseVoiceMetrics = voiceMetrics ?? undefined;

    try {
      const turn = await generateNextSimulationTurn(
        state,
        traineeResponse,
        responseVoiceMetrics,
      );
      const updatedState = appendSimulationTurn(
        state,
        traineeResponse,
        turn.message,
        turn.speaker,
        turn.tensionLevel,
        turn.shouldEnd,
        responseVoiceMetrics,
      );

      setState(updatedState);
      saveSimulationState(updatedState);
      clearFeedbackReport();
      setHasFeedbackReport(false);
      setResponse("");
      setVoiceMetrics(null);
      setVoiceCaptureStatus(voiceCapture.supported ? "idle" : "unavailable");

      const nextScenarioMessage = updatedState.messages.at(-1);

      if (autoReadScenario && !voiceCapture.isRecording && nextScenarioMessage?.role === "scenario") {
        setSpeakingMessageId(nextScenarioMessage.id);
        speak(nextScenarioMessage.content);
      }
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
    handleStopSpeech();
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
        <section className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">No active simulation</h1>
          <p className="mt-3 text-sm text-slate-600">
            Create a structured scenario before entering the simulation room.
          </p>
          <Link
            href="/scenario"
            className="mt-6 inline-flex rounded-lg bg-emerald-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900"
          >
            Create scenario
          </Link>
        </section>
      </AppShell>
    );
  }

  const completed = state.status === "completed";
  const coachCues = ["Name emotion", "Share next step", "Check understanding"];
  const visibleTranscript = [voiceCapture.transcript, voiceCapture.interimTranscript]
    .filter(Boolean)
    .join(" ")
    .trim();
  const latestScenarioMessage = state.messages.findLast(
    (message) => message.role === "scenario" && message.speaker,
  );
  const currentSpeaker = latestScenarioMessage?.speaker
    ? speakerLabels[latestScenarioMessage.speaker]
    : "Narrator";

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="overflow-hidden rounded-lg border border-emerald-900/10 bg-white shadow-sm">
          <div className="grid gap-4 bg-emerald-950 p-5 text-white lg:grid-cols-[1fr_300px] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase text-emerald-200">Simulation room</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                {state.scenario.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50">
                {state.scenario.summary}
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetricChip label="Speaker" value={currentSpeaker} tone="blue" />
                <TensionBadge level={state.tensionLevel} />
              </div>
              <StepProgress current={state.currentTurn} total={state.maxTurns} />
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <section className="min-h-[420px] rounded-lg border border-emerald-900/10 bg-slate-50 p-4 shadow-sm md:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Live roleplay</p>
                  <h2 className="text-lg font-semibold text-slate-950">Conversation</h2>
                </div>
                <MetricChip label="Messages" value={`${state.messages.length}`} tone="slate" />
              </div>
              <ChatMessageList
                messages={state.messages}
                speechSupported={textToSpeechSupported}
                speakingMessageId={speaking ? speakingMessageId : null}
                onSpeakMessage={handleSpeakMessage}
                onStopSpeech={handleStopSpeech}
              />
            </section>

            {!completed ? (
              <section className="rounded-lg border border-emerald-900/10 bg-white p-4 shadow-sm md:p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <label
                      htmlFor="trainee-response"
                      className="text-sm font-semibold text-slate-900"
                    >
                      Your next response
                    </label>
                    <p className="mt-1 text-xs text-slate-500">
                      Keep it clear: acknowledge, explain, confirm.
                    </p>
                  </div>
                  <p className="text-xs font-medium text-slate-500">
                    {response.trim().length} characters
                  </p>
                </div>
                <textarea
                  id="trainee-response"
                  rows={3}
                  value={response}
                  onChange={(event) => {
                    setResponse(event.target.value);
                    if (!event.target.value.trim()) {
                      setVoiceMetrics(null);
                      setVoiceCaptureStatus(voiceCapture.supported ? "idle" : "unavailable");
                    }
                  }}
                  placeholder="Type what the trainee says or does next."
                  className="mt-3 w-full resize-y rounded-lg border border-slate-300 bg-white p-4 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  {coachCues.map((cue) => (
                    <MetricChip key={cue} label={cue} tone="emerald" />
                  ))}
                </div>

                {voiceCapture.isRecording && visibleTranscript ? (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
                    <span className="font-semibold">Live transcript:</span> {visibleTranscript}
                  </div>
                ) : null}

                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_260px]">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    {voiceCaptureStatus === "idle" ? "Ready to type or record." : null}
                    {voiceCaptureStatus === "recording" ? (
                      <span className="font-semibold text-emerald-900">Recording. Stop to review.</span>
                    ) : null}
                    {voiceCaptureStatus === "analyzing" ? (
                      <span className="font-semibold text-indigo-900">Analyzing voice delivery.</span>
                    ) : null}
                    {voiceCaptureStatus === "ready" ? "Review the transcript before sending." : null}
                    {voiceCaptureStatus === "unavailable" ? "Voice unavailable. Text input works." : null}
                  </div>
                  <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={autoReadScenario}
                      onChange={(event) => setAutoReadScenario(event.target.checked)}
                      className="h-4 w-4 accent-emerald-700"
                    />
                    Auto-read replies
                  </label>
                </div>

                {voiceMetrics ? (
                  <div className="mt-3">
                    <VoiceDeliverySummary metrics={voiceMetrics} />
                  </div>
                ) : null}

                {voiceCapture.error ? (
                  <p className="mt-2 text-sm text-rose-700">{voiceCapture.error}</p>
                ) : null}
                {textToSpeechError ? (
                  <p className="mt-2 text-sm text-rose-700">{textToSpeechError}</p>
                ) : null}
                {!voiceCapture.analysisSupported ? (
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Voice tone analysis is unavailable in this browser. You can still type or use basic voice input.
                  </p>
                ) : null}
                {error ? (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
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

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr]">
                  <LoadingButton
                    type="button"
                    loading={loading}
                    disabled={!response.trim() || voiceCapture.isRecording}
                    onClick={handleSend}
                    className="min-h-12"
                  >
                    Send Response
                  </LoadingButton>
                  <button
                    type="button"
                    disabled={!voiceCapture.supported || loading}
                    onClick={
                      voiceCapture.isRecording
                        ? handleStopVoiceCapture
                        : handleStartVoiceCapture
                    }
                    className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-600 hover:text-emerald-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                    title={
                      voiceCapture.supported
                        ? "Start voice recording and estimate delivery"
                        : "Voice capture is not supported"
                    }
                  >
                    {voiceCapture.isRecording ? "Stop Recording" : "Record Voice"}
                  </button>
                </div>

                <CollapsibleSection title="Voice input note" tone="slate">
                  Mobile browsers may stop voice capture after silence. Review the transcript before sending. Text input always works.
                </CollapsibleSection>
              </section>
            ) : (
              <InfoCard label="Complete" title="Simulation completed" tone="blue">
                <p className="text-sm leading-6">
                  Generate a feedback report focused on communication, empathy, clarity, and pressure handling.
                </p>
              </InfoCard>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <InfoCard label="Training brief" title={state.scenario.setting} tone="slate">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-emerald-700">Goal</p>
                  <p className="mt-1 text-sm leading-6 text-slate-800">
                    {state.scenario.traineeObjective}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-amber-700">Challenge</p>
                  <p className="mt-1 text-sm leading-6 text-slate-800">
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
                  <div key={cue} className="flex items-center gap-3 rounded-lg bg-emerald-50 px-3 py-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-semibold text-emerald-800 shadow-sm">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-700">{cue}</span>
                  </div>
                ))}
              </div>
            </InfoCard>

            <SafetyNotice />
          </aside>
        </div>

        <div className="sticky bottom-4 z-10 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                {completed ? "Simulation completed" : "Wrap up when ready"}
              </p>
              <p className="text-xs text-slate-500">
                {completed ? "Open the feedback report for this roleplay." : "Finish now or end without feedback."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:flex md:flex-wrap">
              {!completed ? (
                <>
                  <button
                    type="button"
                    onClick={handleEndSimulation}
                    className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-rose-400 hover:text-rose-700"
                  >
                    End Only
                  </button>
                  <button
                    type="button"
                    onClick={handleFinishAndGenerateFeedback}
                    className="min-h-11 rounded-lg bg-blue-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-900"
                  >
                    Finish & Feedback
                  </button>
                </>
              ) : hasFeedbackReport ? (
                <button
                  type="button"
                  onClick={() => router.push("/feedback")}
                  className="min-h-11 rounded-lg bg-blue-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-900"
                >
                  View Feedback
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateFeedback}
                  className="min-h-11 rounded-lg bg-blue-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-900"
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
