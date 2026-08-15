/**
 * Curated case studies the trainer can drop straight into the scenario creator.
 *
 * `idea` is the text that lands in the "rough scenario idea" box, so it is
 * written the way a trainer would describe the case out loud — the structured
 * brief is still generated from it, nothing here bypasses that step.
 */

export type ScenarioDifficulty = "foundational" | "intermediate" | "advanced";

export type LibraryScenario = {
  id: string;
  /** Display code, e.g. "Case 01". Stable across filtering and shuffling. */
  code: string;
  title: string;
  category: string;
  difficulty: ScenarioDifficulty;
  tags: string[];
  /** One-line hook shown on the card. */
  summary: string;
  /** The full rough idea sent to the generator. */
  idea: string;
};

type DifficultyMeta = {
  label: string;
  blurb: string;
  /** Chip styling — border + ink only, matching the tone system in VisualCards. */
  chip: string;
  /** Left rule on the card, so difficulty is scannable down the list. */
  rule: string;
  dot: string;
};

export const difficultyMeta: Record<ScenarioDifficulty, DifficultyMeta> = {
  foundational: {
    label: "Foundational",
    blurb: "Clear task, cooperative counterpart.",
    chip: "border-[var(--color-primary)] text-[var(--color-primary-ink)] bg-[var(--color-primary-soft)]",
    rule: "before:bg-[var(--color-primary)]",
    dot: "bg-[var(--color-primary)]",
  },
  intermediate: {
    label: "Intermediate",
    blurb: "Conflict, blame, or an anxious family to steady.",
    chip: "border-[var(--color-warning)] text-[var(--color-warning)] bg-[var(--color-warning-soft)]",
    rule: "before:bg-[var(--color-warning)]",
    dot: "bg-[var(--color-warning)]",
  },
  advanced: {
    label: "Advanced",
    blurb: "Death, safeguarding, or hostility under pressure.",
    chip: "border-[var(--color-danger)] text-[var(--color-danger)] bg-[var(--color-danger-soft)]",
    rule: "before:bg-[var(--color-danger)]",
    dot: "bg-[var(--color-danger)]",
  },
};

/**
 * The home for scenarios that do not belong to one of the library's tracks.
 *
 * A real category rather than a null: the skill tree matches runs to cells by
 * category, so anything without one has no row to land in and silently
 * disappears from a trainee's progress.
 */
export const GENERAL_CATEGORY = "General communication";

export const difficultyOrder: ScenarioDifficulty[] = [
  "foundational",
  "intermediate",
  "advanced",
];

