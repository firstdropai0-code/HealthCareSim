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
import { useRequireBackend } from "@/lib/firebase/useAuth";
import type { Group, GroupMember } from "@/types/group";

export default function MentorGroupPage() {
  const gate = useRequireBackend("mentor");
  const profile = gate.blocked ? null : gate.profile;
  const groupId = profile?.groupId ?? null;

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [queryLoaded, setQueryLoaded] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (id: string) => {
    const [nextGroup, nextMembers] = await Promise.all([getGroup(id), listMembers(id)]);
    setGroup(nextGroup);
    setMembers(nextMembers);
  }, []);

  // Derived rather than set in the effect: with no group there is nothing to
  // fetch, so "loaded" is already true.
  const loaded = groupId ? queryLoaded : profile !== null;

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
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load your group.");
        }
      } finally {
        if (!cancelled) {
          setQueryLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [groupId, profile]);

  if (gate.blocked) {
    return <AuthGate gate={gate} />;
  }

  // Non-null in practice: useRequireBackend blocks the unconfigured passthrough
  // that is the only way `profile` comes back empty.
  const mentor = gate.profile;
  if (!mentor) {
    return null;
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!mentor) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const nextGroup = await createGroup(mentor, name);
      setGroup(nextGroup);
      setMembers([]);
      setQueryLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the group.");
    } finally {
      setBusy(false);
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

  return (
    <AppShell>
      <div className="space-y-6">
        <Reveal className="accent-edge rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <p className="eyebrow text-[var(--color-primary)]">My group</p>
          <h1 className="display-md mt-2">{group ? group.name : "Set up your training group."}</h1>
          <p className="mt-2 max-w-2xl text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
            {group
              ? "Trainees who redeem your join code appear here, and their completed runs feed your dashboard."
              : "A group holds your trainees and their results. You need one before anyone can join."}
          </p>
          {group ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <MetricChip
                label="Trainees"
                value={String(members.length)}
                tone="emerald"
              />
              <MetricChip label="Mentor" value={group.mentorName} tone="slate" />
            </div>
          ) : null}
        </Reveal>

        {error ? (
          <div
            role="alert"
            className="rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]"
          >
            {error}
          </div>
        ) : null}

        {!loaded ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Loading your group...</p>
        ) : group ? (
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
            <JoinCodeCard code={group.joinCode} onRotate={() => void handleRotate()} rotating={rotating} />

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
        ) : (
          <Reveal
            as="section"
            className="max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)] sm:p-6"
          >
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="group-name" className="eyebrow text-[var(--color-ink)]">
                  Group name
                </label>
                <p className="mt-2 text-xs leading-5 text-[var(--color-ink-soft)]">
                  Something your trainees will recognise, like a cohort or rotation name.
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

              <LoadingButton type="submit" loading={busy} disabled={!name.trim()}>
                Create group
              </LoadingButton>
            </form>
          </Reveal>
        )}
      </div>
    </AppShell>
  );
}
