"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { LoadingButton } from "@/components/common/LoadingButton";
import { AppShell } from "@/components/layout/AppShell";
import { Reveal } from "@/components/motion/Reveal";
import { useRequireBackend } from "@/lib/firebase/useAuth";
import { useT } from "@/lib/i18n/strings";
import {
  getGroup,
  leaveGroup,
  lookupJoinCode,
  redeemJoinCode,
} from "@/lib/groups/groupRepository";
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
  const t = useT();

  const [code, setCode] = useState("");
  const [pending, setPending] = useState<Group | null>(null);
  const [joined, setJoined] = useState<Group | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
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
      setError(err instanceof Error ? err.message : t("join.codeError"));
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!trainee) {
      return;
    }

    setLeaving(true);
    setError(null);

    try {
      await leaveGroup(trainee);
      // The profile snapshot clears `currentGroupId` on its own, which drops
      // this branch and renders the code form again.
      setJoined(null);
      setConfirmingLeave(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("join.leaveError"));
    } finally {
      setLeaving(false);
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
      setError(err instanceof Error ? err.message : t("join.joinError"));
    } finally {
      setBusy(false);
    }
  }

  if (currentGroupId) {
    return (
      <AppShell>
        <Reveal className="mx-auto max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-soft)]">
          <p className="eyebrow text-[var(--color-primary)]">{t("join.inAGroup")}</p>
          <h1 className="display-md mt-2">{joined?.name ?? t("join.yourGroup")}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-ink-soft)]">
            {joined?.mentorName
              ? t("join.mentorIs", { name: joined.mentorName })
              : t("join.sharedWithMentor")}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/cases" className="btn-editorial btn-editorial--accent">
              {t("join.startCase")}
            </Link>
            <Link href="/progress" className="btn-editorial btn-editorial--quiet">
              {t("join.myProgress")}
            </Link>
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-5 rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-left text-sm text-[var(--color-danger)]"
            >
              {error}
            </div>
          ) : null}

          {/* Two steps on purpose. Leaving is recoverable — the trainee only
              needs a code to come back — but it is not what anyone came to this
              screen to do, and a single stray click should not do it. */}
          <div className="mt-8 border-t border-[var(--color-border)] pt-5">
            {confirmingLeave ? (
              <>
                <p className="text-sm leading-6 text-[var(--color-ink)]">
                  {t("join.leaveConfirm", { name: joined?.name ?? t("join.thisGroup") })}
                </p>
                <p className="mt-1.5 text-xs leading-5 text-[var(--color-ink-soft)]">
                  {t("join.leaveBody")}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <LoadingButton
                    type="button"
                    loading={leaving}
                    onClick={() => void handleLeave()}
                  >
                    {t("join.leaveYes")}
                  </LoadingButton>
                  <button
                    type="button"
                    onClick={() => setConfirmingLeave(false)}
                    disabled={leaving}
                    className="btn-editorial btn-editorial--quiet"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs leading-5 text-[var(--color-ink-soft)]">
                  {t("join.wrongGroup")}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingLeave(true);
                    setError(null);
                  }}
                  className="link-editorial mt-2 text-sm font-medium text-[var(--color-ink-muted)]"
                >
                  {t("join.leave")}
                </button>
              </>
            )}
          </div>
        </Reveal>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Reveal className="mx-auto max-w-lg">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)]">
          <p className="eyebrow text-[var(--color-primary)]">{t("join.title")}</p>
          <h1 className="display-md mt-2">{t("join.enterCode")}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-ink-soft)]">
            {t("join.sixChars")}
          </p>

          <label htmlFor="join-code" className="eyebrow mt-6 block text-[var(--color-ink)]">
            {t("join.codeLabel")}
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
                {t("join.mentorLine", { name: pending.mentorName })}
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
                {t("join.joinNamed", { name: pending.name })}
              </LoadingButton>
            ) : (
              <LoadingButton
                type="button"
                loading={busy}
                disabled={!isWellFormedJoinCode(code)}
                onClick={() => void handleLookup()}
                className="w-full justify-center"
              >
                {t("join.find")}
              </LoadingButton>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-sm text-[var(--color-ink-soft)]">
          {t("join.needCode")}
        </p>
      </Reveal>
    </AppShell>
  );
}
