import { getDb } from "@/lib/firebase/firebaseApp";
import { generateJoinCode, normalizeJoinCode } from "./joinCode";
import type { Group, GroupMember, JoinCodeDoc } from "@/types/group";
import type { UserProfile } from "@/types/user";

export type GroupErrorCode =
  | "code-not-found"
  | "code-inactive"
  | "group-missing"
  | "code-collision"
  | "already-in-group";

export class GroupError extends Error {
  readonly code: GroupErrorCode;

  constructor(code: GroupErrorCode, message: string) {
    super(message);
    this.name = "GroupError";
    this.code = code;
  }
}

const CODE_CLAIM_ATTEMPTS = 5;

/**
 * Claims an unused `joinCodes/{CODE}` document for a group that does not exist
 * yet. Firestore's `create` only fires when the document is absent, so the
 * transaction is what makes the claim exclusive — two mentors racing on the
 * same random code cannot both win.
 *
 * The rules deliberately do NOT require the group to exist here: this runs
 * before the group is written, and a rule that get()s a doc from the same
 * write would see stale state anyway.
 */
async function claimJoinCode(groupId: string, mentorId: string): Promise<string> {
  const [db, { doc, runTransaction }] = await Promise.all([
    getDb(),
    import("firebase/firestore"),
  ]);

  for (let attempt = 0; attempt < CODE_CLAIM_ATTEMPTS; attempt += 1) {
    const code = generateJoinCode();

    try {
      await runTransaction(db, async (transaction) => {
        const ref = doc(db, "joinCodes", code);
        const existing = await transaction.get(ref);

        if (existing.exists()) {
          throw new GroupError("code-collision", "Code already taken.");
        }

        const payload: JoinCodeDoc = {
          code,
          groupId,
          mentorId,
          active: true,
          createdAt: new Date().toISOString(),
        };

        transaction.set(ref, payload);
      });

      return code;
    } catch (error) {
      const isCollision = error instanceof GroupError && error.code === "code-collision";
      if (!isCollision) {
        throw error;
      }
    }
  }

  throw new GroupError("code-collision", "Could not allocate a join code. Try again.");
}

export async function createGroup(mentor: UserProfile, name: string): Promise<Group> {
  const [db, { collection, doc, setDoc, updateDoc }] = await Promise.all([
    getDb(),
    import("firebase/firestore"),
  ]);

  // The id is minted client-side so the join code can point at the group before
  // the group document is written.
  const groupRef = doc(collection(db, "groups"));
  const joinCode = await claimJoinCode(groupRef.id, mentor.uid);

  const group: Group = {
    id: groupRef.id,
    name: name.trim(),
    mentorId: mentor.uid,
    mentorName: mentor.displayName,
    joinCode,
    joinCodeActive: true,
    createdAt: new Date().toISOString(),
  };

  await setDoc(groupRef, group);
  await updateDoc(doc(db, "users", mentor.uid), {
    groupId: group.id,
    updatedAt: new Date().toISOString(),
  });

  return group;
}

export async function getGroup(groupId: string): Promise<Group | null> {
  const [db, { doc, getDoc }] = await Promise.all([getDb(), import("firebase/firestore")]);
  const snapshot = await getDoc(doc(db, "groups", groupId));

  return snapshot.exists() ? (snapshot.data() as Group) : null;
}

/** Resolves a code to its group so the trainee can confirm before joining. */
export async function lookupJoinCode(rawCode: string): Promise<{ code: JoinCodeDoc; group: Group }> {
  const code = normalizeJoinCode(rawCode);
  const [db, { doc, getDoc }] = await Promise.all([getDb(), import("firebase/firestore")]);

  const codeSnapshot = await getDoc(doc(db, "joinCodes", code));
  if (!codeSnapshot.exists()) {
    throw new GroupError("code-not-found", "That code does not match a group.");
  }

  const codeDoc = codeSnapshot.data() as JoinCodeDoc;
  if (!codeDoc.active) {
    throw new GroupError("code-inactive", "That code is no longer active. Ask for a new one.");
  }

  const group = await getGroup(codeDoc.groupId);
  if (!group) {
    throw new GroupError("group-missing", "The group for that code no longer exists.");
  }

  return { code: codeDoc, group };
}

/**
 * Two sequential writes, never a batch: the `users` update rule checks that the
 * membership document exists, and inside a batch that check would run against
 * pre-batch state and fail. Membership first, profile second.
 */
export async function redeemJoinCode(profile: UserProfile, rawCode: string): Promise<Group> {
  const { code, group } = await lookupJoinCode(rawCode);
  const [db, { doc, setDoc, updateDoc }] = await Promise.all([
    getDb(),
    import("firebase/firestore"),
  ]);

  const member: GroupMember = {
    uid: profile.uid,
    displayName: profile.displayName,
    email: profile.email,
    role: profile.role,
    joinedAt: new Date().toISOString(),
    usedCode: code.code,
  };

  await setDoc(doc(db, "groups", group.id, "members", profile.uid), member);
  await updateDoc(doc(db, "users", profile.uid), {
    groupId: group.id,
    updatedAt: new Date().toISOString(),
  });

  return group;
}

export async function listMembers(groupId: string): Promise<GroupMember[]> {
  const [db, { collection, getDocs, orderBy, query }] = await Promise.all([
    getDb(),
    import("firebase/firestore"),
  ]);

  const snapshot = await getDocs(
    query(collection(db, "groups", groupId, "members"), orderBy("joinedAt", "asc")),
  );

  return snapshot.docs.map((entry) => entry.data() as GroupMember);
}

/**
 * Issues a fresh code and deactivates the old one. The old document is kept
 * rather than deleted so a stale code fails with "no longer active" instead of
 * the same "not found" a typo produces.
 */
export async function rotateJoinCode(group: Group): Promise<string> {
  const [db, { doc, updateDoc }] = await Promise.all([getDb(), import("firebase/firestore")]);

  const nextCode = await claimJoinCode(group.id, group.mentorId);

  await updateDoc(doc(db, "joinCodes", group.joinCode), { active: false });
  await updateDoc(doc(db, "groups", group.id), {
    joinCode: nextCode,
    joinCodeActive: true,
  });

  return nextCode;
}

/**
 * Removes a trainee's membership. Their own `users/{uid}.groupId` still points
 * here — only they can write that document — so the run-create rule also
 * requires a live membership. Without a member document they cannot add
 * anything further to this group.
 */
export async function removeMember(groupId: string, uid: string): Promise<void> {
  const [db, { deleteDoc, doc }] = await Promise.all([getDb(), import("firebase/firestore")]);
  await deleteDoc(doc(db, "groups", groupId, "members", uid));
}
