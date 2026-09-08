"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getGroup, listMentorGroups, setActiveGroup } from "./groupRepository";
import { useAuthState } from "@/lib/firebase/AuthProvider";
import type { Group } from "@/types/group";

/**
 * The groups a mentor owns, and which one they are currently working in.
 *
 * "Active group" is `users/{uid}.groupId`, not a client-side preference. It has
 * to be: the scenarios and runs create rules both pin the written groupId to
 * `profile().groupId`, so a group chosen only in the browser would have its
 * writes rejected rather than merely misfiled. `AuthProvider` holds a live
 * snapshot on that document, so a switch propagates to every page on its own.
 *
 * Ownership is read from `groups` where `mentorId == me` rather than from a
 * list kept on the user document — the group document is the only copy the
 * rules enforce, so it is the only copy worth trusting.
 */
export type MentorGroupsValue = {
  groups: Group[];
  /** The entry from `groups` matching the profile pointer, if it resolves. */
  activeGroup: Group | null;
  loading: boolean;
  error: string | null;
  switchTo: (groupId: string) => Promise<void>;
  /** Re-reads the list. Call after creating a group. */
  reload: () => Promise<void>;
};

const empty: MentorGroupsValue = {
  groups: [],
  activeGroup: null,
  loading: false,
  error: null,
  switchTo: async () => {},
  reload: async () => {},
};

/**
 * Held as one uid-stamped object rather than separate `groups` / `loading` /
 * `error` slots. Everything below is then derived from whether the stamp still
 * matches the signed-in mentor, so signing out or switching account needs no
 * reset writes — which the effect could not make anyway without cascading a
 * render.
 */
type Loaded = { uid: string; groups: Group[]; error: string | null };

/** Stable identity, so "no groups yet" does not re-run every dependent hook. */
const NO_GROUPS: Group[] = [];

const MentorGroupsContext = createContext<MentorGroupsValue>(empty);

export function MentorGroupsProvider({ children }: { children: ReactNode }) {
  const authState = useAuthState();

  // Only mentors have groups to enumerate. Trainees and the unconfigured
  // localStorage-only demo fall through to `empty` and never issue a query.
  const mentor =
    authState.status === "ready" && authState.profile.role === "mentor"
      ? authState.profile
      : null;
  const uid = mentor?.uid ?? null;
  const activeId = mentor?.groupId ?? null;

  const [loaded, setLoaded] = useState<Loaded | null>(null);

  // The self-heal below writes the profile, which re-renders this provider.
  // The ref stops that becoming a loop if the write keeps not taking effect.
  const healedFor = useRef<string | null>(null);

  const fresh = loaded && loaded.uid === uid ? loaded : null;
  const groups = useMemo(() => fresh?.groups ?? NO_GROUPS, [fresh]);
  const error = fresh?.error ?? null;
  // No group list yet for this mentor. Callers need this to tell "owns nothing"
  // apart from "not read yet" — otherwise every mentor who already has a group
  // sees the create-your-first-group screen flash on the first render.
  const loading = uid !== null && fresh === null;

  const load = useCallback(async (mentorId: string) => {
    try {
      setLoaded({ uid: mentorId, groups: await listMentorGroups(mentorId), error: null });
    } catch (err) {
      setLoaded({
        uid: mentorId,
        groups: [],
        error: err instanceof Error ? err.message : "Could not load your groups.",
      });
    }
  }, []);

  useEffect(() => {
    if (!uid) {
      healedFor.current = null;
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const next = await listMentorGroups(uid);
        if (!cancelled) {
          setLoaded({ uid, groups: next, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setLoaded({
            uid,
            groups: [],
            error: err instanceof Error ? err.message : "Could not load your groups.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid]);

  /*
   * Repairs a profile pointing at nothing.
   *
   * Reachable without any user error: `createGroup` writes the group and the
   * profile as two sequential requests, and a failure between them used to
   * leave a group that could never be reached again — there was no way to list
   * groups at all. Now there is, so the state is recoverable.
   *
   * The direct read below is what stops this fighting a create. `createGroup`
   * activates the new group BEFORE the list here is refetched, so for a moment
   * the pointer names a group this list does not know about — which looks
   * exactly like a dangling pointer. Repointing on that appearance sent the
   * mentor straight back to their oldest group every time they made a new one.
   * A pointer is only dangling if the group genuinely is not there.
   */
  useEffect(() => {
    if (!uid || loading || groups.length === 0) {
      return;
    }

    const resolves = activeId !== null && groups.some((group) => group.id === activeId);
    if (resolves || healedFor.current === uid) {
      return;
    }

    healedFor.current = uid;

    void (async () => {
      if (activeId) {
        const pointed = await getGroup(activeId).catch(() => null);
        if (pointed && pointed.mentorId === uid) {
          // The list was stale, not the pointer. Catch the list up instead.
          await load(uid);
          healedFor.current = null;
          return;
        }
      }

      await setActiveGroup(uid, groups[0].id);
    })().catch(() => {
      // The switcher and the group page both still work, so the mentor can pick
      // one by hand. Nothing to surface for a repair they never asked for.
      healedFor.current = null;
    });
  }, [activeId, groups, load, loading, uid]);

  const value = useMemo<MentorGroupsValue>(() => {
    if (!uid) {
      return empty;
    }

    return {
      groups,
      activeGroup: groups.find((group) => group.id === activeId) ?? null,
      loading,
      error,
      switchTo: async (groupId: string) => {
        // Firestore's latency compensation fires the users/{uid} snapshot from
        // the pending local write, so the app flips immediately and rolls back
        // on its own if the rules reject it.
        await setActiveGroup(uid, groupId);
      },
      reload: () => load(uid),
    };
  }, [activeId, error, groups, load, loading, uid]);

  return <MentorGroupsContext.Provider value={value}>{children}</MentorGroupsContext.Provider>;
}

export function useMentorGroups(): MentorGroupsValue {
  return useContext(MentorGroupsContext);
}
