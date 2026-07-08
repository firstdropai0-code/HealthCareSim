"use client";

import { useEffect, useRef, useState } from "react";
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

function useTypedWords(text: string, enabled: boolean, wordDelayMs = 55) {
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
  return (
    <div className="flex justify-start">
      <div className="animate-fade-up flex items-center gap-1.5 rounded-[1.25rem] rounded-bl-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 shadow-[var(--shadow-card)]">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-primary)]"
            style={{ animationDelay: `${dot * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

type ChatMessageProps = {
  message: SimulationMessage;
  shouldType: boolean;
};

function ChatMessage({ message, shouldType }: ChatMessageProps) {
  const isTrainee = message.role === "trainee";
  const messageLabel =
    message.role === "scenario" && message.speaker
      ? speakerLabels[message.speaker]
      : roleLabels[message.role];
  const typed = useTypedWords(message.content, shouldType && !isTrainee);
  const isStillTyping = shouldType && !isTrainee && typed.length < message.content.length;

  return (
    <article className={`animate-fade-up flex ${isTrainee ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[92%] rounded-[1.25rem] px-4 py-3 shadow-[var(--shadow-card)] transition-transform duration-300 hover:-translate-y-0.5 sm:max-w-3xl ${
          isTrainee
            ? "rounded-br-md bg-gradient-to-br from-[#12897d] via-[var(--color-primary)] to-[#0b4a45] text-white"
            : "rounded-bl-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)]"
        }`}
      >
        <p
          className={`text-xs font-semibold uppercase tracking-[0.12em] ${
            isTrainee ? "text-teal-50" : "text-[var(--color-ink-soft)]"
          }`}
        >
          {messageLabel}
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
          {isTrainee ? message.content : typed}
          {isStillTyping ? <TypingCursor /> : null}
        </p>
      </div>
    </article>
  );
}

type ChatMessageListProps = {
  messages: SimulationMessage[];
};

export function ChatMessageList({ messages }: ChatMessageListProps) {
  const seenIds = useRef<Set<string>>(new Set());
  const isFirstRender = useRef(true);

  if (isFirstRender.current) {
    messages.forEach((message) => seenIds.current.add(message.id));
    isFirstRender.current = false;
  }

  const rendered = messages.map((message) => {
    const shouldType = !seenIds.current.has(message.id);
    seenIds.current.add(message.id);

    return <ChatMessage key={message.id} message={message} shouldType={shouldType} />;
  });

  return <div className="space-y-4">{rendered}</div>;
}
