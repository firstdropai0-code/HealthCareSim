import type { MediaAsset } from "./media";
import type { ScenarioSpeaker } from "./simulation";

/** One of OpenAI's preset TTS voices. */
export type OpenAiVoiceId =
  | "alloy"
  | "ash"
  | "ballad"
  | "coral"
  | "echo"
  | "fable"
  | "nova"
  | "onyx"
  | "sage"
  | "shimmer"
  | "verse";

/**
 * The voice a single character speaks with. Pinned once when the scenario is
 * created so the same character never drifts between perceived genders, and
 * carried through every TTS call for that speaker.
 */
export type CharacterVoice = {
  voiceId: OpenAiVoiceId;
  /** Baseline emotional state, used to build the TTS delivery instruction. */
  emotion: string;
};

export type Scenario = {
  id: string;
  title: string;
  setting: string;
  summary: string;
  patientProfile: string;
  patientEmotion: string;
  familyEmotion?: string;
  traineeObjective: string;
  communicationChallenge: string;
  startingSituation: string;
  firstPrompt: string;
  suggestedTurns: number;
  endingCondition: string;
  evaluationCriteria: string[];
  defaultEvaluationCriteria?: string[];
  mediaAssets?: MediaAsset[];
  /** Optional so scenarios saved before voice pinning still load. */
  characterVoices?: Partial<Record<ScenarioSpeaker, CharacterVoice>>;
};
