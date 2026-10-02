/**
 * A mentor's note to a trainee about one run. One per run, keyed by the run id.
 *
 * It lives in its own top-level collection rather than on the run or under it,
 * and both reasons come from the rules:
 *
 * - A scored run is immutable. That is what stops a score being edited after
 *   the report is read, and a note field on the run would need an update rule
 *   that reopens it.
 * - A trainee asks "which of my runs have a note?" in one query. Rules are not
 *   filters, so the query itself has to prove every document it could return is
 *   readable — which means the note must carry `userId` and be queried on it.
 *
 * `userId` and `groupId` are copied from the run, never chosen by the writer:
 * the create rule checks both against the run document, so a note can only ever
 * be addressed to the trainee who actually ran it.
 */
export type RunNote = {
  runId: string;
  /** The trainee the note is for: the run's owner. */
  userId: string;
  mentorId: string;
  /** Denormalized so the trainee's page needs no `users` read to sign it. */
  mentorName: string;
  groupId: string;
  text: string;
  /** ISO on read; both are written as server timestamps the rules pin. */
  createdAt: string;
  updatedAt: string;
};

/** Mirrored in `firestore.rules`. Change both or the save is rejected. */
export const RUN_NOTE_MAX_LENGTH = 2000;
