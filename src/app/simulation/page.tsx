"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth/AuthGate";
import { LoadingButton } from "@/components/common/LoadingButton";
import { MicButton } from "@/components/common/MicButton";
import { SafetyNotice } from "@/components/common/SafetyNotice";
import { MetricChip, StepProgress } from "@/components/common/VisualCards";
import { AppShell } from "@/components/layout/AppShell";
import { useShouldAnimate } from "@/components/motion/useShouldAnimate";
import { ChatMessageList, TypingIndicator } from "@/components/simulation/ChatMessageList";
import { countRevealWords, createRevealStore } from "@/components/simulation/revealStore";
import { TensionBadge } from "@/components/simulation/TensionBadge";
import { generateNextSimulationTurn } from "@/lib/ai/geminiClient";
import {
  isAbortError,
  isAutoplayBlockedError,
  speakText,
  type SpeechPlayback,
} from "@/lib/ai/openaiClient";
import {
  buildVoiceInstructions,
  getCharacterVoice,
  stripTraineePrompt,
} from "@/lib/ai/voiceDirection";
import { aggregateVoiceMetrics } from "@/lib/audio/voiceMetrics";
import { useRequireAuth } from "@/lib/firebase/useAuth";
import type { VoiceMetrics } from "@/types/voice";
import { appendSimulationTurn } from "@/lib/simulation/simulationEngine";
import {
  clearFeedbackReport,
  loadAutoRead,
  loadFeedbackReport,
  loadSimulationState,
  saveAutoRead,
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

/**
 * mp3 encoders prepend a short run of silence. Subtracting it stops the first
 * word landing a beat behind the voice.
 */
const AUDIO_LEAD_IN_MS = 150;

/**
 * How long a new turn's text waits for audio before giving up and typing
 * itself out. Long enough to cover a normal TTS round trip, short enough that a
 * slow one does not read as the app having hung.
 */
const AUDIO_WAIT_TIMEOUT_MS = 2_500;

const briefToneClasses = {
  ink: "text-[var(--color-ink-soft)]",
  primary: "text-[var(--color-primary)]",
  warning: "text-[var(--color-warning)]",
} as const;

/** One labelled field in the briefing bar. */
function BriefItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: keyof typeof briefToneClasses;
}) {
  return (
    <div className="min-w-0">
      <p className={`eyebrow eyebrow-tight ${briefToneClasses[tone]}`}>{label}</p>
      <p className="mt-1 text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">{value}</p>
    </div>
  );
}

