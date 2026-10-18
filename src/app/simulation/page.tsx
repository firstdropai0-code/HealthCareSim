"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth/AuthGate";
import { LoadingButton } from "@/components/common/LoadingButton";
import { MicButton } from "@/components/common/MicButton";
import { AppShell } from "@/components/layout/AppShell";
import { useShouldAnimate } from "@/components/motion/useShouldAnimate";
import { ChatMessageList, TypingIndicator } from "@/components/simulation/ChatMessageList";
import { countRevealWords, createRevealStore } from "@/components/simulation/revealStore";
import { SimulationScene } from "@/components/simulation/SimulationScene";
import { createSpeakingLevelStore } from "@/components/simulation/speakingLevel";
import { TensionBadge } from "@/components/simulation/TensionBadge";
import { castScenario, generateNextSimulationTurn } from "@/lib/ai/geminiClient";
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
  resolveVoiceIntensity,
} from "@/lib/ai/voiceDirection";
import { aggregateVoiceMetrics } from "@/lib/audio/voiceMetrics";
import { useRequireAuth } from "@/lib/firebase/useAuth";
import { useT } from "@/lib/i18n/strings";
import { isPatientDeceased } from "@/lib/scenarios/patientStatus";
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
import type { Scenario } from "@/types/scenario";
import type {
  SimulationMessage,
  SimulationState,
} from "@/types/simulation";

type CastPatch = Pick<Scenario, "cast" | "characterVoices">;

/**
 * A run with a cast worked out for it after it started: a run reopened from
 * before casts existed, which no start button got the chance to prepare.
 *
 * Faces for everyone, but new voices only for characters who have not spoken
 * yet. The patch recasts every voice by gender, and applying that to someone
 * who already spoke would change their voice mid-conversation -- worse than
 * the mismatch it fixes. Returns the same object when there is nothing to
 * apply, so callers can tell whether anything changed.
 */
function applyCastPatch(target: SimulationState, patch: CastPatch | null): SimulationState {
  if (!patch?.cast?.length || target.scenario.cast?.length) {
    return target;
  }

  const characterVoices = { ...patch.characterVoices };

  for (const message of target.messages) {
    const kept = message.role === "scenario" && message.speaker
      ? target.scenario.characterVoices?.[message.speaker]
      : undefined;

    if (message.speaker && kept) {
      characterVoices[message.speaker] = kept;
    }
  }

  return { ...target, scenario: { ...target.scenario, cast: patch.cast, characterVoices } };
}

/**
 * mp3 encoders prepend a short run of silence. Subtracting it stops the first
 * word landing a beat behind the voice.
 */
const AUDIO_LEAD_IN_MS = 150;

/**
 * How long a new turn's text waits for audio before giving up and typing itself
 * out.
 *
 * Scaled by message length, because generation time is dominated by how much
 * speech there is rather than by a fixed round trip. Measured against the live
 * providers: a 77-character line comes back in ~1.1s on the fast model and
 * ~1.7s on the dramatic one, while a 265-character line -- ordinary for a turn,
 * still inside the prompt's 55-word cap -- takes ~3.4s and ~7.1s respectively.
 * A flat cap either strands every long turn or makes every short one sit in
 * silence waiting for a budget it never needed.
 *
 * The slope is taken from the dramatic model, which is the slow case, so the
 * fast model always finishes with room to spare. The ceiling is a backstop: past
 * it something has genuinely gone wrong and typing the text out beats waiting.
 */
const AUDIO_WAIT_BASE_MS = 1_500;
const AUDIO_WAIT_PER_CHAR_MS = 30;
const AUDIO_WAIT_CEILING_MS = 12_000;

