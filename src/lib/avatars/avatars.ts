import library from "./avatarLibrary.json";
import { isPatientDeceased } from "@/lib/scenarios/patientStatus";
import { stableHash } from "@/lib/stableHash";
import { castRoles, type CastAgeBand, type CastGender, type CastRole, type Expression } from "@/types/cast";
import type { Scenario } from "@/types/scenario";

/**
 * Chooses which illustrated person plays each role in a scenario.
 *
 * The library is small and fixed (see scripts/generateAvatars.mjs for why), so
 * this is a lookup, not a generation: the cast entry's gender must match, the
 * age band is matched as closely as the library allows, and nurses only ever
 * draw from the uniformed portraits. The choice is derived from the scenario id
 * rather than stored, so every viewer of a scenario sees the same faces without
 * a schema change for something that is purely presentation.
 */

type LibraryPerson = {
  id: string;
  gender: CastGender;
  ageBand: CastAgeBand;
  kind: "civilian" | "nurse";
};

const people = library.characters as LibraryPerson[];

/*
 * Nearest acceptable age bands, best first. A child never falls through to an
 * adult face: a missing portrait reads as a plain tile, but a grown woman
 * speaking as a frightened eight-year-old reads as a mistake.
 */
const AGE_FALLBACK: Record<CastAgeBand, CastAgeBand[]> = {
  child: ["child"],
  young_adult: ["young_adult", "adult"],
  adult: ["adult", "young_adult", "older"],
  older: ["older", "adult"],
};

function rotate<T>(list: T[], offset: number): T[] {
  if (list.length === 0) {
    return list;
  }

  const start = offset % list.length;
  return [...list.slice(start), ...list.slice(0, start)];
}

/**
 * Portrait id per role, for the roles that have one. Each person is used once
 * per scenario, so a mother and a bystander of the same age never share a face.
 */
export function castPortraits(scenario: Scenario): Partial<Record<CastRole, string>> {
  const cast = scenario.cast ?? [];
  const seed = stableHash(scenario.id);
  const used = new Set<string>();
  const portraits: Partial<Record<CastRole, string>> = {};

  // A fixed role order, so the same scenario always casts the same faces.
  for (const role of castRoles) {
    const member = cast.find((entry) => entry.role === role);

    // A deceased patient is never on stage, so they do not take a face that a
    // living relative of the same age and gender could have had.
    if (!member || (role === "patient" && isPatientDeceased(scenario))) {
      continue;
    }

    const kind = role === "nurse" ? "nurse" : "civilian";
    const pool = people.filter((person) => person.kind === kind && person.gender === member.gender);
    const bands = kind === "nurse" ? [null] : AGE_FALLBACK[member.ageBand];

    // Within each acceptable band, rotate by scenario so two cases that both
    // have a mother in her forties do not both show the same woman.
    const ranked = bands.flatMap((band) =>
      rotate(
        pool.filter((person) => band === null || person.ageBand === band),
        seed + role.length,
      ),
    );

    const pick = ranked.find((person) => !used.has(person.id)) ?? ranked[0];

    if (pick) {
      used.add(pick.id);
      portraits[role] = pick.id;
    }
  }

  return portraits;
}

export function portraitSrc(portraitId: string, expression: Expression): string {
  return `/avatars/${portraitId}/${expression}.webp`;
}
