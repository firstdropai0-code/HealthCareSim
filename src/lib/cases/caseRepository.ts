import { getDb } from "@/lib/firebase/firebaseApp";
import type { AssignedCase } from "@/types/assignedCase";
import type { Scenario } from "@/types/scenario";
import type { UserProfile } from "@/types/user";

/** Publishes a generated scenario to the mentor's group. */
export async function publishCase(
  mentor: UserProfile,
  scenario: Scenario,
): Promise<AssignedCase> {
  if (!mentor.groupId) {
    throw new Error("Create a group before publishing a case.");
  }

  const [db, { collection, doc, setDoc }] = await Promise.all([
    getDb(),
    import("firebase/firestore"),
  ]);

  const ref = doc(collection(db, "scenarios"));
  const entry: AssignedCase = {
    id: ref.id,
    groupId: mentor.groupId,
    mentorId: mentor.uid,
    mentorName: mentor.displayName,

    title: scenario.title,
    summary: scenario.summary,
    category: scenario.category ?? null,
    difficulty: scenario.difficulty ?? "intermediate",
    libraryId: scenario.libraryId ?? null,

    scenario,
    createdAt: new Date().toISOString(),
  };

  await setDoc(ref, entry);
  return entry;
}

export async function listGroupCases(groupId: string, limitN = 100): Promise<AssignedCase[]> {
  const [db, { collection, getDocs, limit, orderBy, query, where }] = await Promise.all([
    getDb(),
    import("firebase/firestore"),
  ]);

  const snapshot = await getDocs(
    query(
      collection(db, "scenarios"),
      where("groupId", "==", groupId),
      orderBy("createdAt", "desc"),
      limit(limitN),
    ),
  );

  return snapshot.docs.map((entry) => entry.data() as AssignedCase);
}

/**
 * Removing a case only stops it being started again. Runs embed their own copy
 * of the scenario, so past results and transcripts are untouched.
 */
export async function removeCase(caseId: string): Promise<void> {
  const [db, { deleteDoc, doc }] = await Promise.all([getDb(), import("firebase/firestore")]);
  await deleteDoc(doc(db, "scenarios", caseId));
}
