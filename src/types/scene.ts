/**
 * The room a scenario takes place in, as one of the illustrated backdrops in
 * public/scenes/. A closed set for the same reason the cast's fields are: it
 * names an image file, and free text would only have to be mapped back onto
 * these anyway. Must match the ids in src/lib/scenes/sceneLibrary.json.
 */
export const sceneIds = [
  "emergency",
  "icu",
  "picu",
  "ward",
  "clinic",
  "relatives_room",
  "waiting_area",
  "corridor",
] as const;

export type SceneId = (typeof sceneIds)[number];

export function isSceneId(value: unknown): value is SceneId {
  return typeof value === "string" && (sceneIds as readonly string[]).includes(value);
}
