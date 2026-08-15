/**
 * Roles are fixed at signup and immutable afterwards — `firestore.rules` rejects
 * any update that changes `role`. A mentor authors scenarios and reviews a group;
 * a trainee runs simulations and sees their own progress.
 */
export type Role = "mentor" | "trainee";

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  /**
   * The group this user belongs to: the group they own (mentor) or joined
   * (trainee). Null until a group is created or a join code is redeemed.
   */
  groupId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function isRole(value: unknown): value is Role {
  return value === "mentor" || value === "trainee";
}

export const roleLabel: Record<Role, string> = {
  mentor: "Mentor",
  trainee: "Trainee",
};

/** Initials for the header account chip. Falls back to the email local part. */
export function initialsFor(profile: Pick<UserProfile, "displayName" | "email">): string {
  const source = profile.displayName.trim() || profile.email.split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);

  if (parts.length === 0) {
    return "?";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}