function audioWaitTimeoutMs(text: string): number {
  return Math.min(
    AUDIO_WAIT_CEILING_MS,
    AUDIO_WAIT_BASE_MS + text.length * AUDIO_WAIT_PER_CHAR_MS,
  );
}

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
  const t = useT();
  // Callbacks and effects read the current translator through a ref: adding `t`
  // to their dependency arrays would retrigger playback and turn requests every
  // time the language changes.
  const tRef = useRef(t);
  // Assigned in an effect rather than during render: refs may not be written
  // while rendering. Listing `t` would restart playback and turn requests on a language change.
  useEffect(() => {
    tRef.current = t;
  });
  const shouldAnimate = useShouldAnimate();
  const [state, setState] = useState<SimulationState | null>(null);
  const [response, setResponse] = useState("");
  const [hasFeedbackReport, setHasFeedbackReport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Paces how each new turn's text appears. Held in state rather than a ref so
  // it is created once without being read during render.
  const [reveal] = useState(createRevealStore);
  // How loud the current line is, for the stage's speaking ring. Same reason
  // as the reveal store for living outside React state: it changes per frame.
  const [speakingLevel] = useState(createSpeakingLevelStore);
  // The cast worked out for a reopened run, kept aside as well as applied:
  // handleSend builds each turn from the state it started with, and a cast
  // that landed during the wait would otherwise be overwritten by that turn.
  const castPatchRef = useRef<CastPatch | null>(null);
  const castRequestedFor = useRef<string | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const transcriptCloseRef = useRef<HTMLButtonElement>(null);

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
        audioWaitTimeoutMs(message.content),
      );

      try {
        // Voice is pinned per character; the instruction is rebuilt each turn so
        // delivery tracks the current tension and how far in we are.
        const speaker = message.speaker || "narrator";
        // One context, both providers. OpenAI reads `instructions` and
        // ElevenLabs reads `intensity`, but they are derived from the same
        // inputs so a line is ranked identically either way -- otherwise an A/B
        // between them compares the two mappings rather than the two models.
        const voiceContext = state
          ? {
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
            }
          : null;
        const voiceOptions =
          state && voiceContext
            ? {
                voice: getCharacterVoice(state.scenario, speaker).voiceId,
                instructions: buildVoiceInstructions(voiceContext),
                intensity: resolveVoiceIntensity(voiceContext),
                delivery: message.delivery,
                ...(message.spokenContent
                  ? { spokenText: stripTraineePrompt(message.spokenContent) }
                  : {}),
              }
            : {};
        // Spoken text drops the trailing "What do you say?" prompt; the message
        // on screen keeps it.
        const playback = await speakText(stripTraineePrompt(message.content), {
          ...voiceOptions,
          signal: controller.signal,
          onLevel: (level) => speakingLevel.setLevel(level),
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

        setTtsError(err instanceof Error ? err.message : tRef.current("simulation.audioError"));
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
    [reveal, speakingLevel, speakingMessageId, state, stopSpeaking],
  );

  // A run reopened from before casts existed has no faces and voices cast
  // without regard to gender. Every start button now prepares a cast first, but
  // a run already in the browser -- opened from the Simulation link or "Resume"
  // -- never passed one, so it is worked out here, once, in the background.
  useEffect(() => {
    if (!state || state.scenario.cast?.length || state.status === "completed") {
      return;
    }

    const runKey = state.id ?? state.scenario.id;

    if (castRequestedFor.current === runKey) {
      return;
    }

    castRequestedFor.current = runKey;

    void castScenario(state.scenario)
      .then((patch) => {
        if (!patch?.cast?.length) {
          return;
        }

        castPatchRef.current = patch;
        setState((current) => {
          if (!current) {
            return current;
          }

          const next = applyCastPatch(current, patch);

          if (next !== current) {
            saveSimulationState(next);
          }

          return next;
        });
      })
      .catch((error) => {
        console.warn("Could not work out this run's cast; it continues without portraits.", error);
      });
  }, [state]);

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

  // Opening the transcript lands on the latest turn with focus on its close
  // button, so a keyboard user is inside the drawer rather than behind it;
  // Escape closes it from anywhere.
  useEffect(() => {
    if (!transcriptOpen) {
      return undefined;
    }

    // Whatever opened the drawer gets focus back when it closes, rather than
    // the keyboard user being dropped at the top of the page.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    scrollHistoryToBottom(false);
    transcriptCloseRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTranscriptOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, [transcriptOpen, scrollHistoryToBottom]);

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
      const updatedState = applyCastPatch(
        appendSimulationTurn(state, {
          traineeResponse,
          turn,
          traineeVoiceMetrics: aggregateVoiceMetrics(pendingVoiceMetrics.current),
        }),
        castPatchRef.current,
      );

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
      setError(err instanceof Error ? err.message : tRef.current("simulation.turnError"));
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
          <p className="eyebrow text-[var(--color-ink-soft)]">{t("simulation.room")}</p>
          <h1 className="display-md mt-4 text-[var(--color-ink)]">{t("simulation.none")}</h1>
          <p className="lede mt-5 max-w-lg text-sm">
            {t("simulation.noneBody")}
          </p>
          <Link href="/scenario" className="btn-editorial btn-editorial--solid mt-8">
            {t("simulation.createScenario")}
          </Link>
        </section>
      </AppShell>
    );
  }

  const completed = state.status === "completed";
  const deceased = isPatientDeceased(state.scenario);

  return (
    <AppShell>
      {/* No entrance animation on the page root: the whole simulation room
          would be hidden until it ran. `template.tsx` already animates the
          route change. */}
      {/* Three bands: a slim bar about the exercise, the scene, and the
          composer. The scene is the page. It used to be a 320px column beside
          a chat log, with a briefing card, a session rail and four chips around
          it -- a dashboard with a roleplay inside, the person cut off at the
          neck and their words on the other side of the panel. The transcript
          is now a drawer, and the session controls live in the bar. */}
      {/* On a viewport with room for it, the page height is pinned so the bar
          and composer never move and the scene takes the rest. Pinned from
          640px tall, not the old layout's 800px: the bar and composer are now
          about 170px together, and the common laptop window (1536 x ~790 CSS
          pixels) sits between the two -- at the old cut-off it fell back to
          page flow, where the scene had no height and collapsed. Shorter
          viewports still fall back, with the scene given a height of its own. */}
      <div className="flex flex-col gap-2.5 lg:[@media(min-height:640px)]:h-[calc(100dvh-var(--header-height)-5rem)]">
        {/* 1. The exercise: title, goal, pace, tension, brief, and the way out. */}
        <header className="accent-edge shrink-0 rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2.5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="min-w-0 max-w-full lg:max-w-[22rem]">
              <p className="eyebrow text-[var(--color-primary)]">{t("simulation.room")}</p>
              <h1
                className="truncate text-[1.0625rem] font-semibold leading-6 text-[var(--color-ink)]"
                title={state.scenario.title}
              >
                {state.scenario.title}
              </h1>
            </div>
            {/* One line, the whole goal on hover and in the brief: the goal is
                what the trainee acts on turn by turn, so it stays in view where
                there is room for it. Below xl the title and the controls leave
                it a few pixels -- it showed as "G." -- so it lives in the brief. */}
            <p
              className="hidden min-w-0 flex-1 truncate border-l border-[var(--color-border)] pl-4 text-sm text-[var(--color-ink-muted)] xl:block"
              title={state.scenario.traineeObjective}
            >
              <span className="eyebrow eyebrow-tight mr-2 text-[var(--color-primary)]">{t("simulation.goal")}</span>
              {state.scenario.traineeObjective}
            </p>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {/* The pacing, not the cap: most roleplays end on their ending
                  condition well before the hard limit. */}
              <span
                className="text-xs tabular-nums text-[var(--color-ink-soft)]"
                title={t("simulation.pacedFor", { n: state.scenario.suggestedTurns })}
              >
                {t("simulation.turnOf", { n: state.currentTurn, total: state.scenario.suggestedTurns })}
              </span>
              <TensionBadge level={state.tensionLevel} />
              <button
                type="button"
                aria-expanded={briefOpen}
                aria-controls="simulation-brief"
                onClick={() => setBriefOpen((open) => !open)}
                className="btn-editorial btn-editorial--quiet min-h-9 px-3 py-1.5"
              >
                {t("simulation.brief")}
              </button>
              {!completed ? (
                <>
                  <button
                    type="button"
                    onClick={handleEndSimulation}
                    className="btn-editorial btn-editorial--quiet min-h-9 px-3 py-1.5 hover:border-[var(--color-danger)] hover:bg-transparent hover:text-[var(--color-danger)]"
                  >
                    {t("simulation.endShort")}
                  </button>
                  <button
                    type="button"
                    onClick={handleFinishAndGenerateFeedback}
                    className="btn-editorial btn-editorial--solid min-h-9 px-3 py-1.5"
                  >
                    {t("simulation.finishShort")}
                  </button>
                </>
              ) : hasFeedbackReport ? (
                <button
                  type="button"
                  onClick={() => router.push("/feedback")}
                  className="btn-editorial btn-editorial--solid min-h-9 px-3 py-1.5"
                >
                  {t("simulation.viewFeedback")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateFeedback}
                  className="btn-editorial btn-editorial--solid min-h-9 px-3 py-1.5"
                >
                  {t("simulation.generateFeedback")}
                </button>
              )}
            </div>
          </div>

          {briefOpen ? (
            <div
              id="simulation-brief"
              className="mt-2.5 grid gap-x-8 gap-y-3 border-t border-[var(--color-border)] pt-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <BriefItem label={t("simulation.goal")} tone="primary" value={state.scenario.traineeObjective} />
              <BriefItem label={t("simulation.situation")} tone="ink" value={state.scenario.summary} />
              <BriefItem
                label={t("simulation.challenge")}
                tone="warning"
                value={state.scenario.communicationChallenge}
              />
              {/* A death is a status, not an emotion -- the same rule as the
                  scenario brief. */}
              <BriefItem
                label={t("simulation.patient")}
                tone="ink"
                value={deceased ? t("simulation.deceased") : state.scenario.patientEmotion}
              />
            </div>
          ) : null}
        </header>

        {/* 2. The scene. */}
        {/* A definite height either way. The scene positions its room and
            dialogue against its own box, so a wrapper whose height came only
            from content left it at zero: the room vanished and the dialogue
            floated up over the bar. Pinned, it takes the space left over;
            otherwise it gets a fixed share of the screen. */}
        <div className="min-h-0 lg:h-[clamp(20rem,60vh,36rem)] lg:[@media(min-height:640px)]:h-auto lg:[@media(min-height:640px)]:flex-1">
          <SimulationScene
            scenario={state.scenario}
            messages={state.messages}
            tensionLevel={state.tensionLevel}
            reveal={reveal}
            speakingMessageId={speakingMessageId}
            level={speakingLevel}
            loading={loading}
            pendingLine={loading ? response.trim() || null : null}
            onSpeak={speakMessage}
            onOpenTranscript={() => setTranscriptOpen(true)}
          />
        </div>

        {/* 3. The composer. Voice first: the Speak button leads, typing is
            beside it. */}
        <div className="shrink-0 rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2.5 shadow-[var(--shadow-soft)]">
          {!completed ? (
            <>
              <div className="flex flex-wrap items-end gap-2 sm:flex-nowrap">
                {/* The scenario's language, not the reader's UI setting: a
                    Hindi case is answered in Hindi. */}
                <MicButton
                  onTranscript={handleTranscript}
                  disabled={loading}
                  language={state.scenario.language ?? "en"}
                  className="shrink-0"
                />
                <label htmlFor="trainee-response" className="sr-only">
                  {t("simulation.yourResponse")}
                </label>
                <textarea
                  id="trainee-response"
                  rows={1}
                  value={response}
                  onChange={(event) => setResponse(event.target.value)}
                  placeholder={t("simulation.placeholder")}
                  // Its own full-width row on a phone, with Speak and Send
                  // beneath; between them on wider screens. Sharing a phone's
                  // row it was squeezed to a 55px sliver.
                  className="order-first min-h-11 w-full min-w-0 basis-full resize-y border border-[var(--color-border-strong)] bg-white px-3 py-2.5 text-sm leading-6 text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)] sm:order-none sm:flex-1 sm:basis-0"
                />
                <LoadingButton
                  type="button"
                  loading={loading}
                  disabled={!response.trim()}
                  onClick={handleSend}
                  className="sheen ml-auto min-h-11 shrink-0 px-5 sm:ml-0"
                >
                  {t("simulation.send")}
                </LoadingButton>
              </div>

              {error ? (
                <div className="mt-2.5 rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
                  {error}
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!response.trim() || loading}
                    className="ml-3 font-semibold underline disabled:opacity-50"
                  >
                    {t("common.retry")}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-info)] bg-[var(--color-info-soft)] px-4 py-2.5">
              <p className="eyebrow text-[var(--color-info)]">{t("simulation.completed")}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--color-ink-muted)]">{t("simulation.completedBody")}</p>
            </div>
          )}

          {/* min-h-7 fits the stop button, so the row is the same height
              whether audio is playing or not and the scene above never moves. */}
          <div className="mt-2 flex min-h-7 flex-wrap items-center justify-between gap-x-4 gap-y-1">
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
              {t("simulation.autoRead")}
            </label>
            {/* Playback controls share this row rather than sitting above the
                composer. Above it, they appeared and vanished with every
                spoken line, and each time the scene -- which takes whatever
                height is left -- shrank and grew, the figure with it. */}
            {speakingMessageId ? (
              <button
                type="button"
                onClick={stopSpeaking}
                className="eyebrow eyebrow-tight inline-flex h-7 items-center gap-2 border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-2.5 text-[var(--color-danger)] transition-colors hover:bg-transparent"
              >
                <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse bg-[var(--color-danger)]" />
                {t("simulation.stopReading")}
              </button>
            ) : null}
            {/* Deliberately quiet rather than in the danger colour: a browser
                waiting for a gesture is not a failure. Clicking is itself the
                gesture, so the call to speak has to come straight from the
                handler. */}
            {audioGestureMessage ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const blocked = audioGestureMessage;
                    setAudioGestureMessage(null);
                    void speakMessage(blocked);
                  }}
                  className="link-editorial text-xs font-medium"
                >
                  {t("simulation.turnOnReadAloud")}
                </button>
                <span className="text-[11px] text-[var(--color-ink-soft)]">{t("simulation.gestureHint")}</span>
              </span>
            ) : null}
            {ttsError ? <span className="text-[11px] font-medium text-[var(--color-danger)]">{ttsError}</span> : null}
            {/* The safety line, with the note about the AI voice on hover: both
                must stay reachable, neither needs a box of its own. */}
            <p className="ml-auto text-[11px] leading-4 text-[var(--color-ink-soft)]" title={t("simulation.audioDisclaimer")}>
              {t("safety.summary")}
            </p>
          </div>
        </div>
      </div>

      {/* 4. The transcript, one click away. Kept mounted while closed --
          hidden and inert rather than removed -- so the history keeps its
          scroll position and the follow-the-latest-turn behaviour works the
          moment it opens. */}
      {transcriptOpen ? (
        <div
          aria-hidden
          onClick={() => setTranscriptOpen(false)}
          className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--color-ink)_22%,transparent)]"
        />
      ) : null}
      <aside
        id="simulation-transcript"
        aria-label={t("simulation.transcript")}
        inert={!transcriptOpen}
        // Off-screen and inert while closed, rather than visibility: hidden.
        // Transitioning visibility alongside the slide left the opened drawer
        // computed as hidden, and inert already takes it out of the tab order
        // and the accessibility tree.
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] shadow-[var(--shadow-lift)] transition-transform duration-300 ${
          transcriptOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="eyebrow text-[var(--color-ink)]">{t("simulation.transcript")}</h2>
          <button
            ref={transcriptCloseRef}
            type="button"
            onClick={() => setTranscriptOpen(false)}
            className="btn-editorial btn-editorial--quiet min-h-8 px-3 py-1"
          >
            {t("simulation.closeTranscript")}
          </button>
        </div>
        <div
          ref={scrollRef}
          onScroll={handleHistoryScroll}
          tabIndex={0}
          aria-label={t("simulation.history")}
          aria-busy={loading}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-pb-4 px-4 py-4"
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
      </aside>
    </AppShell>
  );
}
