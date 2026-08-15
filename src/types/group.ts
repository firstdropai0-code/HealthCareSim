import type { Role } from "./user";

export type Group = {
  id: string;
  name: string;
  mentorId: string;
  mentorName: string;
  joinCode: string;
  joinCodeActive: boolean;
  createdAt: string;
};

export type GroupMember = {
  uid: string;
  displayName: string;
  email: string;
  role: Role;
  joinedAt: string;
  /**
   * The code used to join. The membership create rule reads this to look up
   * `joinCodes/{usedCode}` and confirm it really points at this group — rules
   * cannot run a query, so the client has to name the code it used.
   */
  usedCode: string;
};

/**
 * The public half of a join code. Any signed-in user can `get()` one of these
 * by id, so it must never carry anything sensitive.
 */
export type JoinCodeDoc = {
  code: string;
  groupId: string;
  mentorId: string;
  active: boolean;
  createdAt: string;
};
