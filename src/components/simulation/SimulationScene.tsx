"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { MetricChip } from "@/components/common/VisualCards";
import { castPortraits, portraitSrc } from "@/lib/avatars/avatars";
import { useT, type StringKey } from "@/lib/i18n/strings";
import { isPatientDeceased } from "@/lib/scenarios/patientStatus";
import { sceneForScenario, sceneSrc } from "@/lib/scenes/scenes";
import { expressions, isCastRole, type CastMember, type CastRole, type Expression } from "@/types/cast";
import type { Scenario } from "@/types/scenario";
import type { SimulationMessage, TensionLevel } from "@/types/simulation";
import {
  SpeakerIcon,
  SpeakerStopIcon,
  TypingCursor,
  TypingDots,
  useRevealedWordCount,
} from "./ChatMessageList";
import type { RevealStore } from "./revealStore";
import type { SpeakingLevelStore } from "./speakingLevel";

/**
 * The roleplay as a scene: the scenario's room filling the stage, the person
 * the trainee is talking to standing in it, and what they just said in a
 * dialogue box beneath them.
 *
 * It replaced a chat log with a portrait column beside it. That put the face
 * in a 320px strip -- on a 1000px-tall screen the person was cut off at the
 * neck -- and the words in white cards on the other side of the panel, so the
 * eye went back and forth between who was speaking and what they said. The
 * full transcript is still one click away in a drawer; this is the first read.
 *
 * Only people who have spoken stand in the room, so a deceased or sedated
 * patient never appears. At most two at once: the speaker in front, the last
 * other person to speak dimmed at the side -- enough for a wife and husband
 * who disagree, without the room filling with everyone named in the cast.
 */

type Tone = "slate" | "emerald" | "amber" | "rose" | "blue" | "indigo";

const expressionTone: Record<Expression, Tone> = {
  calm: "slate",
  worried: "amber",
  shocked: "amber",
  angry: "rose",
  grieving: "blue",
  relieved: "emerald",
};

/* How far the edges of the room darken as tension rises: atmosphere, kept
   faint so it reads as mood rather than an effect. */
const vignetteStrength: Record<TensionLevel, number> = { low: 0, medium: 12, high: 24 };

/*
 * Titles that open a name but identify nobody on their own, with the gender
 * they imply. Families share a surname, so "Mrs. Sharma" is the mother and not
 * her son Rahul Sharma -- the title is what tells them apart.
 */
const HONORIFICS: Record<string, CastMember["gender"] | null> = {
  mr: "male",
  shri: "male",
  sri: "male",
  mrs: "female",
  ms: "female",
  miss: "female",
  smt: "female",
  dr: null,
  "श्री": "male",
  "श्रीमती": "female",
  "डॉ": null,
};

function nameWords(name: string): string[] {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/\.$/, ""))
    .filter((word) => word.length > 1 && !(word in HONORIFICS));
}

/**
 * Where a cast member is first named in the opening line, or -1. A given name
 * counts wherever it appears. A surname alone counts only when the title
 * before it, if any, fits their gender -- and loses a tie to a given name.
 */
function firstMention(opening: string, member: CastMember): number {
  const text = opening.toLowerCase();
  const [given, ...family] = nameWords(member.name);

  if (!given) {
    return -1;
  }

  const givenAt = text.indexOf(given);

  if (givenAt >= 0) {
    return givenAt;
  }

  for (const surname of family) {
    for (let at = text.indexOf(surname); at >= 0; at = text.indexOf(surname, at + 1)) {
      const before = text.slice(0, at).trim().split(/\s+/).at(-1)?.replace(/\.$/, "") ?? "";
      const implied = before in HONORIFICS ? HONORIFICS[before] : null;

      if (!implied || implied === member.gender) {
        return at + 0.5;
      }
    }
  }

  return -1;
}

/**
 * Who stands in the room before anyone has spoken: whoever the opening
 * narration names first, and when it names nobody, the relative, then the
 * patient, then anyone else.
 */
