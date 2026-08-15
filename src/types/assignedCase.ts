import type { ScenarioDifficulty } from "@/lib/scenarios/scenarioLibrary";
import type { Scenario } from "./scenario";

/**
 * A scenario a mentor has published to their group. Trainees pick from these
 * rather than authoring their own.
 *
 * The full `scenario` is embedded, and each run embeds its own copy again, so
 * removing a case never rewrites the history of anyone who already ran it.
 * The flat fields are denormalized for the list view.
 */
export type AssignedCase = {
  id: string;
  groupId: string;
  mentorId: string;
  mentorName: string;

  title: string;
  summary: string;
  category: string | null;
  difficulty: ScenarioDifficulty;
  libraryId: string | null;

  scenario: Scenario;
  createdAt: string;
};