export default function SimulationPage() {
  const router = useRouter();
  const gate = useRequireAuth();
  const shouldAnimate = useShouldAnimate();
  const [state, setState] = useState<SimulationState | null>(null);
  const [response, setResponse] = useState("");
  const [hasFeedbackReport, setHasFeedbackReport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Paces how each new turn's text appears. Held in state rather than a ref so
  // it is created once without being read during render.
  const [reveal] = useState(createRevealStore);

  // On by default: the voice is most of what makes the roleplay feel like a
  // conversation, and a toggle nobody finds is a feature nobody hears. Any
  // saved preference overrides this in the load effect below.
  const [autoRead, setAutoRead] = useState(true);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  /**
   * The turn a browser refused to play without a user gesture. Held so the
   * affordance replays that exact turn rather than guessing at the latest one.
   */
  const [audioGestureMessage, setAudioGestureMessage] = useState<SimulationMessage | null>(null);
  /**
   * Read when a turn arrives rather than closed over, so a toggle flipped while
   * the turn was being generated is honoured. Getting this wrong leaves the
   * turn armed for a voice that is never coming, and its text blank for good.
   */
  const autoReadRef = useRef(autoRead);
  const playbackRef = useRef<SpeechPlayback | null>(null);
  // Cancels the TTS fetch. Playback only exists once audio is already running,
  // so without this a stop during the network wait was simply ignored.
  const speechAbortRef = useRef<AbortController | null>(null);
  // Mirrors speakingMessageId for the callbacks that need it without taking a
  // dependency on it, so stopSpeaking stays stable.
  const speakingMessageIdRef = useRef<string | null>(null);
  const autoReadHandledIds = useRef<Set<string>>(new Set());
  const autoReadSeeded = useRef(false);
  const pendingVoiceMetrics = useRef<VoiceMetrics[]>([]);

  useEffect(() => reveal.dispose, [reveal]);

  useEffect(() => {
    autoReadRef.current = autoRead;
  }, [autoRead]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setState(loadSimulationState());
      setHasFeedbackReport(Boolean(loadFeedbackReport()));

      // Read inside the same deferral as the rest of the local state, so the
      // first paint still matches what the server rendered.
      const savedAutoRead = loadAutoRead();

      if (savedAutoRead !== null) {
        setAutoRead(savedAutoRead);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const stopSpeaking = useCallback(() => {
    speechAbortRef.current?.abort();
    speechAbortRef.current = null;
    playbackRef.current?.stop();
    playbackRef.current = null;

    // They asked it to stop, so show the words rather than leaving the turn
    // half-revealed with no voice coming to finish it.
    if (speakingMessageIdRef.current) {
      reveal.complete(speakingMessageIdRef.current);
      speakingMessageIdRef.current = null;
    }

    setSpeakingMessageId(null);
  }, [reveal]);

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
      setAudioGestureMessage(null);
      setSpeakingMessageId(message.id);
      speakingMessageIdRef.current = message.id;

      const controller = new AbortController();
      speechAbortRef.current = controller;

      // The hold cap. A turn armed for audio stays at its speaker name and
      // cursor until the voice arrives; if it does not arrive in time, the text
      // types itself out instead. Audio that turns up afterwards can only move
      // the reveal forward, so in practice it plays over completed text.
      const holdTimer = window.setTimeout(
        () => reveal.driveWithTimer(message.id),
        AUDIO_WAIT_TIMEOUT_MS,
      );

      try {
        // Voice is pinned per character; the instruction is rebuilt each turn so
        // delivery tracks the current tension and how far in we are.
        const speaker = message.speaker || "narrator";
        const voiceOptions = state
          ? {
              voice: getCharacterVoice(state.scenario, speaker).voiceId,
              instructions: buildVoiceInstructions({
                scenario: state.scenario,
                speaker,
                tensionLevel: state.tensionLevel,
                // Paced against the scenario's own suggested length, not the
                // hard safety cap. maxTurns is 12, so a ratio taken against it
                // needed turn 7.2 to count as late -- which a roleplay paced
                // for 4 or 5 turns never reaches, leaving both late-arc
                // branches unreachable.
                turnRatio: Math.min(
                  1,
                  state.currentTurn / Math.max(2, state.scenario.suggestedTurns || 4),
                ),
                // Read off the message, not off the current turn: re-reading an
                // older line has to sound the way it did the first time.
                delivery: message.delivery,
              }),
            }
          : {};
        // Spoken text drops the trailing "What do you say?" prompt; the message
        // on screen keeps it.
        const playback = await speakText(stripTraineePrompt(message.content), {
          ...voiceOptions,
          signal: controller.signal,
          onProgress: ({ elapsedMs, durationMs }) => {
            if (!durationMs) {
              return;
            }

            // Mapped over the spoken prefix only. The trailing "What do you
            // say?" is interface scaffolding rather than dialogue, so it lands
            // after the character has stopped talking. The store clamps.
            reveal.setAudioProgress(
              message.id,
              (elapsedMs - AUDIO_LEAD_IN_MS) / durationMs,
            );
          },
        });

        window.clearTimeout(holdTimer);

        // Stopped while the audio was still being fetched: the handle only
        // exists now, so honour the stop here rather than letting it play.
        if (controller.signal.aborted) {
          playback.stop();
          return;
        }

        playbackRef.current = playback;

        // Nothing to map a ratio onto, so pace the words instead.
        if (playback.durationMs === null) {
          reveal.driveWithTimer(message.id);
        }

        await playback.finished;
        reveal.finishAudio(message.id);
      } catch (err) {
        if (isAbortError(err)) {
          // A deliberate stop, which has already revealed the text in full.
          return;
        }

        // Every failure ends with the whole turn on screen. Sound is the only
        // thing that is ever lost.
        reveal.driveWithTimer(message.id);

        if (isAutoplayBlockedError(err)) {
          // Not an error: the browser is waiting for a gesture, and one click
          // gives the document sticky activation for every later turn. The
          // saved preference stays on -- this is a transient browser condition,
          // not a change of mind.
          setAudioGestureMessage(message);
          return;
        }

        setTtsError(err instanceof Error ? err.message : "Could not play audio.");
      } finally {
        window.clearTimeout(holdTimer);
        playbackRef.current = null;

        if (speakingMessageIdRef.current === message.id) {
          speakingMessageIdRef.current = null;
        }

        if (speechAbortRef.current === controller) {
          speechAbortRef.current = null;
        }

        setSpeakingMessageId((current) => (current === message.id ? null : current));
      }
    },
    [reveal, speakingMessageId, state, stopSpeaking],
  );

  // Seed the "already handled" set once so auto-read only fires for genuinely
  // new AI turns, never for messages already on screen when the toggle flips on.
  useEffect(() => {
    if (state && !autoReadSeeded.current) {
      // A run that is only just starting should hear its opening line, so that
      // one message is left unhandled. A reloaded run should not be read the
      // turn it was left on, so everything it already has is marked handled.
      const isFreshRun = state.currentTurn === 0 && state.messages.length === 1;

      state.messages.forEach((message) => {
        if (!(isFreshRun && message.role === "scenario")) {
          autoReadHandledIds.current.add(message.id);
        }
      });

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

  // --- Conversation scroll behaviour (UI-only) -----------------------------
  // Keeps the newest turn in view without yanking the user back down while
  // they are intentionally reading earlier messages.
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const initialScrollDone = useRef(false);
  const messageCount = state?.messages.length ?? 0;
  const hasState = state !== null;

  const scrollHistoryToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth && !prefersReducedMotion ? "smooth" : "auto",
    });
  }, []);

  const handleHistoryScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottomRef.current = distanceFromBottom < 120;
  }, []);

  // Jump to the latest turn on load, then follow new messages only when the
  // user is already near the bottom of the history.
  useEffect(() => {
    if (messageCount === 0) {
      return;
    }

    if (!initialScrollDone.current) {
      scrollHistoryToBottom(false);
      initialScrollDone.current = true;
      return;
    }

    if (nearBottomRef.current) {
      scrollHistoryToBottom();
    }
  }, [messageCount, scrollHistoryToBottom]);

  // Reveal the typing indicator when it appears near the bottom.
  useEffect(() => {
    if (loading && nearBottomRef.current) {
      scrollHistoryToBottom();
    }
  }, [loading, scrollHistoryToBottom]);

  // Follow content that grows in place (e.g. the typing animation) while the
  // user is near the bottom, without forcing them down otherwise.
  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      if (nearBottomRef.current) {
        scrollHistoryToBottom(false);
      }
    });
    observer.observe(content);

    return () => observer.disconnect();
  }, [hasState, scrollHistoryToBottom]);

  // A draft can be built from several dictations (plus typing), so metrics
  // accumulate here and are combined when the turn is actually sent.
  function handleTranscript(text: string, voiceMetrics: VoiceMetrics | null) {
    if (voiceMetrics) {
      pendingVoiceMetrics.current.push(voiceMetrics);
    }
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
      const updatedState = appendSimulationTurn(state, {
        traineeResponse,
        turn,
        traineeVoiceMetrics: aggregateVoiceMetrics(pendingVoiceMetrics.current),
      });

      // The message id is minted inside appendSimulationTurn, so the reveal has
      // to be armed here -- and before setState, in the same synchronous tick.
      // Reversed, every turn flashes its complete text for one frame.
      const newestMessage = updatedState.messages[updatedState.messages.length - 1];
      reveal.arm(newestMessage.id, countRevealWords(newestMessage.content));

      if (!shouldAnimate) {
        // Metering text out over the length of a spoken turn is a worse answer
        // to a stated reduced-motion preference than no animation at all. The
        // audio still plays.
        reveal.complete(newestMessage.id);
      } else if (!autoReadRef.current) {
        reveal.driveWithTimer(newestMessage.id);
      }
      // Auto-read on: the voice drives the reveal, under the hold cap above.

      setState(updatedState);
      saveSimulationState(updatedState);
      clearFeedbackReport();
      setHasFeedbackReport(false);
      setResponse("");
      pendingVoiceMetrics.current = [];
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

  if (gate.blocked) {
    return <AuthGate gate={gate} />;
  }

  if (!state) {
    return (
      <AppShell>
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-card)]">
          <p className="eyebrow text-[var(--color-ink-soft)]">Simulation room</p>
          <h1 className="display-md mt-4 text-[var(--color-ink)]">No active simulation</h1>
          <p className="lede mt-5 max-w-lg text-sm">
            Create a structured scenario before entering the simulation room.
          </p>
          <Link href="/scenario" className="btn-editorial btn-editorial--solid mt-8">
            Create scenario
          </Link>
        </section>
      </AppShell>
    );
  }

  const completed = state.status === "completed";
  const latestScenarioMessage = state.messages.findLast(
    (message) => message.role === "scenario" && message.speaker,
  );
  const currentSpeaker = latestScenarioMessage?.speaker
    ? speakerLabels[latestScenarioMessage.speaker]
    : "Narrator";

  return (
    <AppShell>
      {/* No entrance animation on the page root: the whole simulation room
          would be hidden until it ran. `template.tsx` already animates the
          route change. */}
      {/* Three fixed regions: a briefing bar, a session rail, and the roleplay
          itself. The page as a whole does not scroll — only the conversation
          history does — so the composer and the brief stay put while the
          trainee works. */}
      {/* On a viewport with room for it, the page height is pinned so only the
          conversation history scrolls — the brief and composer never move. The
          lock is gated on available height because below roughly 800px there
          is genuinely not enough room, and squeezing would clip the composer;
          short viewports fall back to ordinary page flow. */}
      <div className="flex flex-col gap-3 lg:[@media(min-height:800px)]:h-[calc(100dvh-var(--header-height)-5rem)]">
        {/* 1. Briefing bar — everything the trainee needs at a glance. */}
        <header className="accent-edge shrink-0 rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
            <div className="min-w-0">
              <p className="eyebrow text-[var(--color-primary)]">Simulation room</p>
              <h1 className="display-md mt-1.5">{state.scenario.title}</h1>
            </div>
            {/* Chips get the full width of the right side rather than a narrow
                column: penned into one they wrapped onto three rows and pushed
                the conversation off screen. */}
            {/* Short, fixed-length facts live as chips; only the prose fields
                get a column below. Setting is two words — giving it a third of
                the brief row wasted the measure the long fields needed. */}
            <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
              <MetricChip label="Setting" value={state.scenario.setting} tone="emerald" />
              <MetricChip label="Speaker" value={currentSpeaker} tone="blue" />
              <TensionBadge level={state.tensionLevel} />
              {/* Status is deliberately absent: the session rail already states
                  it in words, and a fifth chip wrapped the row onto two lines. */}
              <MetricChip label="Patient" value={state.scenario.patientEmotion} tone="amber" />
            </div>
          </div>

          {/* The training brief, inlined so it never needs to be scrolled to.
              Three full-width columns give these enough measure to read
              properly instead of wrapping every few words. */}
          <div className="mt-3 grid gap-x-8 gap-y-3 border-t border-[var(--color-border)] pt-3 sm:grid-cols-2 lg:grid-cols-3">
            <BriefItem label="Situation" tone="ink" value={state.scenario.summary} />
            <BriefItem label="Goal" tone="primary" value={state.scenario.traineeObjective} />
            <BriefItem
              label="Challenge"
              tone="warning"
              value={state.scenario.communicationChallenge}
            />
          </div>

          {/* The total is the hard safety cap, not the target. Most roleplays
              end well before it, on the ending condition. */}
          <div className="mt-3 border-t border-[var(--color-border)] pt-3">
            <StepProgress
              variant="inline"
              current={state.currentTurn}
              total={state.maxTurns}
              label="Turns used"
              hint={`Paced for about ${state.scenario.suggestedTurns}; ends when the conversation resolves.`}
            />
          </div>
        </header>

        {/* 2. Session rail (left) + 3. roleplay (centre). */}
        {/* An explicit row track: an implicit `auto` row sizes to its content
            and would overflow the pinned container instead of shrinking. */}
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
          {/* Conversation panel */}
          <section className="order-1 flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] shadow-[var(--shadow-soft)] lg:order-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-2.5">
              <h2 className="eyebrow text-[var(--color-ink)]">Live roleplay</h2>
              <div className="flex flex-wrap items-center gap-3">
                <label className="eyebrow eyebrow-tight inline-flex cursor-pointer items-center gap-2 text-[var(--color-ink-muted)]">
                  <input
                    type="checkbox"
                    checked={autoRead}
                    onChange={(event) => {
                      setAutoRead(event.target.checked);
                      saveAutoRead(event.target.checked);

                      if (!event.target.checked) {
                        setAudioGestureMessage(null);
                        stopSpeaking();
                      }
                    }}
                    className="h-3.5 w-3.5 rounded-none border-[var(--color-border-strong)] accent-[var(--color-ink)]"
                  />
                  Auto-read new messages
                </label>
                <MetricChip label="Messages" value={`${state.messages.length}`} tone="slate" />
              </div>
            </div>

            <div
              ref={scrollRef}
              onScroll={handleHistoryScroll}
              tabIndex={0}
              aria-label="Conversation history"
              aria-busy={loading}
              className="min-h-[16rem] max-h-[55dvh] flex-1 overflow-y-auto overscroll-contain scroll-pb-4 px-4 py-4 lg:[@media(min-height:800px)]:max-h-none lg:[@media(min-height:800px)]:min-h-0"
            >
              <div ref={contentRef} className="space-y-4">
                <ChatMessageList
                  messages={state.messages}
                  reveal={reveal}
                  onSpeak={speakMessage}
                  speakingMessageId={speakingMessageId}
                />
                {loading ? <TypingIndicator /> : null}
              </div>
            </div>

            {/* Persistent bottom area: speech controls + composer / completed */}
            <div className="glass shrink-0 border-t border-[var(--color-border)] px-4 py-3.5">
              {speakingMessageId || ttsError || audioGestureMessage ? (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {speakingMessageId ? (
                    <button
                      type="button"
                      onClick={stopSpeaking}
                      className="eyebrow eyebrow-tight inline-flex min-h-9 items-center gap-2 border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-3 py-1.5 text-[var(--color-danger)] transition-colors hover:bg-transparent"
                    >
                      <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse bg-[var(--color-danger)]" />
                      Stop reading aloud
                    </button>
                  ) : null}
                  {/* Deliberately quiet rather than in the danger colour: a
                      browser waiting for a gesture is not a failure. Clicking
                      is itself the gesture, so the call to speak has to come
                      straight from the handler. */}
                  {audioGestureMessage ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const blocked = audioGestureMessage;
                          setAudioGestureMessage(null);
                          void speakMessage(blocked);
                        }}
                        className="btn-editorial btn-editorial--quiet min-h-9"
                      >
                        Turn on read-aloud
                      </button>
                      <p className="text-xs text-[var(--color-ink-soft)]">
                        Your browser waits for a click before playing audio.
                      </p>
                    </>
                  ) : null}
                  {ttsError ? (
                    <p className="text-xs font-medium text-[var(--color-danger)]">{ttsError}</p>
                  ) : null}
                </div>
              ) : null}

              {!completed ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="trainee-response" className="eyebrow text-[var(--color-ink)]">
                      Your next response
                    </label>
                    <div className="flex items-center gap-3">
                      <p className="text-xs font-medium tabular-nums text-[var(--color-ink-soft)]">
                        {response.trim().length} chars
                      </p>
                      <MicButton onTranscript={handleTranscript} disabled={loading} />
                    </div>
                  </div>
                  <textarea
                    id="trainee-response"
                    rows={2}
                    value={response}
                    onChange={(event) => setResponse(event.target.value)}
                    placeholder="Type what the trainee says or does next."
                    className="mt-2.5 w-full resize-y border border-[var(--color-border-strong)] bg-white p-3 text-sm leading-6 text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]"
                  />

                  {error ? (
                    <div className="mt-3 rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
                      {error}
                      <button
                        type="button"
                        onClick={handleSend}
                        disabled={!response.trim() || loading}
                        className="ml-3 font-semibold underline disabled:opacity-50"
                      >
                        Retry
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-2.5">
                    <LoadingButton
                      type="button"
                      loading={loading}
                      disabled={!response.trim()}
                      onClick={handleSend}
                      className="sheen min-h-11 w-full"
                    >
                      Send Response
                    </LoadingButton>
                  </div>
                </>
              ) : (
                <div className="rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-info)] bg-[var(--color-info-soft)] px-4 py-3">
                  <p className="eyebrow text-[var(--color-info)]">Simulation completed</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">
                    Generate a feedback report focused on communication, empathy, clarity, and pressure handling.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Session rail. Sits alongside the roleplay rather than below it, so
              ending the session never means scrolling away from the composer. */}
          <aside className="order-2 flex flex-col gap-3 lg:order-1 lg:self-start">
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
              <p className="eyebrow text-[var(--color-ink-soft)]">Session</p>
              <p className="display-sm mt-2 text-[var(--color-ink)]">
                {completed ? "Simulation completed" : "Wrap up when ready"}
              </p>
              <p className="mt-1.5 text-xs leading-5 text-[var(--color-ink-soft)]">
                {completed ? "Open the feedback report for this roleplay." : "Finish now or end without feedback."}
              </p>
              <div className="mt-4 grid gap-2">
                {!completed ? (
                  <>
                    <button
                      type="button"
                      onClick={handleEndSimulation}
                      className="btn-editorial btn-editorial--quiet w-full hover:border-[var(--color-danger)] hover:bg-transparent hover:text-[var(--color-danger)]"
                    >
                      End Simulation
                    </button>
                    <button
                      type="button"
                      onClick={handleFinishAndGenerateFeedback}
                      className="btn-editorial btn-editorial--solid w-full"
                    >
                      Finish & Generate Feedback
                    </button>
                  </>
                ) : hasFeedbackReport ? (
                  <button
                    type="button"
                    onClick={() => router.push("/feedback")}
                    className="btn-editorial btn-editorial--solid w-full"
                  >
                    View Feedback
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateFeedback}
                    className="btn-editorial btn-editorial--solid w-full"
                  >
                    Generate Feedback
                  </button>
                )}
              </div>
            </div>

            <SafetyNotice />

            <p className="text-[11px] leading-4 text-[var(--color-ink-soft)]">
              Read-aloud audio is AI-generated (OpenAI) and voices only the text shown
              in the conversation.
            </p>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
