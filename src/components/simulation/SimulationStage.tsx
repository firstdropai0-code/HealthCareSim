"use client";

import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { MetricChip } from "@/components/common/VisualCards";
import { castPortraits, portraitSrc } from "@/lib/avatars/avatars";
import { useT, type StringKey } from "@/lib/i18n/strings";
import { isPatientDeceased } from "@/lib/scenarios/patientStatus";
import { expressions, isCastRole, type CastMember, type CastRole, type Expression } from "@/types/cast";
import type { Scenario } from "@/types/scenario";
import type { SimulationMessage } from "@/types/simulation";
import type { SpeakingLevelStore } from "./speakingLevel";

/**
 * Who the trainee is talking to, as a face rather than a label.
 *
 * Only people who have spoken are on stage. That one rule handles the cases a
 * cast list cannot: a deceased patient never speaks, so they never appear; a
 * sedated child never speaks either; and a nurse who is named in the cast but
 * never needed never crowds the room. The one exception is the opening, before
 * anyone has said a word, when the person the scene is about to put in front
 * of the trainee is shown so the stage is never empty.
 *
 * Every line is still in the transcript beside it. This is the first read --
 * who, and how they are taking it -- not a replacement for the words.
 */

type Tone = "slate" | "emerald" | "amber" | "rose" | "blue" | "indigo";

/* Calm and relieved read as settled; shock and worry as strain; grief as its
   own register rather than a kind of anger. */
const expressionTone: Record<Expression, Tone> = {
  calm: "slate",
  worried: "amber",
  shocked: "amber",
  angry: "rose",
  grieving: "blue",
  relieved: "emerald",
};

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
 * before it, if any, fits their gender -- and loses a tie to a given name, so
 * "Sunita" beats a "Sharma" at the same spot.
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
 * Who faces the trainee before anyone has spoken: whoever the opening
 * narration names first -- "Sunita looks at you and asks..." puts Sunita on
 * stage, not her husband -- and when it names nobody, the relative, then the
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

type StagePerson = {
  role: CastRole;
  name: string;
  relationship: string;
  expression: Expression;
  portraitId: string | undefined;
};

function useStage(scenario: Scenario, messages: SimulationMessage[]) {
  const portraits = useMemo(() => castPortraits(scenario), [scenario]);

  return useMemo(() => {
    const scenarioLines = messages.filter((message) => message.role === "scenario");
    const characterLines = scenarioLines.filter(
      (message): message is SimulationMessage & { speaker: CastRole } => isCastRole(message.speaker),
    );

    const person = (role: CastRole): StagePerson => {
      const member = scenario.cast?.find((entry) => entry.role === role);
      const lastOwnLine = characterLines.filter((line) => line.speaker === role).at(-1);

      return {
        role,
        name: member?.name ?? "",
        relationship: member?.relationship ?? "",
        // Their latest line's face, else how the cast says they arrive.
        expression: lastOwnLine?.expression ?? member?.expression ?? "calm",
        portraitId: portraits[role],
      };
    };

    const appeared = [...new Set(characterLines.map((line) => line.speaker))];
    const activeRole =
      characterLines.at(-1)?.speaker ?? openingRole(scenario, scenarioLines[0]?.content ?? "");

    return {
      active: activeRole ? person(activeRole) : null,
      others: appeared.filter((role) => role !== activeRole).map(person),
      // The latest line is narration: the stage keeps the last speaker but
      // says the scene is being described, so the face is not mistaken for
      // the source of the words.
      narrating: scenarioLines.at(-1)?.speaker === "narrator",
      activeLineIds: new Set(
        characterLines.filter((line) => line.speaker === activeRole).map((line) => line.id),
      ),
    };
  }, [messages, portraits, scenario]);
}

/**
 * The ring that breathes with the voice. Its own component so that it alone
 * re-renders on every level change, not the stage around it.
 */
function SpeakingRing({ level, speaking }: { level: SpeakingLevelStore; speaking: boolean }) {
  const value = useSyncExternalStore(level.subscribe, level.getLevel, () => 0);

  if (!speaking) {
    return null;
  }

  // A steady base ring says who is talking even where the voice cannot be
  // metered; the level only adds to it.
  const spread = 3 + value * 7;
  const strength = 45 + value * 45;

  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit] transition-shadow duration-75"
      style={{
        boxShadow: `inset 0 0 0 ${spread}px color-mix(in srgb, var(--color-primary) ${strength}%, transparent)`,
      }}
    />
  );
}

