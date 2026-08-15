"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { LoadingButton } from "@/components/common/LoadingButton";
import { AppShell } from "@/components/layout/AppShell";
import { Reveal } from "@/components/motion/Reveal";
import { useRequireBackend } from "@/lib/firebase/useAuth";
import { getGroup, lookupJoinCode, redeemJoinCode } from "@/lib/groups/groupRepository";
import {
  JOIN_CODE_LENGTH,
  isWellFormedJoinCode,
  normalizeJoinCode,
} from "@/lib/groups/joinCode";
import type { Group } from "@/types/group";

export default function JoinGroupPage() {
  const gate = useRequireBackend("trainee");
  const profile = gate.blocked ? null : gate.profile;
  const currentGroupId = profile?.groupId ?? null;

  const [code, setCode] = useState("");
  const [pending, setPending] = useState<Group | null>(null);
  const [joined, setJoined] = useState<Group | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentGroupId) {
      return;
    }

    let cancelled = false;
    void getGroup(currentGroupId).then((group) => {
      if (!cancelled) {
        setJoined(group);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentGroupId]);

  if (gate.blocked) {
    return <AuthGate gate={gate} />;
  }

  const trainee = gate.profile;
  if (!trainee) {
    return null;
  }

  // Look the code up first so the trainee sees the group name before they
  // commit — a mistyped code that happens to exist should be caught here.
  async function handleLookup() {
    setBusy(true);
    setError(null);

    try {
      const result = await lookupJoinCode(code);
      setPending(result.group);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code did not work.");
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!pending || !trainee) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const group = await redeemJoinCode(trainee, code);
      setJoined(group);
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join that group.");
    } finally {
      setBusy(false);
    }
  }

  if (currentGroupId) {
    return (
      <AppShell>
        <Reveal className="mx-auto max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-soft)]">
          <p className="eyebrow text-[var(--color-primary)]">You are in a group</p>
          <h1 className="display-md mt-2">{joined?.name ?? "Your training group"}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-ink-soft)]">
            {joined?.mentorName
              ? `Your mentor is ${joined.mentorName}. Completed cases are shared with them.`
              : "Completed cases are shared with your mentor."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/cases" className="btn-editorial btn-editorial--accent">
              Start a case
            </Link>
            <Link href="/progress" className="btn-editorial btn-editorial--quiet">
              My progress
            </Link>
          </div>
        </Reveal>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Reveal className="mx-auto max-w-lg">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)]">
          <p className="eyebrow text-[var(--color-primary)]">Join a group</p>
          <h1 className="display-md mt-2">Enter your mentor&rsquo;s code.</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-ink-soft)]">
            Six characters. Your mentor can see your completed cases once you join.
          </p>

          <label htmlFor="join-code" className="eyebrow mt-6 block text-[var(--color-ink)]">
            Join code
          </label>
          <input
            id="join-code"
            value={code}
            onChange={(event) => {
              setCode(normalizeJoinCode(event.target.value).slice(0, JOIN_CODE_LENGTH));
              setPending(null);
              setError(null);
            }}
            maxLength={JOIN_CODE_LENGTH}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="ABC234"
            className="mt-2 w-full border border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] px-3 py-3 text-center font-mono text-2xl font-semibold tracking-[0.4em] tabular-nums text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)] focus:bg-white"
          />

          {error ? (
            <div
              role="alert"
              className="mt-4 rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]"
            >
              {error}
            </div>
          ) : null}

          {pending ? (
            <div className="mt-4 rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-primary)] bg-[var(--color-primary-soft)] px-4 py-3">
              <p className="text-sm font-medium text-[var(--color-ink)]">{pending.name}</p>
              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                Mentor: {pending.mentorName}
              </p>
            </div>
          ) : null}

          <div className="mt-5">
            {pending ? (
              <LoadingButton
                type="button"
                loading={busy}
                onClick={() => void handleJoin()}
                className="w-full justify-center"
              >
                Join {pending.name}
              </LoadingButton>
            ) : (
              <LoadingButton
                type="button"
                loading={busy}
                disabled={!isWellFormedJoinCode(code)}
                onClick={() => void handleLookup()}
                className="w-full justify-center"
              >
                Find group
              </LoadingButton>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-sm text-[var(--color-ink-soft)]">
          Your mentor sets the cases you practise, so you will need their code before you can
          start.
        </p>
      </Reveal>
    </AppShell>
  );
}
