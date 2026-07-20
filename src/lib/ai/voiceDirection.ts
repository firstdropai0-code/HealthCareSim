import type { CharacterVoice, OpenAiVoiceId, Scenario } from "@/types/scenario";
import type { ScenarioSpeaker, TensionLevel } from "@/types/simulation";

/**
 * Voice pinning and delivery direction for the AI patient voice.
 *
 * Two separate jobs live here:
 *  - assignCharacterVoices(): picks a fixed voiceId per character, once, at
 *    scenario-creation time. Deterministic from the scenario id so the same
 *    scenario always sounds like the same people.
 *  - buildVoiceInstructions(): builds the gpt-4o-mini-tts `instructions` string
 *    fresh on every turn, from the character's emotion plus where the
 *    conversation currently is, so tone moves with the situation.
 */

/** Narrator is pinned separately: neutral, never one of the character voices. */
const NARRATOR_VOICE: OpenAiVoiceId = "alloy";

/**
 * The presets are not equally steerable. Some carry emotion readily and follow
 * distress direction; others stay measured almost regardless of instruction.
 *
 * Patient and family member drive the emotional weight of the simulation, so
 * they draw only from the expressive set -- otherwise the most important voice
 * in the app can land on one that will not get there however hard we direct it.
 * Nurse and bystander are functional roles where a steadier read is fine, and
 * keeping them in a separate set also guarantees no two characters collide.
 */
const EXPRESSIVE_VOICE_POOL: OpenAiVoiceId[] = ["coral", "ballad", "verse", "nova", "shimmer"];
const STEADY_VOICE_POOL: OpenAiVoiceId[] = ["ash", "sage", "echo", "fable", "onyx"];

/** Which pool each speaker draws from, and its slot offset within that pool. */
const SPEAKER_POOLS: { speaker: ScenarioSpeaker; pool: OpenAiVoiceId[]; slot: number }[] = [
  { speaker: "patient", pool: EXPRESSIVE_VOICE_POOL, slot: 0 },
  { speaker: "family_member", pool: EXPRESSIVE_VOICE_POOL, slot: 1 },
  { speaker: "nurse", pool: STEADY_VOICE_POOL, slot: 0 },
  { speaker: "bystander", pool: STEADY_VOICE_POOL, slot: 1 },
];

/** Small stable string hash (FNV-1a). Same id in, same voices out, every time. */
function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function emotionForSpeaker(scenario: Scenario, speaker: ScenarioSpeaker): string {
  switch (speaker) {
    case "patient":
      return scenario.patientEmotion || "concerned";
    case "family_member":
      return scenario.familyEmotion || scenario.patientEmotion || "worried";
    case "nurse":
      return "professional and steady";
    case "bystander":
      return "uneasy but not directly involved";
    case "narrator":
      return "neutral";
  }
}

/**
 * Pin one voice per character. Called once when the scenario is created; the
 * result is stored on the scenario and reused for every later TTS call.
 */
export function assignCharacterVoices(
  scenario: Scenario,
): Partial<Record<ScenarioSpeaker, CharacterVoice>> {
  // Offset the whole assignment by the scenario id so different scenarios cast
  // different voices, while each speaker keeps a distinct slot within its pool.
  const seed = hashString(scenario.id);

  const voices: Partial<Record<ScenarioSpeaker, CharacterVoice>> = {
    narrator: { voiceId: NARRATOR_VOICE, emotion: "neutral" },
  };

  SPEAKER_POOLS.forEach(({ speaker, pool, slot }) => {
    voices[speaker] = {
      voiceId: pool[(seed + slot) % pool.length],
      emotion: emotionForSpeaker(scenario, speaker),
    };
  });

  return voices;
}

/**
 * Voice for a speaker, backfilling scenarios saved before voices were pinned so
 * older sessions still sound consistent instead of falling back to one default.
 */
export function getCharacterVoice(scenario: Scenario, speaker: ScenarioSpeaker): CharacterVoice {
  const pinned = scenario.characterVoices?.[speaker];

  if (pinned) {
    return pinned;
  }

  return assignCharacterVoices(scenario)[speaker] ?? { voiceId: NARRATOR_VOICE, emotion: "neutral" };
}

