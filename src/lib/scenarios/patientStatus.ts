import type { PatientStatus, Scenario } from "@/types/scenario";

/*
 * What the model wrote into patientEmotion for a death, before patientStatus
 * existed: "Deceased", "Dead", "Has died", "Passed away", or the Hindi मृत /
 * मृत्यु / देहांत. Only consulted when patientStatus is absent, so a case the
 * mentor has explicitly marked alive is never second-guessed by its wording.
 */
const LEGACY_DECEASED_PATTERN = /\b(deceased|dead|died|passed away)\b|मृत|देहांत/i;

/**
 * The patient's status, for any scenario old or new. Read it through here
 * rather than `scenario.patientStatus` directly: scenarios published before the
 * field existed have no value, and the ones about a death carry it in the
 * emotion text instead. Without this they would brief as alive with a
 * "Deceased" feeling, which is the bug the field was added to fix.
 */
export function getPatientStatus(
  scenario: Partial<Pick<Scenario, "patientStatus" | "patientEmotion">>,
): PatientStatus {
  if (scenario.patientStatus === "alive" || scenario.patientStatus === "deceased") {
    return scenario.patientStatus;
  }

  return LEGACY_DECEASED_PATTERN.test(scenario.patientEmotion ?? "") ? "deceased" : "alive";
}

export function isPatientDeceased(
  scenario: Partial<Pick<Scenario, "patientStatus" | "patientEmotion">>,
): boolean {
  return getPatientStatus(scenario) === "deceased";
}
