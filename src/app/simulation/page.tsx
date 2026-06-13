"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/common/LoadingButton";
import { SafetyNotice } from "@/components/common/SafetyNotice";
import { VoiceInputButton } from "@/components/common/VoiceInputButton";
import { AppShell } from "@/components/layout/AppShell";
import { ChatMessageList } from "@/components/simulation/ChatMessageList";
import { TensionBadge } from "@/components/simulation/TensionBadge";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { generateNextSimulationTurn } from "@/lib/ai/geminiClient";
import { appendSimulationTurn } from "@/lib/simulation/simulationEngine";
import {
  loadSimulationState,
  saveSimulationState,
} from "@/lib/storage/localSimulationStorage";
import type { SimulationState } from "@/types/simulation";

const responseStarters = [
  "I can hear this has been frustrating. Let me explain what I know so far.",
  "Before I continue, what is your biggest concern right now?",
  "I want to make sure I am being clear. Can I pause and check what you have understood?",
];

export default function SimulationPage() {
  const router = useRouter();
  const [state, setState] = useState<SimulationState | null>(() => loadSimulationState());
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleTranscript = useCallback((text: string) => {
    if (text) {
      setResponse((current) => `${current} ${text}`.trim());
    }
  }, []);
  const speech = useSpeechToText({ onTranscript: handleTranscript });

  async function handleSend() {
    if (!state || !response.trim()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const turn = await generateNextSimulationTurn(state, response);
      const updatedState = appendSimulationTurn(
        state,
        response,
        turn.message,
        turn.tensionLevel,
        turn.shouldEnd,
      );

      setState(updatedState);
      saveSimulationState(updatedState);
      setResponse("");
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

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-emerald-700">
              Simulation room
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {state.scenario.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {state.scenario.traineeObjective}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-700">
              Turn {state.currentTurn} / {state.maxTurns}
            </span>
            <TensionBadge level={state.tensionLevel} />
          </div>
        </div>
        <div className="overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-2 rounded-full bg-emerald-700 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <SafetyNotice />
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <section className="rounded-lg border border-emerald-900/10 bg-slate-50 p-4 shadow-sm md:p-6">
              <ChatMessageList messages={state.messages} />
            </section>
            {!completed ? (
              <section className="rounded-lg border border-emerald-900/10 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <label
                      htmlFor="trainee-response"
                      className="text-sm font-semibold text-slate-900"
                    >
                      Trainee response
                    </label>
                    <p className="mt-1 text-xs text-slate-500">
                      Keep it conversational. Empathy, clarity, and checking understanding matter.
                    </p>
                  </div>
                  <p className="text-xs font-medium text-slate-500">
                    {response.trim().length} characters
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {responseStarters.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => setResponse(starter)}
                      className="rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 transition hover:border-blue-500"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
                <textarea
                  id="trainee-response"
                  rows={4}
                  value={response}
                  onChange={(event) => setResponse(event.target.value)}
                  placeholder="Type what the trainee says or does next."
                  className="mt-4 w-full resize-y rounded-lg border border-slate-300 bg-white p-4 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
                />
                {speech.error ? <p className="mt-2 text-sm text-rose-700">{speech.error}</p> : null}
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
                    disabled={!response.trim()}
                    onClick={handleSend}
                  >
                    Send Response
                  </LoadingButton>
                  <VoiceInputButton
                    supported={speech.supported}
                    listening={speech.listening}
                    onStart={speech.startListening}
                    onStop={speech.stopListening}
                  />
                  <button
                    type="button"
                    onClick={handleEndSimulation}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-rose-400 hover:text-rose-700"
                  >
                    End Simulation
                  </button>
                </div>
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

          <aside className="space-y-4">
            <section className="rounded-lg border border-emerald-900/10 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-500">Scenario context</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">
                {state.scenario.setting}
              </h2>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                <p>
                  <span className="font-semibold text-slate-950">Objective:</span>{" "}
                  {state.scenario.traineeObjective}
                </p>
                <p>
                  <span className="font-semibold text-slate-950">Challenge:</span>{" "}
                  {state.scenario.communicationChallenge}
                </p>
              </div>
            </section>
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-500">Coach reminders</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-700">
                {["Acknowledge emotion", "Use plain language", "Check understanding"].map(
                  (reminder) => (
                    <div key={reminder} className="rounded-md bg-slate-50 px-3 py-2">
                      {reminder}
                    </div>
                  ),
                )}
              </div>
            </section>
            <button
              type="button"
              onClick={handleGenerateFeedback}
              className="w-full rounded-lg bg-blue-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-900"
            >
              Generate Feedback
            </button>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
