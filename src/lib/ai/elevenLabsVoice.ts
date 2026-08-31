import type { Intensity } from "./voiceDirection";
import type { OpenAiVoiceId } from "@/types/scenario";

/**
 * ElevenLabs-specific half of the TTS layer.
 *
 * The provider split is deliberately narrow. Everything about *which* character
 * speaks and *how hard* they feel it stays in voiceDirection.ts and is shared;
 * this file only knows how to say that in ElevenLabs' vocabulary. Keeping the
 * decision shared is what makes the A/B honest -- if each provider ranked
 * delivery its own way we would be measuring the two mappings, not the two
 * models.
 */

/**
 * Voices stay pinned by their OpenAI id even when ElevenLabs is doing the
 * speaking.
 *
 * The pinned id on the scenario is really a *slot token*: assignCharacterVoices()
 * hashes the scenario id so a given character always lands on the same slot, and
 * that guarantee is what stops a character drifting between perceived genders
 * mid-run. Rendering that same token through a different provider inherits the
 * guarantee for free -- no migration, no persistence change, and a scenario
 * saved months ago casts the same people on both providers.
 *
 * The slot's pool membership carries over too: coral/ballad/verse/nova/shimmer
 * are the expressive slots (patient, family member) and must map to ElevenLabs
 * voices that can actually carry distress. ash/sage/echo/fable/onyx are the
 * steady slots (nurse, bystander) and alloy is the narrator.
 *
 * These defaults are ElevenLabs' long-standing premade voices. Treat them as
 * placeholders: they are here so the integration runs before the cast is
 * chosen, not because they are the right cast. Override the whole map with the
 * ELEVENLABS_VOICE_MAP env var once someone has actually listened.
 */
const DEFAULT_VOICE_MAP: Record<OpenAiVoiceId, string | CastEntry> = {
  // Narrator.
  alloy: "onwK4e9ZLuTAKqWW03F9",
  // Expressive slots.
  coral: "EXAVITQu4vr4xnSDxMaL",
  ballad: "21m00Tcm4TlvDq8ikWAM",
  verse: "AZnzlk1XvdvUeBnXmlld",
  nova: "MF3mGyEYCl7XYWbV9V6O",
  shimmer: "ThT5KcBeYPX3keUQqHPh",
  // Steady slots.
  ash: "pNInz6obpgDQGcFmaJgB",
  sage: "TxGEqnHWrfWFTfGW9XjX",
  echo: "VR6AewLTigWG4xSOukaG",
  fable: "ErXwobaYiN019PkySvjV",
  onyx: "yoZ06aMxZJJ28mfd3POQ",
};

/**
 * Merge ELEVENLABS_VOICE_MAP over the defaults. It is a partial JSON object
 * keyed by OpenAI voice id, so a half-finished cast can be tried without
 * filling in all eleven slots:
 *
 *   ELEVENLABS_VOICE_MAP={"coral":"<id>","ballad":"<id>"}
 *
 * Bad JSON is logged and ignored rather than thrown. A malformed env var should
 * cost you the override, not the whole read-aloud feature mid-roleplay.
 */
function voiceMap(): Record<OpenAiVoiceId, string | CastEntry> {
  const raw = process.env.ELEVENLABS_VOICE_MAP;

  if (!raw?.trim()) {
    return DEFAULT_VOICE_MAP;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Record<OpenAiVoiceId, string | CastEntry>>;
    return { ...DEFAULT_VOICE_MAP, ...parsed };
  } catch (error) {
    console.error("ELEVENLABS_VOICE_MAP is not valid JSON; using defaults.", error);
    return DEFAULT_VOICE_MAP;
  }
}

/**
 * A cast entry is either a bare voice id or a voice paired with the model it
 * should be spoken by.
 *
 * The pairing is not a nicety. Auditioning found the choice of model to be a
 * per-voice matter rather than a global one: some voices carry more feeling on
 * the fast conversational model and go stiff on the dramatic one, and others do
 * the exact opposite. A single global model would force half the cast to be
 * spoken by the wrong one.
 */
export type CastEntry = { voiceId: string; model?: string };

function toEntry(value: string | CastEntry): CastEntry {
  return typeof value === "string" ? { voiceId: value } : value;
}

export function resolveElevenLabsVoice(voice: string | undefined): CastEntry {
  const map = voiceMap();

  if (voice && voice in map) {
    return toEntry(map[voice as OpenAiVoiceId]);
  }

  // Either an unpinned call or an id from a provider we do not know. The
  // narrator slot is the safe landing: neutral, and never one of the character
  // voices, so it cannot collide with a cast member.
  return toEntry(map.alloy);
}

export type ElevenLabsVoiceSettings = {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
};

