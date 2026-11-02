import { languageDirective } from "@/types/language";
import type { PresenceWindowMetrics } from "@/types/presence";
import type { ScenarioSpeaker, SimulationState } from "@/types/simulation";

/**
 * Coaching on which way the trainee's head was pointing. A separate call in a
 * separate file from the scoring prompt, for the same reason as delivery
 * coaching: "the camera does not affect the score" is then structurally true,
 * because the scoring call never receives this data.
 *
 * That is also why a mentor's custom criterion about body language still comes
 * back "could not be assessed". Custom criteria are judged inside the scoring
 * call, so handing them these numbers would put them in front of the scorer.
 */

/* Too little to say anything about, however it went. */
const MIN_MEASURED_SECONDS = 10;
const QUOTE_WORDS = 14;

/* Below both of these a look away is ordinary, and not worth a trainee's time. */
const NOTABLE_TURN_AWAY_SECONDS = 3;
const NOTABLE_TURNS_AWAY = 3;

const SPEAKER_WORDS: Record<ScenarioSpeaker, string> = {
  patient: "the patient",
  family_member: "the family member",
  nurse: "the nurse",
  bystander: "the bystander",
  narrator: "the narrator",
};

/* The person's name, because the one on screen is often not the patient: in some
   cases the patient has died or is sedated and the trainee is talking to family.
   The name alone: given "Priya Sharma (Mother)", the model copied the brackets
   straight into the tips. */
function personSpeaking(state: SimulationState, speaker: ScenarioSpeaker | undefined): string {
  const member = state.scenario.cast?.find((entry) => entry.role === speaker);

  return member?.name || SPEAKER_WORDS[speaker ?? "narrator"];
}

/* An unreliable window is left out altogether, so the model is never shown a
   number it must then be told to ignore. A dark room is not inattention. */
function describeWindow(metrics: PresenceWindowMetrics | null) {
  if (!metrics?.reliable) {
    return null;
  }

  return {
    // Not "seconds": the model read that as a time, as in "at the 11-second mark".
    lastedSeconds: Math.round(metrics.durationSec),
    facingPercent: Math.round(metrics.facingRatio * 100),
    timesTurnedAway: metrics.lookAwayCount,
    longestTurnAwaySeconds: metrics.longestLookAwaySec,
  };
}

type DescribedWindow = NonNullable<ReturnType<typeof describeWindow>>;

function isNotable(window: DescribedWindow | null): window is DescribedWindow {
  return (
    window !== null &&
    (window.longestTurnAwaySeconds >= NOTABLE_TURN_AWAY_SECONDS ||
      window.timesTurnedAway >= NOTABLE_TURNS_AWAY)
  );
}

/**
 * What the model gets to see: the moments worth mentioning, and who the trainee
 * was talking to. Null when too little was measured to say anything.
 *
 * Filtered here rather than left to a rule in the prompt. Told to skip a
 * 1.5-second look away, the model flagged it anyway, because the number was in
 * front of it. It can't nitpick a moment it was never shown.
 */
function describeRun(state: SimulationState) {
  const people = new Set<string>();
  let measuredSeconds = 0;

  const moments = state.messages.flatMap((message, index) => {
    if (message.role !== "trainee") {
      return [];
    }

    const line = state.messages.slice(0, index).findLast((entry) => entry.role === "scenario");
    // Narration is a stage direction with nobody behind it, so there was no one
    // to turn away from. Every run opens with some.
    const hadSomeoneSpeaking = line !== undefined && line.speaker !== "narrator";
    const whileTheySpoke = hadSomeoneSpeaking ? describeWindow(message.presence?.listening ?? null) : null;
    const whileYouSpoke = describeWindow(message.presence?.speaking ?? null);

    measuredSeconds += (whileTheySpoke?.lastedSeconds ?? 0) + (whileYouSpoke?.lastedSeconds ?? 0);

    if (whileTheySpoke && line) {
      people.add(personSpeaking(state, line.speaker));
    }

    return [
      ...(isNotable(whileTheySpoke) && line
        ? [
            {
              whileTheySpoke: {
                person: personSpeaking(state, line.speaker),
                lineStartedWith: line.content.split(/\s+/).slice(0, QUOTE_WORDS).join(" "),
                ...whileTheySpoke,
              },
            },
          ]
        : []),
      ...(isNotable(whileYouSpoke) ? [{ whileYouSpoke }] : []),
    ];
  });

  return measuredSeconds >= MIN_MEASURED_SECONDS ? { moments, people: [...people] } : null;
}

