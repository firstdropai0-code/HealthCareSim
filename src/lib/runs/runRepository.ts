import { getDb } from "@/lib/firebase/firebaseApp";
import { getGroup } from "@/lib/groups/groupRepository";
import { translate } from "@/lib/i18n/strings";
import { messagesForStorage } from "@/lib/simulation/simulationEngine";
import type { FeedbackReport } from "@/types/feedback";
import type { RunRecord, RunStat, RunSummary, RunTranscript } from "@/types/run";
import type { SimulationState } from "@/types/simulation";
import type { UserProfile } from "@/types/user";

export type SaveRunInput = {
  state: SimulationState;
  report: FeedbackReport;
  profile: UserProfile;
};

/** Firestore hands timestamps back as objects; the app only ever wants ISO. */
export function toIso(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return "";
}

function toSummary(id: string, data: Record<string, unknown>): RunSummary {
  return {
    ...(data as unknown as RunSummary),
    id,
    startedAt: toIso(data.startedAt),
    completedAt: toIso(data.completedAt),
  };
}

/**
 * Stable, group-scoped, non-reversible. Lets the cohort code count distinct
 * people without the anonymous projection ever carrying a uid.
 */
async function runnerKeyFor(groupId: string, uid: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${groupId}:${uid}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function runIdFor(state: SimulationState): string {
  return (
    state.id ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`)
  );
}

function isPermissionDenied(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "permission-denied"
  );
}

/**
 * Writes the run, its transcript, and the anonymous cohort projection.
 *
 * These are three sequential awaits, NOT a batch: the `runStats` create rule
 * get()s `runs/{runId}` to prove ownership, and inside a writeBatch that get()
 * would run against pre-batch state where the run does not exist yet.
 *
 * Safe to call again after a partial failure, which the deterministic run id
 * alone never made it: a scored run is immutable, so re-sending the first write
 * was refused by the rules and the retry stopped there -- leaving a run with no
 * transcript and no place in the cohort numbers, behind a Retry button that
 * could not work. Each step now writes only what is not already there.
 */
export async function saveCompletedRun(input: SaveRunInput): Promise<string> {
  const { state, report, profile } = input;

  if (!profile.groupId) {
    throw new Error(translate("error.joinBeforeSaving"));
  }

  const [db, { doc, getDoc, serverTimestamp, setDoc }, group] = await Promise.all([
    getDb(),
    import("firebase/firestore"),
    // Read rather than trusted from the client: the create rule cross-checks
    // this against the group document, so a wrong value is simply rejected.
    getGroup(profile.groupId),
  ]);

  if (!group) {
    throw new Error(translate("error.groupGone"));
  }

  const runId = runIdFor(state);
  const isScored = report.source !== "fallback";

  const record: Omit<RunRecord, "completedAt"> & { completedAt: unknown } = {
    id: runId,
    userId: profile.uid,
    userDisplayName: profile.displayName,
    groupId: profile.groupId,
    mentorId: group.mentorId,
    role: profile.role,

    scenarioId: state.scenario.id,
    scenarioTitle: state.scenario.title,
    scenarioSummary: state.scenario.summary,

    libraryId: state.scenario.libraryId ?? null,
    category: state.scenario.category ?? null,
    // Runs created before the tier selector existed still need a bucket.
    difficulty: state.scenario.difficulty ?? "intermediate",

    startedAt: state.startedAt ?? state.messages[0]?.timestamp ?? new Date().toISOString(),
    // The create rule pins this to request.time, so it has to be the server's.
    completedAt: serverTimestamp(),

    turnCount: state.currentTurn,
    maxTurns: state.maxTurns,

    score: isScored ? report.overallScore : null,
    subscores: isScored ? (report.subscores ?? null) : null,

    reportSource: report.source === "fallback" ? "fallback" : "ai",
    // A mentor practising their own case must not move their cohort's numbers.
    countsTowardStats: isScored && profile.role === "trainee",

    report,
  };

  const runRef = doc(db, "runs", runId);

  try {
    // A create, or the one update the rules allow: a fallback run being
    // upgraded to the AI score it could not get the first time.
    await setDoc(runRef, record);
  } catch (error) {
    // Refused. That is also what a retry looks like when the run landed last
    // time and a later step did not, so look before giving up. The check has
    // to come after the attempt rather than before it: the read rule
    // dereferences the run, so reading one that does not exist is itself
    // refused and says nothing.
    if (!isPermissionDenied(error)) {
      throw error;
    }

    const existing = await getDoc(runRef).catch(() => null);
    const stored = existing?.exists() ? existing.data() : null;

    // Only the same result counts as "already saved". If what is stored
    // differs from this report, the chip must keep saying "Not saved" --
    // claiming otherwise would show one score and keep another.
    if (
      !stored ||
      stored.userId !== profile.uid ||
      stored.reportSource !== record.reportSource ||
      stored.score !== record.score
    ) {
      throw error;
    }
  }

  // Written once and never again: the transcript is what a mentor reads to
  // check a score, and the rules now refuse any later change to it. The
  // conversation is over by the time a run is saved, so a retry or a score
  // upgrade has nothing new to put here.
  const transcriptRef = doc(db, "runs", runId, "transcript", "full");

  if (!(await getDoc(transcriptRef)).exists()) {
    const transcript: RunTranscript = {
      messages: messagesForStorage(state.messages),
      scenario: state.scenario,
    };
    await setDoc(transcriptRef, transcript);
  }

  // Anonymous projection. Deliberately carries no name, no uid, and no text.
  const stat: Omit<RunStat, "completedAt"> & { completedAt: unknown } = {
    runId,
    runnerKey: await runnerKeyFor(profile.groupId, profile.uid),
    difficulty: record.difficulty,
    category: record.category,
    libraryId: record.libraryId,
    score: record.score,
    subscores: record.subscores,
    completedAt: serverTimestamp(),
    countsTowardStats: record.countsTowardStats,
  };
  const statRef = doc(db, "groups", profile.groupId, "runStats", runId);
  const existingStat = await getDoc(statRef);

  // Missing, or the placeholder left by a fallback run that has just been
  // scored. A stat that already counts is final, like the run it mirrors.
  if (
    !existingStat.exists() ||
    (existingStat.data().countsTowardStats === false && stat.countsTowardStats)
  ) {
    await setDoc(statRef, stat);
  }

  return runId;
}

/** A trainee's own history. Bounded — this is a progress page, not an archive. */
export async function listMyRuns(uid: string, limitN = 50): Promise<RunSummary[]> {
  const [db, { collection, getDocs, limit, orderBy, query, where }] = await Promise.all([
    getDb(),
    import("firebase/firestore"),
  ]);

  const snapshot = await getDocs(
    query(
      collection(db, "runs"),
      where("userId", "==", uid),
      orderBy("completedAt", "desc"),
      limit(limitN),
    ),
  );

  return snapshot.docs.map((entry) => toSummary(entry.id, entry.data()));
}

/**
 * Every scored run in one of a mentor's groups, newest first.
 *
 * BOTH filters are required, for different reasons. `mentorId` is what the
 * rules need: the read rule authorises on `userId == me || mentorId == me`, and
 * rules are not filters — Firestore rejects a list query unless the query
 * itself proves every document it could return is readable, and a `groupId`
 * filter proves nothing about either field. `groupId` is what the dashboard
 * needs: a mentor owns several groups now, and without it every group's runs
 * would land in one set of averages.
 *
 * Narrowing in JS afterwards is NOT equivalent — the limit below would then be
 * spent across every group, so a busy second cohort would silently truncate the
 * first one's history.
 */
export async function listGroupRuns(
  mentorId: string,
  groupId: string,
  limitN = 200,
): Promise<RunSummary[]> {
  const [db, { collection, getDocs, limit, orderBy, query, where }] = await Promise.all([
    getDb(),
    import("firebase/firestore"),
  ]);

  const snapshot = await getDocs(
    query(
      collection(db, "runs"),
      where("mentorId", "==", mentorId),
      where("groupId", "==", groupId),
      where("countsTowardStats", "==", true),
      orderBy("completedAt", "desc"),
      limit(limitN),
    ),
  );

  return snapshot.docs.map((entry) => toSummary(entry.id, entry.data()));
}

/**
 * One trainee's runs in one group, from their mentor's side. Same reasoning as
 * `listGroupRuns` for why both filters are here.
 *
 * The `groupId` filter matters even though a trainee only ever belongs to one
 * group: a trainee who left group A and joined group B under the SAME mentor
 * would otherwise show runs from both here, and this page would disagree with
 * the dashboard row the mentor clicked to reach it.
 */
export async function listTraineeRuns(
  mentorId: string,
  uid: string,
  groupId: string,
  limitN = 50,
): Promise<RunSummary[]> {
  const [db, { collection, getDocs, limit, orderBy, query, where }] = await Promise.all([
    getDb(),
    import("firebase/firestore"),
  ]);

  const snapshot = await getDocs(
    query(
      collection(db, "runs"),
      where("mentorId", "==", mentorId),
      where("groupId", "==", groupId),
      where("userId", "==", uid),
      orderBy("completedAt", "desc"),
      limit(limitN),
    ),
  );

  return snapshot.docs.map((entry) => toSummary(entry.id, entry.data()));
}

export async function getRun(runId: string): Promise<RunRecord | null> {
  const [db, { doc, getDoc }] = await Promise.all([getDb(), import("firebase/firestore")]);
  const snapshot = await getDoc(doc(db, "runs", runId));

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  return { ...toSummary(snapshot.id, data), report: data.report as FeedbackReport };
}

export async function getRunTranscript(runId: string): Promise<RunTranscript | null> {
  const [db, { doc, getDoc }] = await Promise.all([getDb(), import("firebase/firestore")]);
  const snapshot = await getDoc(doc(db, "runs", runId, "transcript", "full"));

  return snapshot.exists() ? (snapshot.data() as RunTranscript) : null;
}

/**
 * The anonymous cohort projection. This is what a trainee is allowed to read
 * about their peers — scores and tiers, never names or transcripts.
 */
export async function listGroupRunStats(groupId: string, limitN = 400): Promise<RunStat[]> {
  const [db, { collection, getDocs, limit, orderBy, query, where }] = await Promise.all([
    getDb(),
    import("firebase/firestore"),
  ]);

  const snapshot = await getDocs(
    query(
      collection(db, "groups", groupId, "runStats"),
      where("countsTowardStats", "==", true),
      orderBy("completedAt", "desc"),
      limit(limitN),
    ),
  );

  return snapshot.docs.map((entry) => {
    const data = entry.data();
    return { ...(data as unknown as RunStat), completedAt: toIso(data.completedAt) };
  });
}