export const scenarioLibrary: LibraryScenario[] = [
  {
    id: "waiting-room-frustration",
    code: "Case 01",
    title: "Ignored after a long clinic wait",
    category: "Service recovery",
    difficulty: "foundational",
    tags: ["Frustration", "Apology", "Clinic"],
    summary: "A patient who has waited far too long feels brushed aside.",
    idea: "An anxious patient feels ignored after a long clinic wait.",
  },
  {
    id: "unclear-updates",
    code: "Case 02",
    title: "Family kept in the dark",
    category: "Family communication",
    difficulty: "foundational",
    tags: ["Updates", "Trust", "Ward"],
    summary: "A relative is upset that nobody has explained what is happening.",
    idea: "A family member is upset because updates have been unclear.",
  },
  {
    id: "embarrassed-patient",
    code: "Case 03",
    title: "Too embarrassed to ask",
    category: "Rapport building",
    difficulty: "foundational",
    tags: ["Shame", "Health literacy", "Clinic"],
    summary: "A quiet patient nods along but has not understood a word.",
    idea: "A patient is embarrassed and reluctant to ask follow-up questions.",
  },
  {
    id: "pneumothorax-consent",
    code: "Case 04",
    title: "Consent for a chest tube",
    category: "Consent",
    difficulty: "foundational",
    tags: ["Shared decision", "Trauma", "Procedure"],
    summary: "Explaining an urgent procedure clearly enough to earn a real yes.",
    idea: "A 24-year-old woman injured in a road accident has a confirmed pneumothorax and rib fractures. The doctor needs to explain the situation and obtain her consent for a chest tube procedure.",
  },
  {
    id: "missed-fracture-complaint",
    code: "Case 05",
    title: "The fracture that was missed",
    category: "Complaint & disclosure",
    difficulty: "intermediate",
    tags: ["Medical error", "Legal threat", "Anger"],
    summary: "A patient returns furious after being sent home on a wrong read.",
    idea: "A patient was told his X-ray was normal yesterday and sent home, but the written report shows an undisplaced fracture that was missed. He has returned angry, demanding a refund, an apology, and threatening legal action.",
  },
  {
    id: "vp-shunt-child",
    code: "Case 06",
    title: "Child with a blocked shunt",
    category: "Paediatrics",
    difficulty: "intermediate",
    tags: ["Anxious parent", "Escalation", "Paediatric"],
    summary: "An anxious mother needs the plan explained while the clock runs.",
    idea: "A 6-year-old boy with a VP shunt has come in with fever, a seizure, and altered consciousness after a day of headache and vomiting. Scans show fluid buildup with the shunt still in place. The doctor suspects a shunt infection or malfunction and needs to update the anxious mother and explain the plan to involve neurosurgery.",
  },
  {
    id: "dementia-iv-line",
    code: "Case 07",
    title: "Son finds his father bleeding",
    category: "Complaint & disclosure",
    difficulty: "intermediate",
    tags: ["Anger", "Care quality", "Ward"],
    summary: "A visitor walks in on a lapse in care and starts shouting at staff.",
    idea: "An elderly patient with dementia pulled out his IV line and lost blood onto the sheets while the ward was busy with another emergency. His son arrived to visit, found him like this, and is angry and shouting at staff. The doctor must address the son.",
  },
  {
    id: "head-injury-no-recovery",
    code: "Case 08",
    title: "No chance of recovery",
    category: "Breaking bad news",
    difficulty: "advanced",
    tags: ["Bad news", "Ventilator", "Grief"],
    summary: "A mother arrives hoping for good news that does not exist.",
    idea: "A 25-year-old man was brought in after a road accident with a severe head injury. He is on a ventilator. The neurosurgical team has determined surgery won't help and there is no chance of recovery. His mother has just arrived at the ED, anxious and hoping for good news, and the doctor must break the news to her.",
  },
  {
    id: "end-of-life-copd",
    code: "Case 09",
    title: "Ceiling of care in advanced lung disease",
    category: "End-of-life",
    difficulty: "advanced",
    tags: ["Prognosis", "Goals of care", "Family decision"],
    summary: "The family has said no to a ventilator; the talk turns to what comes next.",
    idea: "An 85-year-old man with advanced lung disease, already on home breathing support, has come in with worsening breathing failure that isn't responding to treatment. His grandson has said no to a ventilator. The doctor must discuss the man's prognosis and next steps with the family.",
  },
  {
    id: "cardiac-arrest-blame",
    code: "Case 10",
    title: "Death declared, blame in the room",
    category: "Breaking bad news",
    difficulty: "advanced",
    tags: ["Death disclosure", "Hostility", "Blame"],
    summary: "An agitated group believes the treatment killed him — and says so.",
    idea: "A 35-year-old man came in with a heart attack and went into cardiac arrest shortly after treatment started. After 45 minutes of resuscitation, he could not be revived. His family and friends are agitated and believe the medications given caused the arrest. The doctor must declare the death and address their concerns.",
  },
  {
    id: "suspected-nai",
    code: "Case 11",
    title: "An injury that does not add up",
    category: "Safeguarding",
    difficulty: "advanced",
    tags: ["Child protection", "Paediatric", "Delicate questioning"],
    summary: "Suspected non-accidental injury, and the mother has just walked in.",
    idea: "A 5-year-old girl was brought in by her uncle with a leg fracture, said to be from a fall down stairs. The doctor notices older bruises and that the child seems withdrawn, and suspects the injury may not be accidental. The mother has just arrived from work, and the doctor needs to talk with her and explain next steps carefully.",
  },
];

/** Picks a random case, never returning `excludeId` unless it is the only match. */
/**
 * Every track the library covers, plus the catch-all. Mentors pick from these.
 * Declared after the library array it reads, or it would throw on module load.
 */
export const categoryOptions: string[] = [
  ...[...new Set(scenarioLibrary.map((entry) => entry.category))].sort(),
  GENERAL_CATEGORY,
];

export function pickRandomScenario(
  pool: LibraryScenario[],
  excludeId?: string,
): LibraryScenario | null {
  if (pool.length === 0) {
    return null;
  }

  const candidates =
    pool.length > 1 && excludeId
      ? pool.filter((entry) => entry.id !== excludeId)
      : pool;

  return candidates[Math.floor(Math.random() * candidates.length)];
}
