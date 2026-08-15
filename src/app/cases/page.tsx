"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { MetricChip } from "@/components/common/VisualCards";
import { AppShell } from "@/components/layout/AppShell";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { listGroupCases, removeCase } from "@/lib/cases/caseRepository";
import { useRequireBackend } from "@/lib/firebase/useAuth";
import { difficultyMeta, difficultyOrder } from "@/lib/scenarios/scenarioLibrary";
import { createInitialSimulationState } from "@/lib/simulation/simulationEngine";
import {
  clearSimulationState,
  saveSimulationState,
} from "@/lib/storage/localSimulationStorage";
import type { AssignedCase } from "@/types/assignedCase";

export default function CasesPage() {
  const gate = useRequireBackend();
  const router = useRouter();
  const profile = gate.blocked ? null : gate.profile;
  const groupId = profile?.groupId ?? null;
  const isMentor = profile?.role === "mentor";

  const [cases, setCases] = useState<AssignedCase[]>([]);
  const [queryLoaded, setQueryLoaded] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loaded = groupId ? queryLoaded : true;

  useEffect(() => {
    if (!groupId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const next = await listGroupCases(groupId);
        if (!cancelled) {
          setCases(next);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load your cases.");
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
  }, [groupId]);

  // Grouped by tier so the list reads the same way the case library does.
  const byTier = useMemo(
    () =>
      difficultyOrder
        .map((difficulty) => ({
          difficulty,
          entries: cases.filter((entry) => entry.difficulty === difficulty),
        }))
        .filter((tier) => tier.entries.length > 0),
    [cases],
  );

  if (gate.blocked) {
    return <AuthGate gate={gate} />;
  }

  function handleStart(entry: AssignedCase) {
    // A fresh run id per attempt, so running the same case twice produces two
    // records rather than overwriting the first.
    clearSimulationState();
    saveSimulationState(createInitialSimulationState(entry.scenario));
    router.push("/simulation");
  }

  async function handleRemove(entry: AssignedCase) {
    setRemovingId(entry.id);
    setError(null);

    try {
      await removeCase(entry.id);
      setCases((current) => current.filter((item) => item.id !== entry.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that case.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <Reveal className="accent-edge rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <p className="eyebrow text-[var(--color-primary)]">
            {isMentor ? "Published cases" : "My cases"}
          </p>
          <h1 className="display-md mt-2">
            {isMentor ? "Cases you have set for your group." : "Cases set by your mentor."}
          </h1>
          <p className="mt-2 max-w-2xl text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
            {isMentor
              ? "Trainees in your group pick from this list. Removing a case stops new attempts; results already recorded stay on your dashboard."
              : "Pick one to start. Each attempt is recorded separately, so you can run the same case again as you improve."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <MetricChip label="Cases" value={String(cases.length)} tone="emerald" />
            {isMentor ? (
              <Link href="/scenario" className="btn-editorial btn-editorial--accent min-h-8 px-3 py-1 text-xs">
                Create a case
              </Link>
            ) : null}
          </div>
        </Reveal>

        {error ? (
          <div
            role="alert"
            className="rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]"
          >
            {error}
          </div>
        ) : null}

        {!groupId ? (
          <div className="rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-warning)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm">
            {isMentor ? (
              <>
                Create a group before publishing cases.{" "}
                <Link href="/mentor/group" className="font-semibold underline">
                  Set up my group
                </Link>
                .
              </>
            ) : (
              <>
                You are not in a group yet, so no cases have been set for you.{" "}
                <Link href="/join" className="font-semibold underline">
                  Enter a join code
                </Link>
                .
              </>
            )}
          </div>
        ) : !loaded ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Loading cases...</p>
        ) : cases.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] p-8 text-center">
            <p className="text-sm font-medium text-[var(--color-ink)]">No cases yet.</p>
            <p className="mt-1.5 text-xs leading-5 text-[var(--color-ink-soft)]">
              {isMentor
                ? "Generate a scenario and publish it to your group."
                : "Your mentor has not set any cases yet. Check back shortly."}
            </p>
            {isMentor ? (
              <Link href="/scenario" className="btn-editorial btn-editorial--accent mt-5 inline-flex">
                Create a case
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="space-y-6">
            {byTier.map((tier) => {
              const meta = difficultyMeta[tier.difficulty];

              return (
                // The heading is inside the reveal group with its own cards.
                // Left outside, it rendered immediately above a section that
                // was still hidden — a title over blank space.
                <RevealGroup as="section" key={tier.difficulty} stagger={0.05}>
                  <RevealItem>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2 className="display-sm">{meta.label}</h2>
                      <p className="text-xs text-[var(--color-ink-soft)]">{meta.blurb}</p>
                    </div>
                  </RevealItem>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {tier.entries.map((entry) => (
                      <RevealItem key={entry.id}>
                        <article className="card-hover flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`eyebrow eyebrow-tight inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 ${meta.chip}`}
                            >
                              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                              {meta.label}
                            </span>
                            {entry.category ? (
                              <MetricChip label={entry.category} tone="slate" />
                            ) : null}
                          </div>

                          <h3 className="display-sm mt-3">{entry.title}</h3>
                          <p className="mt-2 flex-1 text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
                            {entry.summary}
                          </p>

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleStart(entry)}
                              className="btn-editorial btn-editorial--accent"
                            >
                              {isMentor ? "Test run" : "Start case"}
                            </button>
                            {isMentor ? (
                              <button
                                type="button"
                                onClick={() => void handleRemove(entry)}
                                disabled={removingId === entry.id}
                                className="link-editorial text-xs font-medium text-[var(--color-danger)] disabled:opacity-50"
                              >
                                {removingId === entry.id ? "Removing..." : "Remove"}
                              </button>
                            ) : null}
                          </div>
                        </article>
                      </RevealItem>
                    ))}
                  </div>
                </RevealGroup>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