function openingRole(scenario: Scenario, opening: string): CastRole | null {
  const eligible = (scenario.cast ?? []).filter(
    (member) => !(member.role === "patient" && isPatientDeceased(scenario)),
  );

  const named = eligible
    .map((member) => ({ role: member.role, at: firstMention(opening, member) }))
    .filter((entry) => entry.at >= 0)
    .sort((a, b) => a.at - b.at)[0];

  if (named) {
    return named.role;
  }

  const roles = new Set(eligible.map((member) => member.role));
  const order: CastRole[] = ["family_member", "patient", "bystander", "nurse"];

  return order.find((role) => roles.has(role)) ?? null;
}

type ScenePerson = {
  role: CastRole;
  name: string;
  relationship: string;
  expression: Expression;
  portraitId: string | undefined;
};

function useScene(scenario: Scenario, messages: SimulationMessage[]) {
  const portraits = useMemo(() => castPortraits(scenario), [scenario]);

  return useMemo(() => {
    const scenarioLines = messages.filter((message) => message.role === "scenario");
    const characterLines = scenarioLines.filter(
      (message): message is SimulationMessage & { speaker: CastRole } => isCastRole(message.speaker),
    );

    const person = (role: CastRole): ScenePerson => {
      const member = scenario.cast?.find((entry) => entry.role === role);
      const lastOwnLine = characterLines.filter((line) => line.speaker === role).at(-1);

      return {
        role,
        name: member?.name ?? "",
        relationship: member?.relationship ?? "",
        expression: lastOwnLine?.expression ?? member?.expression ?? "calm",
        portraitId: portraits[role],
      };
    };

    const activeRole =
      characterLines.at(-1)?.speaker ?? openingRole(scenario, scenarioLines[0]?.content ?? "");
    const secondaryRole =
      [...characterLines].reverse().find((line) => line.speaker !== activeRole)?.speaker ?? null;

    const line = scenarioLines.at(-1) ?? null;
    const lineIndex = line ? messages.indexOf(line) : -1;
    const answered = lineIndex > 0 && messages[lineIndex - 1].role === "trainee" ? messages[lineIndex - 1] : null;

    return {
      active: activeRole ? person(activeRole) : null,
      secondary: secondaryRole ? person(secondaryRole) : null,
      line,
      answered,
      activeLineIds: new Set(
        characterLines.filter((entry) => entry.speaker === activeRole).map((entry) => entry.id),
      ),
    };
  }, [messages, portraits, scenario]);
}

/**
 * The speaker as a cut-out standing in the room, glowing along their own
 * outline while they talk. Its own component so only the figure repaints on
 * every level change, not the scene around it.
 */
function SpeakingFigure({
  src,
  alt,
  speaking,
  level,
}: {
  src: string;
  alt: string;
  speaking: boolean;
  level: SpeakingLevelStore;
}) {
  const value = useSyncExternalStore(level.subscribe, level.getLevel, () => 0);

  // A soft contact shadow always, so the figure sits in the room rather than
  // floating over it; the green glow only while they speak.
  const grounding = "drop-shadow(0 10px 18px color-mix(in srgb, var(--color-ink) 22%, transparent))";
  const glow = speaking
    ? ` drop-shadow(0 0 ${2 + value * 9}px color-mix(in srgb, var(--color-primary) ${55 + value * 40}%, transparent))`
    : "";

  return (
    // Keyed on the image so a change of expression remounts it and fades in.
    // eslint-disable-next-line @next/next/no-img-element -- tiny static WebP; next/image adds a loader round trip for nothing
    <img key={src} src={src} alt={alt} className="portrait-fade h-full w-auto" style={{ filter: grounding + glow }} />
  );
}

/** The latest line, revealed in time with the voice exactly as the transcript reveals it. */
function RevealedLine({ message, reveal }: { message: SimulationMessage; reveal: RevealStore }) {
  const words = message.content.split(" ");
  const count = useRevealedWordCount(reveal, message.id);

  if (count === 0) {
    return <TypingDots className="py-2 align-middle" />;
  }

  const stillRevealing = count < words.length;

  return (
    <>
      {stillRevealing ? words.slice(0, count).join(" ") : message.content}
      {stillRevealing ? <TypingCursor /> : null}
    </>
  );
}

