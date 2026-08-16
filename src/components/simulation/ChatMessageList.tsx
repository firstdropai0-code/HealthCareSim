"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { springSoft } from "@/components/motion/motionConfig";
import { useShouldAnimate } from "@/components/motion/useShouldAnimate";
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

export function useTypedWords(text: string, enabled: boolean, wordDelayMs = 55) {
  const [wordCount, setWordCount] = useState(enabled ? 0 : Infinity);
  const words = text.split(" ");

  useEffect(() => {
    if (!enabled) {
      setWordCount(Infinity);
      return undefined;
    }

    setWordCount(0);
    let index = 0;
    const interval = window.setInterval(() => {
      index += 1;
      setWordCount(index);
      if (index >= words.length) {
        window.clearInterval(interval);
      }
    }, wordDelayMs);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, enabled]);

  return words.slice(0, wordCount).join(" ");
}

function TypingCursor() {
  return <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-current align-middle" />;
}

export function TypingIndicator() {
  const shouldAnimate = useShouldAnimate();

  const dots = (
    <div className="flex items-center gap-1.5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 shadow-[var(--shadow-card)]">
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
  shouldType: boolean;
  onSpeak?: (message: SimulationMessage) => void;
  isSpeaking?: boolean;
};

function ChatMessage({ message, shouldType, onSpeak, isSpeaking = false }: ChatMessageProps) {
  const shouldAnimate = useShouldAnimate();
  const isTrainee = message.role === "trainee";
  const messageLabel =
    message.role === "scenario" && message.speaker
      ? speakerLabels[message.speaker]
      : roleLabels[message.role];
  const typed = useTypedWords(message.content, shouldType && !isTrainee);
  const isStillTyping = shouldType && !isTrainee && typed.length < message.content.length;
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
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
          {isTrainee ? message.content : typed}
          {isStillTyping ? <TypingCursor /> : null}
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
  onSpeak?: (message: SimulationMessage) => void;
  speakingMessageId?: string | null;
};

export function ChatMessageList({ messages, onSpeak, speakingMessageId }: ChatMessageListProps) {
  const seenIds = useRef<Set<string>>(new Set());
  const isFirstRender = useRef(true);

  if (isFirstRender.current) {
    messages.forEach((message) => seenIds.current.add(message.id));
    isFirstRender.current = false;
  }

  const rendered = messages.map((message) => {
    const shouldType = !seenIds.current.has(message.id);
    seenIds.current.add(message.id);

    return (
      <ChatMessage
        key={message.id}
        message={message}
        shouldType={shouldType}
        onSpeak={onSpeak}
        isSpeaking={speakingMessageId === message.id}
      />
    );
  });

  return <div className="space-y-4">{rendered}</div>;
}
