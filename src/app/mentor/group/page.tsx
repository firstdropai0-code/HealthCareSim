"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { LoadingButton } from "@/components/common/LoadingButton";
import { MetricChip } from "@/components/common/VisualCards";
import { JoinCodeCard } from "@/components/groups/JoinCodeCard";
import { MemberList } from "@/components/groups/MemberList";
import { AppShell } from "@/components/layout/AppShell";
import { Reveal } from "@/components/motion/Reveal";
import {
  createGroup,
  getGroup,
  listMembers,
  removeMember,
  rotateJoinCode,
} from "@/lib/groups/groupRepository";
import { useMentorGroups } from "@/lib/groups/MentorGroupsProvider";
import { useRequireBackend } from "@/lib/firebase/useAuth";
import type { Group, GroupMember } from "@/types/group";

/** Marks the selected group. Stroke-only, currentColor, like the other icons. */
function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-3.5 w-3.5 shrink-0"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

export default function MentorGroupPage() {
  const gate = useRequireBackend("mentor");
  const profile = gate.blocked ? null : gate.profile;
  const groupId = profile?.groupId ?? null;
  const {
    groups,
    loading: groupsLoading,
    error: groupsError,
    switchTo,
    reload,
  } = useMentorGroups();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loadedGroupId, setLoadedGroupId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (id: string) => {
    const [nextGroup, nextMembers] = await Promise.all([getGroup(id), listMembers(id)]);
    setGroup(nextGroup);
    setMembers(nextMembers);
  }, []);

  /*
   * Keyed to the group the state came from, rather than a "have we fetched yet"
   * boolean. That boolean never reset, so switching groups left the previous
   * group's name, join code and roster on screen with no loading state to
   * suggest any of it was stale.
   */
  const loaded = groupId ? loadedGroupId === groupId : !groupsLoading;

  useEffect(() => {
    if (!groupId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const [nextGroup, nextMembers] = await Promise.all([
          getGroup(groupId),
          listMembers(groupId),
        ]);
        if (!cancelled) {
          setGroup(nextGroup);
          setMembers(nextMembers);
          // Cleared here rather than up front: a failure on the previous group
          // must not stay on screen once a different one has loaded cleanly.
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load your group.");
        }
      } finally {
        if (!cancelled) {
          setLoadedGroupId(groupId);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [groupId]);

  if (gate.blocked) {
    return <AuthGate gate={gate} />;
  }

  // Non-null in practice: useRequireBackend blocks the unconfigured passthrough
  // that is the only way `profile` comes back empty.
  const mentor = gate.profile;
  if (!mentor) {
    return null;
  }

  const hasGroups = groups.length > 0;
  // Never render the previous group's document while the new one is in flight.
  const shownGroup = loaded ? group : null;

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!mentor) {
      return;
    }

    setCreating(true);
    setError(null);

    try {
      await createGroup(mentor, name);
      // createGroup makes the new group active, so the profile snapshot moves
      // the pointer and the effect above refetches on its own. Deliberately no
      // optimistic `setLoadedGroupId` here: if the pointer did not end up where
      // we assumed, that would latch the page into a loading state the effect
      // can never clear. Let the fetch be the only thing that marks it loaded.
      await reload();
      setName("");
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the group.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSwitch(id: string) {
    // Guarded here rather than with the `disabled` attribute, because
    // `.btn-editorial:disabled` repaints a button in muted grey — which made
    // the selected group read as the one option you could not choose.
    if (id === groupId || switchingId !== null) {
      return;
    }

    setSwitchingId(id);
    setError(null);

    try {
      await switchTo(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch group.");
    } finally {
      setSwitchingId(null);
    }
  }

  async function handleRotate() {
    if (!group) {
      return;
    }

    setRotating(true);
    setError(null);

    try {
      const nextCode = await rotateJoinCode(group);
      setGroup({ ...group, joinCode: nextCode });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rotate the code.");
    } finally {
      setRotating(false);
    }
  }

  async function handleRemove(member: GroupMember) {
    if (!group) {
      return;
    }

    setRemovingUid(member.uid);
    setError(null);

    try {
      await removeMember(group.id, member.uid);
      await refresh(group.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that trainee.");
    } finally {
      setRemovingUid(null);
    }
  }

  const createForm = (
    <form onSubmit={handleCreate} className="space-y-4">
      <div>
        <label htmlFor="group-name" className="eyebrow text-[var(--color-ink)]">
          Group name
        </label>
        <p className="mt-2 text-xs leading-5 text-[var(--color-ink-soft)]">
          Something your trainees will recognise, like a rotation or specialty.
        </p>
        <input
          id="group-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          placeholder="Example: FY1 Communication Block, Autumn"
          className="mt-3 w-full border border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)] focus:bg-white"
        />
      </div>

      <LoadingButton type="submit" loading={creating} disabled={!name.trim()}>
        Create group
      </LoadingButton>
    </form>
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <Reveal className="accent-edge rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <p className="eyebrow text-[var(--color-primary)]">
            {groups.length > 1 ? "My groups" : "My group"}
          </p>
          <h1 className="display-md mt-2">
            {shownGroup ? shownGroup.name : "Set up your first training group."}
          </h1>
          <p className="mt-2 max-w-2xl text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
            {hasGroups
              ? "Trainees who redeem this group's join code appear here, and their completed runs feed your dashboard. Each group keeps its own code, roster and cases."
              : "A group holds your trainees and their results. You need one before anyone can join, and you can create more later — one per rotation or specialty."}
          </p>
          {shownGroup ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <MetricChip label="Trainees" value={String(members.length)} tone="emerald" />
              <MetricChip label="Mentor" value={shownGroup.mentorName} tone="slate" />
              {groups.length > 1 ? (
                <MetricChip label="My groups" value={String(groups.length)} tone="blue" />
              ) : null}
            </div>
          ) : null}
        </Reveal>

        {error || groupsError ? (
          <div
            role="alert"
            className="rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]"
          >
            {error ?? groupsError}
          </div>
        ) : null}

        {/* Only worth showing once there is actually a choice to make. */}
        {groups.length > 1 ? (
          <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
            <h2 className="eyebrow text-[var(--color-ink)]">Switch group</h2>
            <p className="mt-2 text-xs leading-5 text-[var(--color-ink-soft)]">
              The selected group is the one this page manages, the one your dashboard reports on,
              and the one new cases publish to.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {groups.map((entry) => {
                const isActive = entry.id === groupId;
                const isBusy = switchingId === entry.id;

                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => void handleSwitch(entry.id)}
                      aria-current={isActive ? "true" : undefined}
                      aria-disabled={isActive || switchingId !== null ? true : undefined}
                      className={`btn-editorial min-h-9 gap-2 px-3 py-1.5 text-xs ${
                        isActive
                          ? "btn-editorial--accent cursor-default"
                          : "btn-editorial--quiet"
                      } ${switchingId !== null && !isBusy ? "opacity-60" : ""}`}
                    >
                      {isActive ? <CheckIcon /> : null}
                      <span className="truncate">{entry.name}</span>
                      {isActive ? (
                        <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em]">
                          Selected
                        </span>
                      ) : null}
                      {isBusy ? <span aria-hidden>&hellip;</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {!loaded ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Loading your group...</p>
        ) : shownGroup ? (
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
            <JoinCodeCard
              code={shownGroup.joinCode}
              onRotate={() => void handleRotate()}
              rotating={rotating}
            />

            <section>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="display-sm">Trainees</h2>
                <Link href="/mentor" className="link-editorial text-sm font-medium text-[var(--color-primary)]">
                  Open dashboard
                </Link>
              </div>
              <div className="mt-3">
                <MemberList
                  members={members}
                  onRemove={(member) => void handleRemove(member)}
                  removingUid={removingUid}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-[var(--color-ink-soft)]">
                Select a name to see that trainee&rsquo;s progress and sessions. Removing a trainee
                stops them adding new results to this group; runs they already completed stay on
                your dashboard.
              </p>
            </section>
          </div>
        ) : null}

        {/* Reachable at any time once a group exists, but collapsed: creating a
            second group is an occasional act, and an open form sitting under the
            roster read as the main thing to do on this page. */}
        {hasGroups ? (
          <section className="max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
            {formOpen ? (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="display-sm">New group</h2>
                  <button
                    type="button"
                    onClick={() => setFormOpen(false)}
                    className="link-editorial text-sm font-medium text-[var(--color-ink-muted)]"
                  >
                    Cancel
                  </button>
                </div>
                <div className="mt-4">{createForm}</div>
              </>
            ) : (
              <>
                <h2 className="display-sm">Running a second cohort?</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--color-ink-soft)]">
                  Create another group to keep a different domain&rsquo;s trainees, cases and
                  results separate.
                </p>
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className="btn-editorial btn-editorial--quiet mt-4"
                >
                  Create another group
                </button>
              </>
            )}
          </section>
        ) : groupsLoading ? null : (
          <Reveal
            as="section"
            className="max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)] sm:p-6"
          >
            {createForm}
          </Reveal>
        )}
      </div>
    </AppShell>
  );
}
