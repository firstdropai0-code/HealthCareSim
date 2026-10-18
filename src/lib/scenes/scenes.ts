import library from "./sceneLibrary.json";
import { isSceneId, type SceneId } from "@/types/scene";
import type { Scenario } from "@/types/scenario";

type LibraryScene = {
  id: SceneId;
  keywords: string[];
  /*
   * Where the room's furniture sits across the picture, 0 to 1. The stage
   * shows a tall slice of the room behind the person, and centring that slice
   * here is what puts a trolley and a monitor behind them rather than the
   * empty wall every backdrop keeps on its left.
   */
  focusX: number;
};

/*
 * Checked most specific first, so "Emergency Department waiting room" lands in
 * the waiting area rather than the resus bay, and a paediatric ICU in the
 * children's room rather than the adult one.
 */
const MATCH_ORDER: SceneId[] = [
  "relatives_room",
  "picu",
  "icu",
  "waiting_area",
  "emergency",
  "clinic",
  "ward",
  "corridor",
];

/*
 * English keywords match whole words, or "ward" would be found in every
 * situation where someone "walks toward you". Devanagari has no \b to lean on
 * and its keywords are long enough not to collide, so those match anywhere.
 */
function keywordMatcher(keyword: string): (text: string) => boolean {
  if (/^[\x20-\x7e]+$/.test(keyword)) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\b`);
    return (text) => pattern.test(text);
  }

  return (text) => text.includes(keyword);
}

const matchersById = new Map(
  (library.scenes as LibraryScene[]).map((scene) => [scene.id, scene.keywords.map(keywordMatcher)]),
);

function matchText(text: string): SceneId | null {
  const lower = text.toLowerCase();

  return MATCH_ORDER.find((id) => matchersById.get(id)?.some((matches) => matches(lower))) ?? null;
}

/**
 * The room for a scenario. New scenarios name it outright; older ones are
 * matched from their setting text, then from the situation around it, and
 * anything still unplaced stands in a corridor -- neutral, and true of every
 * hospital.
 */
export function sceneForScenario(scenario: Scenario): SceneId {
  if (isSceneId(scenario.settingKind)) {
    return scenario.settingKind;
  }

  return (
    matchText(scenario.setting ?? "") ??
    matchText(`${scenario.startingSituation ?? ""} ${scenario.summary ?? ""}`) ??
    "corridor"
  );
}

const focusById = new Map((library.scenes as LibraryScene[]).map((scene) => [scene.id, scene.focusX]));

/** CSS object-position for a tall slice of the room centred on its furniture. */
export function sceneFocus(id: SceneId): string {
  return `${Math.round((focusById.get(id) ?? 0.6) * 100)}% 40%`;
}

export function sceneSrc(id: SceneId): string {
  return `/scenes/${id}.webp`;
}
