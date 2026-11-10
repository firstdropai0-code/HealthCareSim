import type { NextSimulationTurn } from "@/types/simulation";

/**
 * How a clinician tends to open a sentence. A patient or relative's line that
 * starts this way is usually the model having slipped into the trainee's role.
 */
const doctorLikeStarts = [
  "i understand",
  "i can",
  "i will",
  "we are",
  "let me",
  "i'm going to",
  "i am going to",
  "i cannot share",
  "i can't share",
];

/*
 * What follows one of those openings when it is NOT the clinician talking.
 *
 * The bare prefix test used to catch the most ordinary things an upset relative
 * says -- "I can't believe nobody told us", "I will not calm down", "We are
 * not leaving", "I understand, but why did no one call?", "Let me see him" --
 * and each catch cost a second model call, and a canned narrator line when the
 * retry opened the same way. A refusal or a pushback is the other side of the
 * conversation, so those are let through.
 *
 * Kept narrow on purpose. "I can see this is hard" and "Let me see what I can
 * find out" are the clinician, so only the forms below are excused, and "I
 * can't share" / "I cannot share" are still caught by their own entries above.
 */
const negated = /^(?:'t\b|\s+(?:not|never|no longer)\b)/;

const excusedAfter: Record<string, RegExp> = {
  "i understand": /^,?\s+but\b/,
  "let me": /^\s+(?:see\s+(?:him|her|them|my|our)\b|in\b|through\b|go\b|talk to\b|speak to\b|be with\b|stay\b)/,
};

/**
 * True when a patient, relative or bystander line reads as the clinician
 * speaking. Nurse and narrator lines are exempt: a nurse legitimately says "I
 * can get the doctor", and narration is not speech.
 *
 * English only. A Hindi run has no equivalent check and relies on the prompt.
 */
export function appearsToSpeakAsTrainee(turn: Pick<NextSimulationTurn, "speaker" | "message">): boolean {
  if (turn.speaker === "nurse" || turn.speaker === "narrator") {
    return false;
  }

  const normalizedMessage = turn.message
    .trim()
    .replace(/^["'“”‘’]+/, "")
    // The model writes typographic apostrophes about as often as plain ones.
    .replace(/[‘’]/g, "'")
    .toLowerCase();

  return doctorLikeStarts.some((phrase) => {
    if (!normalizedMessage.startsWith(phrase)) {
      return false;
    }

    const rest = normalizedMessage.slice(phrase.length);

    // A whole word only: "i can" is not "I cancelled", "I cannot" or, for "we
    // are", "we aren't".
    if (/^[a-z]/.test(rest)) {
      return false;
    }

    return !negated.test(rest) && !excusedAfter[phrase]?.test(rest);
  });
}
