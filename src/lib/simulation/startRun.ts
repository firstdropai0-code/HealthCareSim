import { castScenario } from "@/lib/ai/geminiClient";
import { clearSimulationState, saveSimulationState } from "@/lib/storage/localSimulationStorage";
import type { Scenario } from "@/types/scenario";
import { createInitialSimulationState } from "./simulationEngine";

/*
 * How long a start button waits for an older case's cast. A little over the
 * server's own cap, so a slow answer that is coming is not thrown away a
 * moment early.
 */
const CAST_WAIT_MS = 9_000;

/**
 * The scenario as a run should start it: with a cast, worked out now if the
 * case was published before casts existed. Now is the only safe moment --
 * before the first line, so recasting every voice to match cannot make a
 * character change voice mid-conversation. Best effort and capped: on a slow
 * or failed answer the scenario comes back unchanged and the run starts with
 * plain role tiles, exactly as it did before.
 */
async function withCast(scenario: Scenario): Promise<Scenario> {
  if (scenario.cast?.length) {
    return scenario;
  }

  try {
    const casting = await Promise.race([
      castScenario(scenario),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), CAST_WAIT_MS)),
    ]);

    return casting?.cast?.length ? { ...scenario, ...casting } : scenario;
  } catch (error) {
    console.warn("Could not work out this case's cast; starting without portraits.", error);
    return scenario;
  }
}

/**
 * Start a fresh run of a scenario. Every start button goes through here: the
 * cast backfill used to live in the Cases page alone, and runs started from
 * My Progress went on stage as a nameless "Patient" tile.
 *
 * A fresh run id per attempt, so running the same case twice -- or retrying
 * one to improve a score -- produces two records rather than overwriting the
 * first.
 */
export async function startSimulationRun(scenario: Scenario): Promise<void> {
  const prepared = await withCast(scenario);
  clearSimulationState();
  saveSimulationState(createInitialSimulationState(prepared));
}