export function SimulationScene({
  scenario,
  messages,
  tensionLevel,
  reveal,
  speakingMessageId,
  level,
  loading,
  pendingLine,
  onSpeak,
  onOpenTranscript,
}: {
  scenario: Scenario;
  messages: SimulationMessage[];
  tensionLevel: TensionLevel;
  reveal: RevealStore;
  speakingMessageId: string | null;
  level: SpeakingLevelStore;
  /** A reply is being written: the person is about to speak. */
  loading: boolean;
  /** What the trainee just sent, shown as theirs while the reply is on its way. */
  pendingLine: string | null;
  onSpeak: (message: SimulationMessage) => void;
  onOpenTranscript: () => void;
}) {
  const t = useT();
  const { active, secondary, line, answered, activeLineIds } = useScene(scenario, messages);
  const speaking = Boolean(speakingMessageId && activeLineIds.has(speakingMessageId));
  const scene = sceneForScenario(scenario);
  const deceased = isPatientDeceased(scenario);

  // Warm the cache with every face this cast can make, so a change of
  // expression mid-line is a fade and not an empty space while it downloads.
  useEffect(() => {
    for (const portraitId of Object.values(castPortraits(scenario))) {
      if (!portraitId) {
        continue;
      }

      for (const expression of expressions) {
        const image = new Image();
        image.src = portraitSrc(portraitId, expression);
      }
    }
  }, [scenario]);

  const label = (person: ScenePerson) => person.name || t(`speaker.${person.role}` as StringKey);
  const moodLabel = (person: ScenePerson) => t(`expression.${person.expression}` as StringKey);
  const yourLine = loading ? pendingLine : answered?.content;
  const narrating = line?.speaker === "narrator";

  return (
    <section aria-label={t("simulation.sceneLabel")} className="relative flex min-h-0 flex-col lg:h-full">
      {/* The room. On a phone it is the top of the screen with the dialogue
          below it; from lg up it fills the stage and the dialogue sits over
          its floor. */}
      <div className="relative isolate h-[42vh] min-h-64 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] shadow-[var(--shadow-soft)] lg:absolute lg:inset-0 lg:h-auto lg:min-h-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- static backdrop, decorative */}
        <img
          src={sceneSrc(scene)}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover"
          style={{ objectPosition: "50% 45%" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background: `radial-gradient(ellipse at 35% 55%, transparent 55%, color-mix(in srgb, var(--color-ink) ${vignetteStrength[tensionLevel]}%, transparent) 100%)`,
          }}
        />

        {/* Stops short of the Transcript tab, so a long setting name wraps
            instead of running underneath it on a phone. */}
        <div className="absolute top-3 left-3 flex max-w-[calc(100%-9rem)] flex-wrap gap-2">
          <span className="rounded-full bg-[color-mix(in_srgb,var(--color-surface)_85%,transparent)] px-3 py-1 text-xs text-[var(--color-ink-soft)] backdrop-blur-sm">
            {scenario.setting}
          </span>
          {/* Said in words, because a deceased patient is the one person the
              trainee is talking about but never sees. */}
          {deceased ? (
            <span className="rounded-full bg-[color-mix(in_srgb,var(--color-surface)_85%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)] backdrop-blur-sm">
              {t("simulation.patientDeceasedTag")}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onOpenTranscript}
          className="absolute top-3 right-0 rounded-l-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-surface)_92%,transparent)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] shadow-[var(--shadow-card)] backdrop-blur-sm transition-colors hover:text-[var(--color-primary)]"
        >
          {t("simulation.transcriptCount", { n: messages.length })}
        </button>

        {/* The second person first, so the speaker stands in front of them. */}
        {secondary?.portraitId ? (
          // Not on a phone: in a room 360px wide the two figures overlap into
          // one shape, and the speaker matters more than the listener.
          <div className="absolute right-[5%] bottom-0 hidden h-[64%] sm:block">
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny static WebP */}
            <img
              key={secondary.portraitId + secondary.expression}
              src={portraitSrc(secondary.portraitId, secondary.expression)}
              alt={t("stage.portraitAlt", { name: label(secondary), expression: moodLabel(secondary) })}
              className="portrait-fade h-full w-auto"
              // Dimmed and set back, so it is plain who is talking now.
              style={{ filter: "brightness(0.82) saturate(0.85) drop-shadow(0 8px 14px color-mix(in srgb, var(--color-ink) 18%, transparent))" }}
            />
          </div>
        ) : null}

        {active?.portraitId ? (
          <div className="figure-breathe absolute bottom-0 left-[4%] h-[84%] lg:h-[82%]">
            <SpeakingFigure
              src={portraitSrc(active.portraitId, active.expression)}
              alt={t("stage.portraitAlt", { name: label(active), expression: moodLabel(active) })}
              speaking={speaking}
              level={level}
            />
          </div>
        ) : null}
      </div>

      {/* What was just said: the trainee's line, then the reply under the
          person who gave it. Below the room on a phone, over its floor from
          lg up. */}
      <div className="relative mt-2 flex flex-col items-end gap-2 lg:absolute lg:inset-x-4 lg:bottom-4 lg:mt-0">
        {yourLine ? (
          <div className="max-w-[min(26rem,80%)] rounded-[var(--radius-lg)] rounded-br-sm bg-[var(--color-primary)] px-3 py-2 text-sm text-white shadow-[var(--shadow-card)]">
            <p className="text-[10px] font-semibold tracking-[0.08em] uppercase opacity-75">
              {t("simulation.youSaid")}
            </p>
            <p className="line-clamp-2">{yourLine}</p>
          </div>
        ) : null}

        {line || loading ? (
          <div className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_94%,transparent)] px-4 py-3 shadow-[var(--shadow-lift)] backdrop-blur-md">
            {/* The header row: who is speaking, and a replay button. Narration
                has no speaker to name, but it can still be heard again. */}
            {loading || line ? (
              <div className={`flex flex-wrap items-center gap-2 ${narrating && !loading ? "float-right ml-3" : "mb-1.5"}`}>
                {active && (loading || !narrating) ? (
                  <>
                    <strong className="text-[0.9375rem] text-[var(--color-ink)]">{label(active)}</strong>
                    {active.relationship && active.relationship !== label(active) ? (
                      <span className="text-xs text-[var(--color-ink-soft)]">{active.relationship}</span>
                    ) : null}
                    <MetricChip label={t("stage.mood")} value={moodLabel(active)} tone={expressionTone[active.expression]} />
                  </>
                ) : null}
                {line && !loading ? (
                  <button
                    type="button"
                    onClick={() => onSpeak(line)}
                    title={speakingMessageId === line.id ? t("chat.stopReading") : t("chat.readAloud")}
                    aria-label={speakingMessageId === line.id ? t("chat.stopReadingAria") : t("chat.readAloudAria")}
                    className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)] transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                  >
                    {speakingMessageId === line.id ? <SpeakerStopIcon /> : <SpeakerIcon />}
                  </button>
                ) : null}
              </div>
            ) : null}

            {loading ? (
              <TypingDots className="py-2" />
            ) : line ? (
              <p
                className={`min-h-6 text-base leading-7 lg:text-[1.0625rem] ${
                  // Narration is a stage direction, not a character's words.
                  narrating ? "italic text-[var(--color-ink-muted)]" : "text-[var(--color-ink)]"
                }`}
              >
                <RevealedLine message={line} reveal={reveal} />
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* The words revealed on screen arrive a few at a time; a screen reader
          should hear the line once, whole, when it lands. */}
      <p className="sr-only" aria-live="polite">
        {line && !loading
          ? `${line.speaker && line.speaker !== "narrator" && active ? label(active) : t("speaker.narrator")}: ${line.content}`
          : ""}
      </p>
    </section>
  );
}