/* No numbers in this one at all: there is nothing they could add but a chance to
   make a run that went fine sound like it didn't. */
function buildNothingToFlagPrompt(state: SimulationState, people: string[]): string {
  const languageLine = languageDirective[state.scenario.language ?? "en"];
  const person = people.length > 0 ? people.join(", ") : "the person on screen";

  return `You are giving a healthcare communication trainee one short note from a training
simulation. A webcam measured which way their head was pointing. They faced the person they were
talking to, apart from brief looks away, which are normal.

Language: ${languageLine} Write it in that language.

The person they were talking to: ${person}

Rules:
- Return exactly one clear sentence under 20 words saying plainly that they faced this person through
  almost all of the conversation. Refer to the person by the name above.
- No advice, no numbers, no percentages.
- NEVER say or imply what the trainee felt, or whether they were listening, attentive, interested,
  engaged, caring or respectful. Say "you faced her", never "you were attentive".
- Never mention eye contact, eyes or gaze. The camera did not measure them.
- Do not assign a score, rating, or grade of any kind.
- Return only valid JSON matching this shape:
{ "presenceFeedback": ["string"] }`;
}

/** Null when nothing usable was measured, so no call is made at all. */
export function buildPresenceFeedbackPrompt(state: SimulationState): string | null {
  const run = describeRun(state);

  if (!run) {
    return null;
  }

  if (run.moments.length === 0) {
    return buildNothingToFlagPrompt(state, run.people);
  }

  return `You are giving a healthcare communication trainee feedback on one narrow thing from a
training simulation: which way their head was pointing during the conversation. A webcam measured
this on their own device.

Language: ${languageDirective[state.scenario.language ?? "en"]} Write every item in that language.

Scenario title: ${state.scenario.title}

The moments worth mentioning, in order. For the rest of the conversation the trainee faced the other
person, apart from brief looks away, which are normal. "whileTheySpoke" is the time the other person's
line was playing. "whileYouSpoke" is the time the trainee was speaking their reply. Time spent
thinking before replying was deliberately not measured.
${JSON.stringify(run.moments)}

How to read these:
- lastedSeconds is how long that stretch was. It is not a point in the conversation, so never say
  "at the 11-second mark". Refer to a stretch by what was being said, or as "while you were replying".
- facingPercent is how much of that time the trainee's head pointed towards the screen, compared
  with how they sat at the start.
- timesTurnedAway counts separate turns of the head; longestTurnAwaySeconds is the longest one.
- These show the direction of the head and nothing else. Not the eyes, not attention, not feeling.

Rules:
- Return 1 to 3 short items, each one clear sentence under 25 words.
- Describe only what was measured. NEVER say or imply what the trainee felt, or whether they were
  listening, attentive, interested, engaged, distracted, bored, caring or respectful. That applies
  to praise as well: "you stayed attentive" is as wrong as "you seemed distracted". Say "you faced
  her", never "you were attentive".
- Never mention eye contact, eyes or gaze. The camera did not measure them.
- Refer to the other person by the name in "person". Say "the patient" only if that is what "person"
  says. Never call a family member or nurse the patient.
- Name a specific moment, using what the line was about. For example: "You turned away for about 5
  seconds while Mrs. Sharma was describing the fall." Round seconds to whole numbers.
- Give one small, concrete next step, in the LAST item only. Earlier items just say what happened, so
  the advice is never repeated. If moments are alike, one item can cover them: "You turned away for 5
  to 8 seconds during three of Mrs. Sharma's lines; try staying with her until she finishes."
- It is a habit to practise, never a verdict on the person. Do not say looking away is wrong in
  itself, or that they must always face the screen.
- Do not comment on what the trainee said, their empathy, or how they handled the case clinically.
  Another reviewer covers that.
- Do not assign a score, rating, or grade of any kind.
- Return only valid JSON matching this shape:
{ "presenceFeedback": ["string"] }`;
}
