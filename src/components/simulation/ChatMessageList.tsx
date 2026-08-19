"use client";

import { motion } from "framer-motion";
import { useCallback, useSyncExternalStore } from "react";
import { springSoft } from "@/components/motion/motionConfig";
import { useShouldAnimate } from "@/components/motion/useShouldAnimate";
import { completedRevealStore, type RevealStore } from "@/components/simulation/revealStore";
import type { SimulationMessage } from "@/types/simulation";

const roleLabels: Record<SimulationMessage["role"], string> = {
  system: "System",
  scenario: "Scenario",
  trainee: "Trainee",
  feedback: "Feedback",
};

const speakerLabels: Record<NonNullable<SimulationMessage["speaker"]>, string> = {
  patient: "Patient",
  family_member: "Family member",
  nurse: "Nurse",
  bystander: "Bystander",
  narrator: "Narrator",
};

/**
 * How many words of this message are currently revealed.
 *
 * Each bubble subscribes to its own id, so a progress tick from the voice
 * re-renders one bubble rather than the whole transcript.
 *
 * The server snapshot is `Infinity`: SSR and hydration render the full
 * transcript, matching the rule that a transcript is never gated behind an
 * animation.
 */
function useRevealedWordCount(reveal: RevealStore, messageId: string) {
  const subscribe = useCallback(
    (onChange: () => void) => reveal.subscribe(messageId, onChange),
    [reveal, messageId],
  );
  const getWordCount = useCallback(() => reveal.getWordCount(messageId), [reveal, messageId]);

  return useSyncExternalStore(subscribe, getWordCount, () => Infinity);
}

function TypingCursor() {
  return <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-current align-middle" />;
}

/**
 * Three dots travelling in sequence.
 *
 * The movement is the whole point, which is why a cursor will not do here. A
 * cursor blinking on an empty line is indistinguishable from one that has
 * stopped part-way through a word, so the wait before a voice arrives read as
 * the app having frozen rather than as a turn on its way.
 */
function TypingDots({ className = "" }: { className?: string }) {
  const shouldAnimate = useShouldAnimate();

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} aria-hidden>
      {[0, 1, 2].map((dot) =>
        shouldAnimate ? (
          <motion.span
            key={dot}
            className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: dot * 0.15 }}
          />
        ) : (
          <span key={dot} className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />
        ),
      )}
    </span>
  );
}

export function TypingIndicator() {
  const shouldAnimate = useShouldAnimate();

  const dots = (
    <div className="flex items-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 shadow-[var(--shadow-card)]">
      <TypingDots />
    </div>
  );

  if (!shouldAnimate) {
    return <div className="flex justify-start">{dots}</div>;
  }

  return (
    <motion.div
      className="flex justify-start"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
    >
      {dots}
    </motion.div>
  );
}

type ChatMessageProps = {
  message: SimulationMessage;
  reveal: RevealStore;
  onSpeak?: (message: SimulationMessage) => void;
  isSpeaking?: boolean;
};

function ChatMessage({ message, reveal, onSpeak, isSpeaking = false }: ChatMessageProps) {
  const shouldAnimate = useShouldAnimate();
  const isTrainee = message.role === "trainee";
  const messageLabel =
    message.role === "scenario" && message.speaker
      ? speakerLabels[message.speaker]
      : roleLabels[message.role];
  const words = message.content.split(" ");
  const wordCount = useRevealedWordCount(reveal, message.id);
  const isStillRevealing = wordCount < words.length;
  const shown = isStillRevealing ? words.slice(0, wordCount).join(" ") : message.content;
  // Armed, but not a word of it revealed yet: the turn has arrived and is
  // waiting on the voice that will pace it.
  const isAwaitingFirstWord = wordCount === 0;
  const canSpeak = !isTrainee && Boolean(onSpeak) && message.content.trim().length > 0;

  const bubble = (
    <div
        className={`max-w-[92%] rounded-[var(--radius-lg)] px-4 py-3 sm:max-w-3xl ${
          isTrainee
            ? "bg-gradient-to-br from-[var(--color-primary-strong)] to-[var(--color-primary)] text-white shadow-[var(--shadow-accent)]"
            : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[var(--shadow-card)]"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <p
            className={`eyebrow ${
              isTrainee ? "text-white/75" : "text-[var(--color-ink-soft)]"
            }`}
          >
            {messageLabel}
          </p>
          {canSpeak ? (
            <button
              type="button"
              onClick={() => onSpeak?.(message)}
              title={isSpeaking ? "Stop reading" : "Read this message aloud"}
              aria-label={isSpeaking ? "Stop reading message aloud" : "Read message aloud"}
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)] transition-colors duration-200 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
            >
              {isSpeaking ? <SpeakerStopIcon /> : <SpeakerIcon />}
            </button>
          ) : null}
        </div>
        {/* min-h-6 reserves the line so the bubble does not jump when the
            dots give way to the first words. */}
        <p className="mt-2 min-h-6 whitespace-pre-wrap text-sm leading-6">
          {isAwaitingFirstWord ? (
            <TypingDots className="py-2 align-middle" />
          ) : (
            <>
              {shown}
              {isStillRevealing ? <TypingCursor /> : null}
            </>
          )}
        </p>
    </div>
  );

  const rowClass = `flex ${isTrainee ? "justify-end" : "justify-start"}`;

  // A transcript must never be gated behind an animation. When animation is
  // off, render a plain <article>: Framer Motion does not clear inline styles
  // it has already written, so reusing motion.article would strand the
  // hydrated `opacity: 0` on the node.
  if (!shouldAnimate) {
    return <article className={rowClass}>{bubble}</article>;
  }

  return (
    // Transform + opacity only. Animating height or scale would change the
    // scroller's measured content size and fight the auto-scroll logic in the
    // simulation page.
    <motion.article
      className={rowClass}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
    >
      {bubble}
    </motion.article>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="M4 9v6h4l5 4V5L8 9H4z"
        fill="currentColor"
      />
      <path
        d="M16 8.5a4 4 0 0 1 0 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SpeakerStopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      <rect x="14" y="9" width="6" height="6" rx="1" fill="currentColor" />
    </svg>
  );
}

type ChatMessageListProps = {
  messages: SimulationMessage[];
  /**
   * Drives the progressive reveal of newly arrived turns. Omitted where the
   * transcript is only being read back, in which case every message is shown
   * in full.
   */
  reveal?: RevealStore;
  onSpeak?: (message: SimulationMessage) => void;
  speakingMessageId?: string | null;
};

export function ChatMessageList({
  messages,
  reveal = completedRevealStore,
  onSpeak,
  speakingMessageId,
}: ChatMessageListProps) {
  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          reveal={reveal}
          onSpeak={onSpeak}
          isSpeaking={speakingMessageId === message.id}
        />
      ))}
    </div>
  );
}
