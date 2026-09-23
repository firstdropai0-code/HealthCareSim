"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { MetricChip } from "@/components/common/VisualCards";
import { AppShell } from "@/components/layout/AppShell";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { listGroupCases, removeCase } from "@/lib/cases/caseRepository";
import { useRequireBackend } from "@/lib/firebase/useAuth";
import { useLanguage } from "@/lib/i18n/languageStore";
import { categoryLabel, useT, type StringKey } from "@/lib/i18n/strings";
import { languageLabel, type AppLanguage } from "@/types/language";
import { useMentorGroups } from "@/lib/groups/MentorGroupsProvider";
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
  const { groups, activeGroup, loading: groupsLoading } = useMentorGroups();
  const t = useT();
  const language = useLanguage();
  // The effect below runs outside render, so it needs a stable handle rather
  // than the render-time `t`; adding `t` to its deps would refetch on every
  // language change for no reason.
  const tRef = useRef(t);
  // Assigned in an effect rather than during render: refs may not be written
  // while rendering. The fetch effect needs the current translator without listing `t` as a dependency, which would refetch on every language change.
  useEffect(() => {
    tRef.current = t;
  });

  const [cases, setCases] = useState<AssignedCase[]>([]);
  const [loadedGroupId, setLoadedGroupId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tracks which group the list belongs to, not just that a fetch finished: a
  // mentor switching groups must not see the previous group's cases.
  const loaded = groupId ? loadedGroupId === groupId : !(isMentor && groupsLoading);

  /*
   * For a mentor this means "owns nothing to publish to", NOT "has no active
   * group" — one of several groups is always active, and a mentor with three
   * must never be told to create their first. A trainee belongs to exactly one,
   * so the profile pointer answers it directly for them.
   */
  const noGroup = isMentor ? groups.length === 0 && !groupsLoading : !groupId;

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
          // Cleared here rather than up front: a failure on the previous group
          // must not stay on screen once a different one has loaded cleanly.
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : tRef.current("cases.loadError"));
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

  /*
   * Only cases written in the language being read are offered.
   *
   * A case is an exercise in a specific language: its roleplay, its read-aloud
   * voice and its feedback all run in the language it was authored in, so
   * listing a Hindi case to someone reading English would hand them a run they
   * cannot follow. Cases saved before language existed are English.
   */
  const inLanguage = useMemo(
    () => cases.filter((entry) => (entry.scenario.language ?? "en") === language),
    [cases, language],
  );
  const hiddenCount = cases.length - inLanguage.length;
  // Both dictionaries inflect at one, so the count picks the key.
  const plural = hiddenCount === 1 ? "one" : "other";
  const otherLanguage: AppLanguage = language === "en" ? "hi" : "en";

  // Grouped by tier so the list reads the same way the case library does.
  const byTier = useMemo(
    () =>
      difficultyOrder
        .map((difficulty) => ({
          difficulty,
          entries: inLanguage.filter((entry) => entry.difficulty === difficulty),
        }))
        .filter((tier) => tier.entries.length > 0),
    [inLanguage],
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
      setError(err instanceof Error ? err.message : t("mentorCases.removeError"));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <Reveal className="accent-edge rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <p className="eyebrow text-[var(--color-primary)]">
            {isMentor ? t("mentorCases.eyebrow") : t("cases.eyebrow")}
          </p>
          <h1 className="display-md mt-2">
            {isMentor
              ? t("mentorCases.title", {
                  group: activeGroup ? activeGroup.name : t("dash.yourGroup"),
                })
              : t("cases.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
            {isMentor
              ? t("mentorCases.intro")
              : t("cases.intro")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Sits above the loading branch, so it has to be gated too. */}
            <MetricChip label={isMentor ? t("mentorCases.count") : t("cases.count")} value={loaded ? String(inLanguage.length) : "—"} tone="emerald" />
            {isMentor ? (
              <Link href="/scenario" className="btn-editorial btn-editorial--accent min-h-8 px-3 py-1 text-xs">
                {t("mentorCases.create")}
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

        {noGroup ? (
          <div className="rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-warning)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm">
            {isMentor ? (
              <>
                {t("mentorCases.noGroup")}{" "}
                <Link href="/mentor/group" className="font-semibold underline">
                  {t("mentorCases.setUp")}
                </Link>
                .
              </>
            ) : (
              <>
                {t("cases.noGroup")}{" "}
                <Link href="/join" className="font-semibold underline">
                  {t("cases.enterCode")}
                </Link>
                .
              </>
            )}
          </div>
        ) : !loaded ? (
          <p className="text-sm text-[var(--color-ink-soft)]">{t("cases.loading")}</p>
        ) : inLanguage.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] p-8 text-center">
            <p className="text-sm font-medium text-[var(--color-ink)]">
              {hiddenCount > 0
                ? t("cases.noneInLanguage", { language: languageLabel[language] })
                : t("cases.emptyTitle")}
            </p>
            <p className="mt-1.5 text-xs leading-5 text-[var(--color-ink-soft)]">
              {hiddenCount > 0
                ? t(`cases.othersInLanguage.${plural}` as StringKey, {
                    count: hiddenCount,
                    other: languageLabel[otherLanguage],
                  })
                : isMentor
                  ? t("mentorCases.emptyBody", {
                      group: activeGroup ? activeGroup.name : t("dash.yourGroup"),
                    })
                  : t("cases.emptyBody")}
            </p>
            {isMentor ? (
              <Link href="/scenario" className="btn-editorial btn-editorial--accent mt-5 inline-flex">
                {t("mentorCases.create")}
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Only when something is actually withheld. A standing note about
                language filtering on every visit would be noise; a count of
                what is missing, when some is missing, is information. */}
            {hiddenCount > 0 ? (
              <p className="text-xs leading-5 text-[var(--color-ink-soft)]">
                {t(`cases.hiddenByLanguage.${plural}` as StringKey, {
                  count: hiddenCount,
                  other: languageLabel[otherLanguage],
                  language: languageLabel[language],
                })}
              </p>
            ) : null}

            {byTier.map((tier) => {
              const meta = difficultyMeta[tier.difficulty];

              return (
                // The heading is inside the reveal group with its own cards.
                // Left outside, it rendered immediately above a section that
                // was still hidden — a title over blank space.
                <RevealGroup as="section" key={tier.difficulty} stagger={0.05}>
                  <RevealItem>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2 className="display-sm">{t(`difficulty.${tier.difficulty}`)}</h2>
                      <p className="text-xs text-[var(--color-ink-soft)]">
                        {t(`difficultyBlurb.${tier.difficulty}`)}
                      </p>
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
                              {t(`difficulty.${tier.difficulty}`)}
                            </span>
                            {entry.category ? (
                              <MetricChip label={categoryLabel(t, entry.category)} tone="slate" />
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
                              {isMentor ? t("mentorCases.testRun") : t("join.startCase")}
                            </button>
                            {isMentor ? (
                              <button
                                type="button"
                                onClick={() => void handleRemove(entry)}
                                disabled={removingId === entry.id}
                                className="link-editorial text-xs font-medium text-[var(--color-danger)] disabled:opacity-50"
                              >
                                {removingId === entry.id ? t("common.removing") : t("common.remove")}
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
