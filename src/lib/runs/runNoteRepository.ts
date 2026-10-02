import { getDb } from "@/lib/firebase/firebaseApp";
import { translate } from "@/lib/i18n/strings";
import type { RunSummary } from "@/types/run";
import type { RunNote } from "@/types/runNote";
import type { UserProfile } from "@/types/user";
import { toIso } from "./runRepository";

const COLLECTION = "runNotes";

function toNote(data: Record<string, unknown>): RunNote {
  return {
    ...(data as unknown as RunNote),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

/**
 * The note on one run, or null when the mentor has not left one.
 *
 * Safe to call for a run with no note: the `get` rule authorises through the
 * run document rather than through the note's own fields, so a missing note
 * reads as "does not exist" instead of being refused.
 */
export async function getRunNote(runId: string): Promise<RunNote | null> {
  const [db, { doc, getDoc }] = await Promise.all([getDb(), import("firebase/firestore")]);
  const snapshot = await getDoc(doc(db, COLLECTION, runId));

  return snapshot.exists() ? toNote(snapshot.data()) : null;
}

export type SaveRunNoteInput = {
  run: Pick<RunSummary, "id" | "userId" | "groupId">;
  mentor: Pick<UserProfile, "uid" | "displayName">;
  text: string;
  /** The note already on this run, if any. Decides create versus update. */
  existing: RunNote | null;
};

/**
 * Writes the mentor's note and returns it as stored.
 *
 * Create and update are separate writes because the rules treat them
 * differently: a create is checked against the run (the writer must be its
 * mentor, and `userId` / `groupId` must be the run's own), while an update may
 * only touch the text, the signature and `updatedAt`. Sending the whole
 * document again on an edit would have to restate `createdAt`, which the
 * client only knows as an ISO string, not as the timestamp the rule compares.
 *
 * Read back afterwards so the caller shows the server's timestamps rather than
 * a local guess at them.
 */
export async function saveRunNote(input: SaveRunNoteInput): Promise<RunNote> {
  const { run, mentor, existing } = input;
  const text = input.text.trim();

  const [db, { doc, serverTimestamp, setDoc, updateDoc }] = await Promise.all([
    getDb(),
    import("firebase/firestore"),
  ]);
  const ref = doc(db, COLLECTION, run.id);

  if (existing) {
    await updateDoc(ref, {
      text,
      mentorName: mentor.displayName,
      updatedAt: serverTimestamp(),
    });
  } else {
    const note: Omit<RunNote, "createdAt" | "updatedAt"> & {
      createdAt: unknown;
      updatedAt: unknown;
    } = {
      runId: run.id,
      userId: run.userId,
      mentorId: mentor.uid,
      mentorName: mentor.displayName,
      groupId: run.groupId,
      text,
      // Both pinned to request.time by the create rule.
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, note);
  }

  const saved = await getRunNote(run.id);

  if (!saved) {
    // Only reachable if the note was removed between the write and the read.
    throw new Error(translate("note.saveError"));
  }

  return saved;
}

export async function deleteRunNote(runId: string): Promise<void> {
  const [db, { deleteDoc, doc }] = await Promise.all([getDb(), import("firebase/firestore")]);
  await deleteDoc(doc(db, COLLECTION, runId));
}

/**
 * Ids of a trainee's own runs that carry a mentor note, for marking them in a
 * list without one read per row.
 *
 * The `userId` filter is not optional. The list rule allows a note to its
 * recipient or its author, and rules are not filters: without this constraint
 * Firestore cannot prove the result set is readable and rejects the query.
 * Equality-only, so it needs no composite index.
 */
export async function listMyRunNoteIds(uid: string, limitN = 200): Promise<string[]> {
  const [db, { collection, getDocs, limit, query, where }] = await Promise.all([
    getDb(),
    import("firebase/firestore"),
  ]);

  const snapshot = await getDocs(
    query(collection(db, COLLECTION), where("userId", "==", uid), limit(limitN)),
  );

  return snapshot.docs.map((entry) => entry.id);
}

/**
 * The same, from the mentor's side: which of one trainee's runs this mentor has
 * already written a note on. `mentorId` is what the rule needs; `userId`
 * narrows it to the trainee on screen. Two equalities, still no composite index.
 */
export async function listRunNoteIdsForTrainee(
  mentorId: string,
  uid: string,
  limitN = 200,
): Promise<string[]> {
  const [db, { collection, getDocs, limit, query, where }] = await Promise.all([
    getDb(),
    import("firebase/firestore"),
  ]);

  const snapshot = await getDocs(
    query(
      collection(db, COLLECTION),
      where("mentorId", "==", mentorId),
      where("userId", "==", uid),
      limit(limitN),
    ),
  );

  return snapshot.docs.map((entry) => entry.id);
}
