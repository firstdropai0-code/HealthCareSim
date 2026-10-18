/**
 * The people in a scenario, as the simulation stage draws them.
 *
 * Kept apart from the free-text brief fields because these drive code: gender
 * picks both the portrait and the voice, age band narrows the portrait, and the
 * expression is a closed set with one image each. Free text would leave every
 * consumer guessing at "mid-forties, frantic" the way patientEmotion once left
 * the brief guessing at "Deceased".
 */

/** Every speaker except the narrator, who is a voice and never a face. */
export const castRoles = ["patient", "family_member", "nurse", "bystander"] as const;

export type CastRole = (typeof castRoles)[number];

export type CastGender = "female" | "male";

export type CastAgeBand = "child" | "young_adult" | "adult" | "older";

/*
 * One portrait exists per expression per person, so this list is also the
 * shape of public/avatars/. It must match the keys of "expressions" in
 * src/lib/avatars/avatarLibrary.json -- adding one here without regenerating
 * the library leaves the stage pointing at images that do not exist.
 */
export const expressions = ["calm", "worried", "shocked", "angry", "grieving", "relieved"] as const;

export type Expression = (typeof expressions)[number];

export type CastMember = {
  role: CastRole;
  /** In the scenario's language, as the characters would say it. */
  name: string;
  /** Their relationship to the patient, e.g. "Mother". "Patient" for the patient. */
  relationship: string;
  gender: CastGender;
  ageBand: CastAgeBand;
  /** How they look when the conversation opens, before their first line. */
  expression: Expression;
};

export function isCastRole(value: unknown): value is CastRole {
  return typeof value === "string" && (castRoles as readonly string[]).includes(value);
}

export function isExpression(value: unknown): value is Expression {
  return typeof value === "string" && (expressions as readonly string[]).includes(value);
}