/**
 * Trailing prompts aimed at the trainee ("What do you say?", "What do you do
 * next?") are UI scaffolding, not dialogue -- but they sit inside the message
 * text, so read-aloud voices them in character and breaks the fourth wall every
 * turn. Strip them from the spoken audio only; the on-screen text keeps them.
 *
 * The verb whitelist matters: it catches "what do you say / do / respond" while
 * leaving genuine in-character lines like "What do you mean?" or "What do you
 * think?" alone.
 */
const TRAILING_TRAINEE_PROMPT =
  /[\s"'“”]*\b(?:what|how)\s+(?:do|would|will|should)\s+you\s+(?:say|do|respond|tell|handle)\b[^.?!]*[.?!]+["'“”]?\s*$/i;

export function stripTraineePrompt(text: string): string {
  const stripped = text.replace(TRAILING_TRAINEE_PROMPT, "").trim();

  // If the message was nothing but the prompt, there is no dialogue to save --
  // read it as written rather than returning silence.
  return stripped.length > 0 ? stripped : text.trim();
}

type Intensity = "low" | "medium" | "high";

const INTENSITY_ORDER: Intensity[] = ["low", "medium", "high"];

/**
 * Delivery direction per intensity, written as separate performance axes.
 * gpt-4o-mini-tts follows concrete, physical stage direction (breath, pacing,
 * where sentences break) far more convincingly than a list of adjectives.
 *
 * Note that even the low band stays emotionally present. The model's default
 * register is a neutral announcer, so "calm" has to be written as *quietly
 * feeling something* -- otherwise it reads as flat and robotic.
 */
const INTENSITY_DIRECTION: Record<Intensity, string> = {
  low: [
    "Pacing: unhurried, with real pauses between thoughts. Let sentences finish.",
    "Tone: quieter and warmer, but the feeling is still audible underneath. Calm, not neutral.",
    "Delivery: softer, not flat. You are steadier than before, never indifferent or detached.",
  ].join("\n"),
  medium: [
    "Pacing: pressing and urgent, noticeably faster than comfortable, gaps between sentences cut short.",
    "Tone: tight and strained, pitch sitting higher than this person's normal voice, worry plainly audible.",
    "Delivery: shallow, quick breath. Lean on the words that matter to you. Start sentences before the last one has settled. You are holding it together, and it should be obvious that you are having to.",
  ].join("\n"),
  high: [
    "Pacing: fast and uneven, tumbling, sometimes rushing two thoughts together.",
    "Tone: pushed volume, pitch riding high, audibly frayed.",
    "Delivery: catch your breath mid-sentence. Let a word crack or waver. Do not sound composed.",
  ].join("\n"),
};

/**
 * Emotion words that carry their own intensity, independent of how tense the
 * conversation has become. A parent can be badly frightened during a calm,
 * well-handled exchange -- that is a quiet voice with fear in it, not a neutral one.
 */
const EMOTION_INTENSITY: Record<Intensity, string[]> = {
  high: [
    "panicked", "panicking", "frantic", "terrified", "furious", "enraged", "hysterical",
    "desperate", "distraught", "irate", "outraged", "screaming",
  ],
  medium: [
    "worried", "anxious", "afraid", "scared", "frightened", "upset", "angry", "frustrated",
    "agitated", "tense", "nervous", "concerned", "distressed", "defensive", "impatient",
    "protective", "grieving", "overwhelmed", "confused", "suspicious", "guarded",
  ],
  low: ["calm", "relieved", "reassured", "resigned", "tired", "composed", "accepting", "hopeful"],
};

/** Rank an emotion string by its strongest matching keyword. */
function emotionIntensity(emotion: string): Intensity {
  const text = emotion.toLowerCase();

  if (EMOTION_INTENSITY.high.some((word) => text.includes(word))) {
    return "high";
  }

  if (EMOTION_INTENSITY.medium.some((word) => text.includes(word))) {
    return "medium";
  }

  if (EMOTION_INTENSITY.low.some((word) => text.includes(word))) {
    return "low";
  }

  // Unrecognised wording: assume there is real feeling in the scene rather than
  // defaulting to the flat register.
  return "medium";
}

function shift(intensity: Intensity, steps: number): Intensity {
  const index = INTENSITY_ORDER.indexOf(intensity) + steps;
  return INTENSITY_ORDER[Math.max(0, Math.min(INTENSITY_ORDER.length - 1, index))];
}

/**
 * Combine the character's own emotional baseline with how tense the scene has
 * become.
 *
 * Tension measures escalation, not feeling, so it cannot be the only input --
 * that is what previously made a worried parent sound flat whenever the trainee
 * was handling things well. The one case where tension pulls the delivery *down*
 * is a genuinely de-escalated ending, which is the relief arc we want to keep.
 */
function resolveIntensity(
  emotion: string,
  tensionLevel: TensionLevel,
  isLate: boolean,
): Intensity {
  const baseline = emotionIntensity(emotion);

  if (isLate && tensionLevel === "low") {
    return shift(baseline, -1);
  }

  return INTENSITY_ORDER.indexOf(tensionLevel) > INTENSITY_ORDER.indexOf(baseline)
    ? tensionLevel
    : baseline;
}

export type VoiceInstructionContext = {
  scenario: Scenario;
  speaker: ScenarioSpeaker;
  tensionLevel: TensionLevel;
  /** 0 at the opening turn, approaching 1 at the final turn. */
  turnRatio: number;
};

/**
 * Build the per-turn delivery instruction. Emotion comes from the character,
 * intensity from the current tension, and the arc from how far into the
 * conversation we are -- so an anxious parent genuinely softens as the trainee
 * de-escalates, rather than staying pinned at the same pitch of panic.
 */
export function buildVoiceInstructions({
  scenario,
  speaker,
  tensionLevel,
  turnRatio,
}: VoiceInstructionContext): string {
  if (speaker === "narrator") {
    return [
      "Identity: a calm, neutral narrator setting a scene. Not a character in it.",
      "Pacing: even and measured, with a small pause at each comma.",
      "Tone: quiet, factual, unhurried. No dramatisation.",
      "Delivery: do not act out the emotions being described. You are reporting them.",
    ].join("\n");
  }

  const { emotion } = getCharacterVoice(scenario, speaker);

  // Late in the conversation the tension level tells us which way the trainee
  // moved things, so the delivery lands on either relief or hardening.
  const isLate = turnRatio >= 0.6;
  const intensity = resolveIntensity(emotion, tensionLevel, isLate);

  const parts = [
    `Identity: a ${speaker.replace("_", " ")} in a hospital, speaking to a doctor face to face. Their emotional state right now is: ${emotion}.`,
    // Naturalism and emotional commitment are both required, and they pull in
    // opposite directions. Asking only for naturalism produces an underplayed,
    // subtle read -- so commitment is stated first and explicitly.
    "Affect: commit fully to this emotion. It should be immediately obvious to a listener how this person feels, from the very first word.",
    "Do not underplay, do not hold back, and do not sound polite or composed when the character is not.",
    "Keep it real rather than theatrical: the emotion belongs in the breath, the pacing and the pitch, not in over-articulated words. This is a real person in a hospital, not a stage performance -- but a real person in this state is far from neutral.",
    `Never read these lines in a flat, announcer-like, or assistant-like register -- even when the words themselves are calm or polite.`,
    INTENSITY_DIRECTION[intensity],
  ];

  if (isLate && tensionLevel === "low") {
    parts.push(
      "Arc: you have been talked down. The fight has gone out of you -- quieter, slower, warmer, a little tired from the adrenaline leaving. Relief, not cheerfulness.",
    );
  } else if (isLate && tensionLevel === "high") {
    parts.push(
      "Arc: you have not been reassured and your patience is spent. Worn down and flat-angry rather than freshly alarmed. Less volume than earlier, more edge.",
    );
  } else if (turnRatio <= 0.2) {
    parts.push("Arc: this is your first moment with this doctor. The emotion is raw and unfiltered.");
  }

  parts.push(
    "Rules: stay in character, never narrate, never add commentary, and speak only the words given.",
  );

  return parts.join("\n");
}
