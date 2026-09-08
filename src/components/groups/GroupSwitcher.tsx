"use client";

import Link from "next/link";
import { useState } from "react";
import { useMentorGroups } from "@/lib/groups/MentorGroupsProvider";

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
      className="h-3.5 w-3.5"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

/**
 * Picks which of a mentor's groups they are working in. Mirrors AccountChip's
 * menu so the two controls sitting next to each other behave identically.
 */
export function GroupSwitcher() {
  const { groups, activeGroup, switchTo } = useMentorGroups();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Nothing to switch between before the first group exists — the group page
  // carries the "set one up" message, and a lone chip here would be noise.
  if (groups.length === 0) {
    return null;
  }

  async function handleSwitch(groupId: string) {
    if (groupId === activeGroup?.id) {
      setOpen(false);
      return;
    }

    setBusyId(groupId);
    setError(null);

    try {
      await switchTo(groupId);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch group.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] py-1 pl-3 pr-2.5 transition-colors hover:border-[var(--color-border-strong)]"
      >
        {/* Capped tight: this sits in a header row that has to hold the logo,
            six nav links and the account chip inside a 1152px column, and a
            long group name is what pushes that onto a second line. */}
        <span className="max-w-[8rem] truncate text-xs font-medium text-[var(--color-ink)]">
          {activeGroup?.name ?? "Choose a group"}
        </span>
        <span aria-hidden className="text-[0.625rem] text-[var(--color-ink-soft)]">
          ▾
        </span>
      </button>

      {open ? (
        <>
          {/* Click-away layer, so the menu closes without a document listener. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            /* Anchored left, unlike AccountChip's menu. This control is the
               leftmost of the pair, and on narrow screens the header wraps and
               carries it to the left edge — a right-anchored menu then opens
               off the side of the viewport. */
            className="absolute left-0 z-50 mt-2 w-60 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-lift)]"
          >
            <p className="px-2 pb-2 pt-1 text-xs text-[var(--color-ink-soft)]">
              Switch group
            </p>

            {groups.map((group) => {
              const isActive = group.id === activeGroup?.id;

              return (
                <button
                  key={group.id}
                  type="button"
                  role="menuitem"
                  aria-current={isActive ? "true" : undefined}
                  disabled={busyId !== null}
                  onClick={() => void handleSwitch(group.id)}
                  className={`flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--color-canvas-soft)] disabled:opacity-60 ${
                    isActive
                      ? "bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary-ink)]"
                      : "text-[var(--color-ink)]"
                  }`}
                >
                  {/* A tick in a fixed-width slot, so the names stay aligned
                      whether or not a row is the selected one. */}
                  <span className="grid h-3.5 w-3.5 shrink-0 place-items-center">
                    {isActive ? <CheckIcon /> : null}
                  </span>
                  <span className="truncate">{group.name}</span>
                  {busyId === group.id ? <span aria-hidden>&hellip;</span> : null}
                </button>
              );
            })}

            <div className="mt-2 border-t border-[var(--color-border)] pt-2">
              <Link
                href="/mentor/group"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block rounded-[var(--radius-sm)] px-2 py-1.5 text-sm text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-canvas-soft)]"
              >
                New group…
              </Link>
            </div>

            {error ? (
              <p role="alert" className="px-2 pt-2 text-xs text-[var(--color-danger)]">
                {error}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
