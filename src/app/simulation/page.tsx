"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { useGeminiVoiceRecorder } from "@/hooks/useGeminiVoiceRecorder";
import { useVoiceCapture } from "@/hooks/useVoiceCapture";
import { generateNextSimulationTurn } from "@/lib/ai/geminiClient";
import { speakWithGeminiTts } from "@/lib/ai/geminiTtsClient";
import { appendSimulationTurn } from "@/lib/simulation/simulationEngine";
import {
  clearFeedbackReport,
  loadFeedbackReport,
  loadSimulationState,
  savePendingFeedbackGeneration,
  saveSimulationState,
} from "@/lib/storage/localSimulationStorage";
import type { ScenarioSpeaker, SimulationState } from "@/types/simulation";
import type { VoiceMetrics, VoiceTranscriptionResult } from "@/types/voice";

const speakerLabels: Record<ScenarioSpeaker, string> = {
  patient: "Patient",
  family_member: "Family member",
  nurse: "Nurse",
  bystander: "Bystander",
  narrator: "Narrator",
};

const VOICE_MODE_STORAGE_KEY = "healthcare-sim-voice-mode";
const AUTO_READ_STORAGE_KEY = "healthcare-sim-auto-read-patient";

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

function getScenarioMessageSpeechKey(message: SimulationState["messages"][number]): string {
  return `${message.id}:${message.content}`;
}

function getScenarioSpeechStyle(speaker?: ScenarioSpeaker): string {
  switch (speaker) {
    case "patient":
      return "as a realistic patient in a healthcare communication training simulation";
    case "family_member":
      return "as a concerned family member in a healthcare communication training simulation";
    case "nurse":
      return "as a calm nurse in a healthcare communication training simulation";
    case "bystander":
      return "as a realistic bystander in a healthcare communication training simulation";
    case "narrator":
    default:
      return "as a neutral narrator in a healthcare communication training simulation";
  }
}

function mapTranscriptionToVoiceMetrics(
  transcription: VoiceTranscriptionResult,
  existingMetrics?: VoiceMetrics | null,
): VoiceMetrics {
  const toneMap: Record<VoiceTranscriptionResult["emotionEstimate"], VoiceMetrics["toneEstimate"]> = {
    calm: "calm",
    anxious: "tense",
    angry: "frustrated",
    sad: "uncertain",
    confused: "uncertain",
    neutral: "unknown",
    unknown: "unknown",
  };
  const paceLevel = transcription.paceEstimate === "unknown" ? "normal" : transcription.paceEstimate;

  return {
    volumeLevel: existingMetrics?.volumeLevel || "normal",
    pitchLevel: existingMetrics?.pitchLevel || "not_detected",
    paceLevel,
    pausePattern: existingMetrics?.pausePattern || "smooth",
    toneEstimate: toneMap[transcription.emotionEstimate],
    confidence: transcription.confidence,
    raw: existingMetrics?.raw,
  };
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
          Approximate browser estimate only. Audio is uploaded only for immediate transcription and is not stored.
        </p>
      </details>
    </InfoCard>
  );
}

type VoiceCaptureStatus =
  | "idle"
  | "recording"
  | "transcribing"
  | "analyzing"
  | "ready"
  | "stopped"
  | "unavailable";
type VoicePlaybackStatus = "idle" | "speaking";

