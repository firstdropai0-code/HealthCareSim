import { getDb } from "@/lib/firebase/firebaseApp";
import { getGroup } from "@/lib/groups/groupRepository";
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
function toIso(value: unknown): string {
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

/**
 * Writes the run, its transcript, and the anonymous cohort projection.
 *
 * These are three sequential awaits, NOT a batch: the `runStats` create rule
 * get()s `runs/{runId}` to prove ownership, and inside a writeBatch that get()
 * would run against pre-batch state where the run does not exist yet. The
 * deterministic run id makes a retry after a partial failure idempotent.
 */
export async function saveCompletedRun(input: SaveRunInput): Promise<string> {
  const { state, report, profile } = input;

  if (!profile.groupId) {
    throw new Error("Join a group before saving results.");
  }

  const [db, { doc, serverTimestamp, setDoc }, group] = await Promise.all([
    getDb(),
    import("firebase/firestore"),
    // Read rather than trusted from the client: the create rule cross-checks
    // this against the group document, so a wrong value is simply rejected.
    getGroup(profile.groupId),
  ]);

  if (!group) {
    throw new Error("Your group no longer exists.");
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

  await setDoc(doc(db, "runs", runId), record);

  const transcript: RunTranscript = {
    messages: state.messages,
    scenario: state.scenario,
  };
  await setDoc(doc(db, "runs", runId, "transcript", "full"), transcript);

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
  await setDoc(doc(db, "groups", profile.groupId, "runStats", runId), stat);

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
 * Every scored run a mentor owns, newest first.
 *
 * Filtered on `mentorId`, not `groupId`, and that is load-bearing rather than a
 * style choice. The read rule authorises on `userId == me || mentorId == me`,
 * and rules are not filters: Firestore rejects a list query unless the query
 * itself proves every document it could return is readable. A `groupId` filter
 * proves nothing about either field. Since a mentor owns exactly one group, the
 * two filters select the same rows anyway.
 */
export async function listGroupRuns(mentorId: string, limitN = 200): Promise<RunSummary[]> {
  const [db, { collection, getDocs, limit, orderBy, query, where }] = await Promise.all([
    getDb(),
    import("firebase/firestore"),
  ]);

  const snapshot = await getDocs(
    query(
      collection(db, "runs"),
      where("mentorId", "==", mentorId),
      where("countsTowardStats", "==", true),
      orderBy("completedAt", "desc"),
      limit(limitN),
    ),
  );

  return snapshot.docs.map((entry) => toSummary(entry.id, entry.data()));
}

/** One trainee's runs, from their mentor's side. Same `mentorId` reasoning. */
export async function listTraineeRuns(
  mentorId: string,
  uid: string,
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
