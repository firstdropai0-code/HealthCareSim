import type { MediaAsset } from "./media";

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
  mediaAssets?: MediaAsset[];
};