/**
 * The intensity ladder, expressed as ElevenLabs voice settings.
 *
 * `stability` is inverted relative to intuition: low values let the model swing
 * further from its neutral read, which is exactly what a frightened parent
 * needs, while high values pin it to a consistent -- and flat -- delivery. That
 * makes it the direct analogue of the OpenAI prose ladder, where the whole
 * problem was the model returning to an announcer register.
 *
 * The low band still sits at 0.65 rather than 1.0 for the same reason the OpenAI
 * low band is written as "calm, not neutral": a quiet line in this app is a
 * person holding something in, not an absence of feeling. Pinning stability to
 * the top would reintroduce the flatness we are trying to get rid of.
 *
 * NOTE: the v3 model family is documented as snapping `stability` to discrete
 * points rather than reading it continuously. If v3 is the model in play, expect
 * these to quantise and tune against what you actually hear.
 */
const INTENSITY_SETTINGS: Record<Intensity, ElevenLabsVoiceSettings> = {
  low: { stability: 0.65, similarity_boost: 0.75, style: 0.25, use_speaker_boost: true },
  medium: { stability: 0.4, similarity_boost: 0.75, style: 0.5, use_speaker_boost: true },
  high: { stability: 0.2, similarity_boost: 0.75, style: 0.75, use_speaker_boost: true },
};

export function elevenLabsVoiceSettings(intensity: Intensity): ElevenLabsVoiceSettings {
  return INTENSITY_SETTINGS[intensity];
}

/**
 * Inline audio tags, mapped from the physical markers the per-line stage
 * direction already uses.
 *
 * OFF by default, and deliberately so. Tags are read out of the message text
 * itself, which means an unsupported tag is not ignored -- it risks being spoken
 * aloud, so a distraught mother says the word "shaky" in the middle of her line.
 * That failure is worse than the flatness we are trying to fix, and it lands in
 * front of a trainee. Verify the tag vocabulary against the docs for the model
 * actually in use, then enable with ELEVENLABS_AUDIO_TAGS=1.
 *
 * Only markers with an unambiguous documented tag are listed. Anything doubtful
 * is better handled by the stability/style ladder above, which cannot leak into
 * the words.
 */
const DELIVERY_TAGS: { markers: string[]; tag: string }[] = [
  { markers: ["whisper", "whispering", "barely audible", "under their breath"], tag: "[whispers]" },
  { markers: ["crying", "sobbing", "tears", "choking up"], tag: "[crying]" },
  { markers: ["shouting", "yelling", "screaming"], tag: "[shouting]" },
  { markers: ["sighs", "sighing", "exhales"], tag: "[sighs]" },
  { markers: ["nervous", "shaky", "trembling", "unsteady"], tag: "[nervous]" },
];

export function applyAudioTags(text: string, delivery: string | undefined): string {
  if (process.env.ELEVENLABS_AUDIO_TAGS !== "1") {
    return text;
  }

  const direction = (delivery ?? "").trim().toLowerCase();

  if (!direction) {
    return text;
  }

  // First match only. Stacking tags on one line gives the model competing
  // instructions, which is the exact failure mode that made the OpenAI voice
  // land neutral when four directions disagreed.
  const match = DELIVERY_TAGS.find(({ markers }) =>
    markers.some((marker) => direction.includes(marker)),
  );

  return match ? `${match.tag} ${text}` : text;
}

/**
 * Audio tags the model may place inside a line.
 *
 * Kept as an explicit whitelist even though probing found that v3 silently
 * drops bracketed text it does not recognise rather than speaking it. That
 * behaviour is a property of one model at one point in time, and the thing it
 * protects against -- a character saying the word "shaky" out loud to a trainee
 * -- is bad enough that it is worth not depending on. Anything outside this list
 * is stripped before it reaches the API.
 *
 * `gasps` and `shaky` are the two confirmed by ear on both models. The rest are
 * plausible and drop harmlessly if they turn out not to be supported, so they
 * are worth having available to the model; treat them as unconfirmed until
 * someone has actually heard one land.
 */
const ALLOWED_TAGS = new Set([
  "gasps", "shaky", "whispers", "crying", "sobbing", "sighs", "exhales",
  "nervous", "shouting", "stammers", "voice breaking", "breathes shakily",
]);

/** Matches any bracketed tag, whether or not it is one we allow. */
const TAG_PATTERN = /\[([^\]]{1,32})\]/g;

/**
 * Strip every tag. This is what the trainee reads, what the feedback report is
 * built from, and what goes back to the model as conversation history -- none of
 * which should ever contain performance direction.
 */
export function stripAudioTags(text: string): string {
  return text.replace(TAG_PATTERN, " ").replace(/\s{2,}/g, " ").trim();
}

/**
 * Keep the allowed tags, drop the rest. This is the only form that reaches the
 * TTS provider, so an invented tag cannot survive to be spoken.
 */
export function keepAllowedTags(text: string): string {
  return text
    .replace(TAG_PATTERN, (match, tag: string) =>
      ALLOWED_TAGS.has(tag.trim().toLowerCase()) ? `[${tag.trim().toLowerCase()}]` : " ",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** True when the line carries at least one tag worth sending to ElevenLabs. */
export function hasAllowedTag(text: string): boolean {
  return keepAllowedTags(text) !== stripAudioTags(text);
}

export const ALLOWED_TAG_LIST = [...ALLOWED_TAGS];