export default function SimulationPage() {
  const router = useRouter();
  const [state, setState] = useState<SimulationState | null>(null);
  const [response, setResponse] = useState("");
  const [voiceMetrics, setVoiceMetrics] = useState<VoiceMetrics | null>(null);
  const [voiceCaptureStatus, setVoiceCaptureStatus] = useState<VoiceCaptureStatus>("idle");
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(false);
  const [voiceSettingsLoaded, setVoiceSettingsLoaded] = useState(false);
  const [autoReadScenario, setAutoReadScenario] = useState(false);
  const [voicePlaybackStatus, setVoicePlaybackStatus] = useState<VoicePlaybackStatus>("idle");
  const [voicePlaybackError, setVoicePlaybackError] = useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [hasFeedbackReport, setHasFeedbackReport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioAbortControllerRef = useRef<AbortController | null>(null);
  const audioRequestIdRef = useRef(0);
  const lastSpokenMessageRef = useRef<string | null>(null);
  const voiceCapture = useVoiceCapture();
  const geminiVoice = useGeminiVoiceRecorder();

  const applyCapturedTranscript = useCallback((capturedTranscript: string) => {
    if (capturedTranscript.trim()) {
      setResponse((current) => mergeTranscript(current, capturedTranscript));
    }
  }, []);

  const handleStopSpeech = useCallback(() => {
    audioRequestIdRef.current += 1;
    audioAbortControllerRef.current?.abort();
    audioAbortControllerRef.current = null;
    setSpeakingMessageId(null);
    setVoicePlaybackStatus("idle");
  }, []);

  const speakScenarioMessage = useCallback(
    async (message: SimulationState["messages"][number]) => {
      if (message.role !== "scenario") {
        return;
      }

      const requestId = audioRequestIdRef.current + 1;
      audioRequestIdRef.current = requestId;
      audioAbortControllerRef.current?.abort();

      const controller = new AbortController();
      audioAbortControllerRef.current = controller;
      setVoicePlaybackError(null);
      setSpeakingMessageId(message.id);
      setVoicePlaybackStatus("speaking");

      try {
        await speakWithGeminiTts(message.content, {
          cacheKey: getScenarioMessageSpeechKey(message),
          style: getScenarioSpeechStyle(message.speaker),
          speaker: message.speaker,
          tensionLevel: state?.tensionLevel,
          patientEmotion: state?.scenario.patientEmotion,
          familyEmotion: state?.scenario.familyEmotion,
          signal: controller.signal,
        });
      } catch (speechError) {
        if (!controller.signal.aborted && requestId === audioRequestIdRef.current) {
          setVoicePlaybackError(
            speechError instanceof Error
              ? speechError.message
              : "Voice unavailable, use text mode.",
          );
        }
      } finally {
        if (requestId === audioRequestIdRef.current) {
          audioAbortControllerRef.current = null;
          setSpeakingMessageId(null);
          setVoicePlaybackStatus("idle");
        }
      }
    },
    [state],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setState(loadSimulationState());
      setHasFeedbackReport(Boolean(loadFeedbackReport()));
      setVoiceModeEnabled(window.localStorage.getItem(VOICE_MODE_STORAGE_KEY) === "true");
      setAutoReadScenario(window.localStorage.getItem(AUTO_READ_STORAGE_KEY) === "true");
      setVoiceSettingsLoaded(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!voiceSettingsLoaded) {
      return;
    }

    window.localStorage.setItem(VOICE_MODE_STORAGE_KEY, String(voiceModeEnabled));
    window.localStorage.setItem(AUTO_READ_STORAGE_KEY, String(autoReadScenario));
  }, [autoReadScenario, voiceModeEnabled, voiceSettingsLoaded]);

  useEffect(() => {
    if (voiceModeEnabled) {
      return;
    }

    const timer = window.setTimeout(() => {
      handleStopSpeech();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [handleStopSpeech, voiceModeEnabled]);

  useEffect(() => {
    return () => {
      audioRequestIdRef.current += 1;
      audioAbortControllerRef.current?.abort();
      audioAbortControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (voiceCapture.stopReason !== "auto" || voiceCaptureStatus !== "recording") {
      return;
    }

    const timer = window.setTimeout(() => {
      applyCapturedTranscript(voiceCapture.transcript || voiceCapture.interimTranscript);
      setVoiceMetrics(voiceCapture.metrics);
      setVoiceCaptureStatus("stopped");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    applyCapturedTranscript,
    voiceCapture.interimTranscript,
    voiceCapture.metrics,
    voiceCapture.stopReason,
    voiceCapture.transcript,
    voiceCaptureStatus,
  ]);

  useEffect(() => {
    if (geminiVoice.supported || voiceCapture.supported) {
      return;
    }

    const timer = window.setTimeout(() => {
      setVoiceCaptureStatus("unavailable");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [geminiVoice.supported, voiceCapture.supported]);

  useEffect(() => {
    if (!state || !voiceModeEnabled || !autoReadScenario || voiceCapture.isRecording || geminiVoice.isRecording) {
      return;
    }

    const latestScenarioMessage = state.messages.findLast(
      (message) => message.role === "scenario" && message.speaker,
    );

    if (!latestScenarioMessage) {
      return;
    }

    const speechKey = getScenarioMessageSpeechKey(latestScenarioMessage);

    if (lastSpokenMessageRef.current === speechKey) {
      return;
    }

    lastSpokenMessageRef.current = speechKey;
    void speakScenarioMessage(latestScenarioMessage);
  }, [
    autoReadScenario,
    geminiVoice.isRecording,
    speakScenarioMessage,
    state,
    voiceCapture.isRecording,
    voiceModeEnabled,
  ]);

  async function handleStartVoiceCapture() {
    setError(null);
    setVoiceMetrics(null);
    handleStopSpeech();

    if (geminiVoice.supported) {
      setVoiceCaptureStatus("recording");
      const started = await geminiVoice.startRecording(
        "simulation",
        `${state?.scenario.title || ""}. ${state?.scenario.summary || ""}`,
      );

      if (started) {
        return;
      }
    }

    setVoiceCaptureStatus(voiceCapture.supported ? "recording" : "unavailable");
    await voiceCapture.startCapture();
  }

  async function handleStopVoiceCapture() {
    if (geminiVoice.isRecording) {
      setVoiceCaptureStatus("transcribing");
      const result = await geminiVoice.stopRecording();

      if (result?.transcript) {
        applyCapturedTranscript(result.transcript);
        setVoiceMetrics(mapTranscriptionToVoiceMetrics(result, voiceCapture.metrics));
        setVoiceCaptureStatus("ready");
        return;
      }

      if (voiceCapture.supported) {
        setVoiceCaptureStatus("recording");
        await voiceCapture.startCapture();
        return;
      }

      setVoiceCaptureStatus("unavailable");
      return;
    }

    setVoiceCaptureStatus("analyzing");
    const result = voiceCapture.stopCapture();
    applyCapturedTranscript(result.transcript);
    setVoiceMetrics(result.metrics);
    window.setTimeout(() => {
      setVoiceCaptureStatus("ready");
    }, 450);
  }

  function handleReadLatestScenarioMessage(latestScenarioMessage?: SimulationState["messages"][number]) {
    if (!latestScenarioMessage) {
      return;
    }

    lastSpokenMessageRef.current = getScenarioMessageSpeechKey(latestScenarioMessage);
    void speakScenarioMessage(latestScenarioMessage);
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
      setVoiceCaptureStatus(geminiVoice.supported || voiceCapture.supported ? "idle" : "unavailable");
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
  const voiceModeStatus = loading
    ? "Processing response..."
    : voicePlaybackStatus === "speaking"
      ? "Speaking patient..."
      : voiceCaptureStatus === "recording"
        ? "Recording..."
        : voiceCaptureStatus === "transcribing"
          ? "Transcribing with Gemini..."
          : voiceCaptureStatus === "analyzing"
            ? "Analyzing voice delivery."
            : voiceCaptureStatus === "stopped"
              ? "Recording stopped. You can review and send your response."
            : voiceCaptureStatus === "ready"
              ? "Transcript ready. Review before sending."
              : voiceCaptureStatus === "unavailable"
                ? "Gemini voice unavailable. Using text/browser fallback."
                : voiceModeEnabled
                  ? "Voice mode ready."
                  : "Text mode ready.";

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
                speechSupported={voiceModeEnabled}
                speakingMessageId={voicePlaybackStatus === "speaking" ? speakingMessageId : null}
                onSpeakMessage={handleReadLatestScenarioMessage}
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
                      setVoiceCaptureStatus(geminiVoice.supported || voiceCapture.supported ? "idle" : "unavailable");
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

                <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_320px]">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">{voiceModeStatus}</span>
                  </div>
                  <div className="grid gap-2">
                    <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={voiceModeEnabled}
                        onChange={(event) => setVoiceModeEnabled(event.target.checked)}
                        className="h-4 w-4 accent-emerald-700"
                      />
                      Voice Simulation Mode
                    </label>
                    <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={autoReadScenario}
                        disabled={!voiceModeEnabled}
                        onChange={(event) => setAutoReadScenario(event.target.checked)}
                        className="h-4 w-4 accent-emerald-700 disabled:accent-slate-300"
                      />
                      Auto-read patient messages
                    </label>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <button
                    type="button"
                    disabled={!voiceModeEnabled || !latestScenarioMessage || loading}
                    onClick={() => handleReadLatestScenarioMessage(latestScenarioMessage)}
                    className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-600 hover:text-emerald-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                  >
                    Read latest patient message
                  </button>
                  <button
                    type="button"
                    disabled={!voiceModeEnabled || (!geminiVoice.supported && !voiceCapture.supported) || geminiVoice.isRecording || geminiVoice.isTranscribing || voiceCapture.isRecording || loading}
                    onClick={handleStartVoiceCapture}
                    className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-600 hover:text-emerald-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                  >
                    Start speaking
                  </button>
                  <button
                    type="button"
                    disabled={!geminiVoice.isRecording && !voiceCapture.isRecording}
                    onClick={handleStopVoiceCapture}
                    className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-600 hover:text-emerald-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                  >
                    Stop speaking
                  </button>
                  <button
                    type="button"
                    disabled={voicePlaybackStatus !== "speaking"}
                    onClick={handleStopSpeech}
                    className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-rose-500 hover:text-rose-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                  >
                    Cancel audio
                  </button>
                </div>

                {voiceMetrics ? (
                  <div className="mt-3">
                    <VoiceDeliverySummary metrics={voiceMetrics} />
                  </div>
                ) : null}

                {geminiVoice.error ? (
                  <p className="mt-2 text-sm text-rose-700">{geminiVoice.error}</p>
                ) : null}
                {voiceCapture.error ? (
                  <p className="mt-2 text-sm text-rose-700">{voiceCapture.error}</p>
                ) : null}
                {voicePlaybackError ? (
                  <p className="mt-2 text-sm text-rose-700">{voicePlaybackError}</p>
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
                        disabled={!response.trim() || loading || geminiVoice.isTranscribing}
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
                    disabled={!response.trim() || geminiVoice.isTranscribing || voiceCapture.isRecording}
                    onClick={handleSend}
                    className="min-h-12 w-full"
                  >
                    Send Response
                  </LoadingButton>
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
                    End Simulation
                  </button>
                  <button
                    type="button"
                    onClick={handleFinishAndGenerateFeedback}
                    className="min-h-11 rounded-lg bg-blue-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-900"
                  >
                    Finish & Generate Feedback
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
