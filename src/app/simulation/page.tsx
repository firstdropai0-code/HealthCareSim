"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/common/LoadingButton";
import { SafetyNotice } from "@/components/common/SafetyNotice";
import { AppShell } from "@/components/layout/AppShell";
import { ChatMessageList } from "@/components/simulation/ChatMessageList";
import { TensionBadge } from "@/components/simulation/TensionBadge";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { useVoiceCapture } from "@/hooks/useVoiceCapture";
import { generateNextSimulationTurn } from "@/lib/ai/geminiClient";
import { appendSimulationTurn } from "@/lib/simulation/simulationEngine";
import {
  loadSimulationState,
  saveSimulationState,
} from "@/lib/storage/localSimulationStorage";
import type { SimulationState } from "@/types/simulation";
import type { VoiceMetrics } from "@/types/voice";

function formatVoiceLabel(value: string): string {
  return value.replace(/_/g, " ");
}

type VoiceCaptureStatus = "idle" | "recording" | "analyzing" | "ready";

export default function SimulationPage() {
  const router = useRouter();
  const [state, setState] = useState<SimulationState | null>(null);
  const [response, setResponse] = useState("");
  const [voiceMetrics, setVoiceMetrics] = useState<VoiceMetrics | null>(null);
  const [voiceCaptureStatus, setVoiceCaptureStatus] = useState<VoiceCaptureStatus>("idle");
  const [autoReadScenario, setAutoReadScenario] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setState(loadSimulationState());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, [stopSpeech]);

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
    setVoiceCaptureStatus("recording");
    handleStopSpeech();
    await voiceCapture.startCapture();
  }

  function handleStopVoiceCapture() {
    setVoiceCaptureStatus("analyzing");
    const result = voiceCapture.stopCapture();

    if (result.transcript.trim()) {
      setResponse((current) => `${current} ${result.transcript}`.trim());
    }

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
        turn.tensionLevel,
        turn.shouldEnd,
        responseVoiceMetrics,
      );

      setState(updatedState);
      saveSimulationState(updatedState);
      setResponse("");
      setVoiceMetrics(null);

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

  function handleEndSimulation() {
    if (!state) {
      return;
    }

    const completedState: SimulationState = { ...state, status: "completed" };
    handleStopSpeech();
    setState(completedState);
    saveSimulationState(completedState);
  }

  function handleGenerateFeedback() {
    if (state) {
      const completedState: SimulationState = { ...state, status: "completed" };
      saveSimulationState(completedState);
    }

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
  const progressPercent = Math.min(100, Math.round((state.currentTurn / state.maxTurns) * 100));
  const coachCues = [
    "Name the emotion",
    "Explain one next step",
    "Check understanding",
  ];

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="overflow-hidden rounded-lg border border-emerald-900/10 bg-white shadow-sm">
          <div className="flex flex-col gap-4 bg-emerald-950 p-5 text-white lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-emerald-200">Simulation room</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                {state.scenario.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50">
                {state.scenario.summary}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase text-white">
                Turn {state.currentTurn} / {state.maxTurns}
              </span>
              <TensionBadge level={state.tensionLevel} />
            </div>
          </div>
          <div className="bg-slate-100">
            <div
              className="h-2 bg-emerald-600 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <section className="min-h-[420px] rounded-lg border border-emerald-900/10 bg-slate-50 p-4 shadow-sm md:p-6">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Live roleplay</p>
                  <h2 className="text-lg font-semibold text-slate-950">Conversation</h2>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                  {state.messages.length} messages
                </span>
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
              <section className="rounded-lg border border-emerald-900/10 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <label
                      htmlFor="trainee-response"
                      className="text-sm font-semibold text-slate-900"
                    >
                      Your next response
                    </label>
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
                      setVoiceCaptureStatus("idle");
                    }
                  }}
                  placeholder="Type what the trainee says or does next."
                  className="mt-3 w-full resize-y rounded-lg border border-slate-300 bg-white p-4 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
                />
                {voiceCapture.isRecording && voiceCapture.transcript ? (
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Live transcript: {voiceCapture.transcript}
                  </p>
                ) : null}
                {voiceCaptureStatus === "recording" ? (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                    <span className="font-semibold">Recording started.</span> Speak naturally, then stop recording to review and edit the transcript.
                  </div>
                ) : null}
                {voiceCaptureStatus === "analyzing" ? (
                  <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950">
                    <span className="font-semibold">Recording stopped.</span> Analyzing voice delivery...
                  </div>
                ) : null}
                {voiceCaptureStatus === "ready" && voiceMetrics ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    Recording stopped. Review the estimated voice delivery pattern and edit your transcript before sending.
                  </div>
                ) : null}
                {voiceMetrics ? (
                  <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-semibold text-indigo-950">
                        Estimated voice delivery pattern
                      </p>
                      <span className="text-xs font-semibold uppercase text-indigo-700">
                        Possibly {formatVoiceLabel(voiceMetrics.toneEstimate)} / {voiceMetrics.confidence} confidence
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs font-medium text-indigo-950 sm:grid-cols-4">
                      <span>Volume: {formatVoiceLabel(voiceMetrics.volumeLevel)}</span>
                      <span>Pitch: {formatVoiceLabel(voiceMetrics.pitchLevel)}</span>
                      <span>Pace: {formatVoiceLabel(voiceMetrics.paceLevel)}</span>
                      <span>Pauses: {formatVoiceLabel(voiceMetrics.pausePattern)}</span>
                    </div>
                    {voiceMetrics.confidence === "low" ? (
                      <p className="mt-3 rounded-md bg-white/70 px-3 py-2 text-xs font-semibold text-indigo-900">
                        Low confidence estimate. Treat this as a weak signal and rely on the transcript first.
                      </p>
                    ) : null}
                    <p className="mt-3 text-xs leading-5 text-indigo-800">
                      This is an approximate browser estimate for training feedback. No audio is stored or uploaded in this prototype.
                    </p>
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
                    Voice tone analysis is not supported in this browser. You can still type or use basic voice input.
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
                <div className="mt-4 flex flex-wrap items-start gap-3">
                  <LoadingButton
                    type="button"
                    loading={loading}
                    disabled={!response.trim() || voiceCapture.isRecording}
                    onClick={handleSend}
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
                    className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-600 hover:text-emerald-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                    title={
                      voiceCapture.supported
                        ? "Start voice recording and estimate delivery"
                        : "Voice capture is not supported"
                    }
                  >
                    {voiceCapture.isRecording ? "Stop recording" : "Start voice recording"}
                  </button>
                  <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={autoReadScenario}
                      onChange={(event) => setAutoReadScenario(event.target.checked)}
                      className="h-4 w-4 accent-emerald-700"
                    />
                    Auto-read scenario responses
                  </label>
                  <button
                    type="button"
                    onClick={handleEndSimulation}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-rose-400 hover:text-rose-700"
                  >
                    End Simulation
                  </button>
                </div>
                {voiceCapture.isRecording ? (
                  <p className="mt-3 text-xs font-medium text-emerald-800">
                    Recording voice. {voiceCapture.isAnalyzing ? "Estimating delivery pattern while you speak." : "Listening for transcript."}
                  </p>
                ) : null}
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Text input always works. Browser voice is optional, and no audio is stored or uploaded in this prototype.
                </p>
              </section>
            ) : (
              <section className="rounded-lg border border-blue-200 bg-blue-50 p-5">
                <h2 className="text-lg font-semibold text-blue-950">Simulation completed</h2>
                <p className="mt-2 text-sm leading-6 text-blue-950">
                  Generate a feedback report focused on communication, empathy, clarity, and pressure handling.
                </p>
              </section>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <section className="overflow-hidden rounded-lg border border-emerald-900/10 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Training brief</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">
                  {state.scenario.setting}
                </h2>
              </div>
              <div className="space-y-3 p-5">
                <div className="rounded-lg bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase text-emerald-800">Objective</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-950">
                    {state.scenario.traineeObjective}
                  </p>
                </div>
                <div className="rounded-lg bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase text-amber-800">Challenge</p>
                  <p className="mt-2 text-sm leading-6 text-amber-950">
                    {state.scenario.communicationChallenge}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">Patient mood</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {state.scenario.patientEmotion}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">Status</p>
                    <p className="mt-1 text-sm font-semibold capitalize text-slate-900">
                      {state.status.replace("_", " ")}
                    </p>
                  </div>
                </div>
              </div>
            </section>
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-500">Response cues</p>
              <div className="mt-3 space-y-2">
                {coachCues.map((cue, index) => (
                  <div key={cue} className="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-semibold text-emerald-800 shadow-sm">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-700">{cue}</span>
                  </div>
                ))}
              </div>
            </section>
            <details className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <summary className="cursor-pointer font-semibold">Safety note</summary>
              <div className="mt-3">
                <SafetyNotice />
              </div>
            </details>
          </aside>
        </div>
        <div className="sticky bottom-4 z-10 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                Ready to wrap up?
              </p>
              <p className="text-xs text-slate-500">
                Generate feedback from the conversation so far.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {!completed ? (
                <button
                  type="button"
                  onClick={handleEndSimulation}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-rose-400 hover:text-rose-700"
                >
                  End Simulation
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleGenerateFeedback}
                className="rounded-lg bg-blue-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-900"
              >
                Generate Feedback
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