function PersonFallback({ role }: { role: CastRole }) {
  // Scenarios generated before the cast existed have no portrait to show.
  // A silhouette keeps the stage's shape, and the role label beneath it says
  // who is talking.
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      data-role={role}
      className="h-1/2 w-1/2 text-[var(--color-ink-soft)]"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function Portrait({
  person,
  className,
  speaking,
  level,
  alt,
  badge,
}: {
  person: StagePerson;
  className: string;
  speaking: boolean;
  level: SpeakingLevelStore;
  alt: string;
  /** Laid over the bottom of the portrait, where it costs no height. */
  badge?: ReactNode;
}) {
  const src = person.portraitId ? portraitSrc(person.portraitId, person.expression) : null;

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-[var(--color-canvas-soft)] ${className}`}
    >
      {src ? (
        // Keyed on the image so a change of expression remounts it and fades
        // in, rather than snapping between two faces.
        // eslint-disable-next-line @next/next/no-img-element -- tiny static WebP; next/image adds a loader round trip for nothing
        <img key={src} src={src} alt={alt} className="portrait-fade h-full w-full object-cover" />
      ) : (
        <PersonFallback role={person.role} />
      )}
      <SpeakingRing level={level} speaking={speaking} />
      {badge ? <div className="absolute bottom-2 left-2">{badge}</div> : null}
    </div>
  );
}

export function SimulationStage({
  scenario,
  messages,
  speakingMessageId,
  level,
  variant,
}: {
  scenario: Scenario;
  messages: SimulationMessage[];
  speakingMessageId: string | null;
  level: SpeakingLevelStore;
  /** "column" beside the history on wide screens; "compact" above it on narrow ones. */
  variant: "column" | "compact";
}) {
  const t = useT();
  const { active, others, narrating, activeLineIds } = useStage(scenario, messages);
  const speaking = Boolean(speakingMessageId && activeLineIds.has(speakingMessageId));

  // Warm the cache with every face this cast can make, so the first change of
  // expression mid-line is a fade and not a blank square while it downloads.
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

  if (!active) {
    return null;
  }

  const roleLabel = t(`speaker.${active.role}` as StringKey);
  const expressionLabel = t(`expression.${active.expression}` as StringKey);
  const name = active.name || roleLabel;
  // Without a cast the role is already the name, so it is not said twice.
  const detail =
    active.relationship && active.relationship !== name ? active.relationship : active.name ? roleLabel : "";
  const alt = t("stage.portraitAlt", { name, expression: expressionLabel });

  // Everyone else who has spoken, as small faces. Named in their title and
  // alt text; on the portrait they are a reminder of who else is in the room,
  // not a second focus.
  const othersRow =
    others.length > 0 ? (
      <ul className="flex -space-x-2" aria-label={t("stage.alsoHere")}>
        {others.map((person) => {
          const label = person.name || t(`speaker.${person.role}` as StringKey);

          return (
            <li key={person.role} title={label}>
              <Portrait
                person={person}
                className="h-8 w-8 rounded-full ring-2 ring-[var(--color-surface)]"
                speaking={false}
                level={level}
                alt={label}
              />
            </li>
          );
        })}
      </ul>
    ) : null;

  if (variant === "compact") {
    return (
      <section
        aria-label={t("stage.label")}
        className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-2.5"
      >
        <Portrait
          person={active}
          className="h-14 w-14 shrink-0 rounded-full"
          speaking={speaking}
          level={level}
          alt={alt}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--color-ink)]">{name}</p>
          <p className="truncate text-xs text-[var(--color-ink-soft)]">
            {narrating ? t("stage.narrating") : detail}
          </p>
        </div>
        <MetricChip label={t("stage.mood")} value={expressionLabel} tone={expressionTone[active.expression]} />
      </section>
    );
  }

  // The column beside the history. No card of its own: it sits inside the
  // conversation panel and shares its frame, so it reads as the other side of
  // the call rather than a widget next to it.
  return (
    <section aria-label={t("stage.label")} className="flex h-full min-h-0 flex-col p-3">
      {/* As wide as the column, and allowed to shrink when the panel is
          short: a fixed square was clipped there, and this way the face gets
          smaller instead of being cut off or pushing the composer down. The
          name follows straight under it rather than sinking to the bottom. */}
      <div className="relative flex min-h-0 shrink justify-center">
        <Portrait
          person={active}
          className="aspect-square max-h-full w-full max-w-48 rounded-[var(--radius-md)]"
          speaking={speaking}
          level={level}
          alt={alt}
          badge={
            <span className="rounded-full bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
              <MetricChip label={t("stage.mood")} value={expressionLabel} tone={expressionTone[active.expression]} />
            </span>
          }
        />
        {othersRow ? <div className="absolute top-2 right-2">{othersRow}</div> : null}
      </div>
      <p className="mt-2 shrink-0 truncate text-[0.9375rem] font-semibold leading-5 text-[var(--color-ink)]">{name}</p>
      <p className="mt-0.5 shrink-0 text-xs leading-4 text-[var(--color-ink-soft)]">
        {narrating ? t("stage.narrating") : detail}
      </p>
    </section>
  );
}
