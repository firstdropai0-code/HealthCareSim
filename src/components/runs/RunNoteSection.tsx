"use client";

import { useEffect, useRef, useState } from "react";
import { LoadingButton } from "@/components/common/LoadingButton";
import { useAuth } from "@/lib/firebase/useAuth";
import { useLanguage } from "@/lib/i18n/languageStore";
import { useT } from "@/lib/i18n/strings";
import { deleteRunNote, getRunNote, saveRunNote } from "@/lib/runs/runNoteRepository";
import { languageDateLocale, type AppLanguage } from "@/types/language";
import type { RunSummary } from "@/types/run";
import { RUN_NOTE_MAX_LENGTH, type RunNote } from "@/types/runNote";
import type { RunViewer } from "./RunDetail";

function formatDate(iso: string, language: AppLanguage): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(languageDateLocale[language], {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

/**
 * The mentor's note on a run: an editor for the mentor, a read-only card for
 * the trainee it is addressed to.
 *
 * This is the one place a person, rather than the model, says something about
 * a run. It sits above the report so the trainee meets their mentor's reading
 * before the AI's, and it is kept out of the report itself: the score and the
 * deck stay exactly what the trainee was shown when the run ended.
 *
 * Loads on its own rather than alongside the run, so a note that cannot be read
 * never costs anyone the report underneath it.
 *
 * `compact` is the same editor without the card around it, for a mentor writing
 * from a list of sessions instead of from the run's own page. It is one
 * component rather than two so the list and the page cannot disagree about what
 * saving a note does. `onNoteChange` lets that list keep its own "note left"
 * marker in step without refetching.
 */
export function RunNoteSection({
  run,
  viewer,
  compact = false,
  onNoteChange,
}: {
  run: RunSummary;
  viewer: RunViewer;
  compact?: boolean;
  onNoteChange?: (note: RunNote | null) => void;
}) {
  const t = useT();
  const language = useLanguage();
  // For the load effect, which must not refetch when only the language changes.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const { profile } = useAuth();

  const [note, setNote] = useState<RunNote | null>(null);
  const [draft, setDraft] = useState("");
  // Which run the note above belongs to, so moving between runs never shows
  // one trainee's note, or a half-typed draft, on another's page.
  const [loadedRunId, setLoadedRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"saving" | "removing" | null>(null);

  const loaded = loadedRunId === run.id;
  const runId = run.id;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const next = await getRunNote(runId);

        if (!cancelled) {
          setNote(next);
          setDraft(next?.text ?? "");
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setNote(null);
          setDraft("");
          /*
           * Only the mentor is told. For them a failed read matters: saving
           * over a note they could not see would look like writing a first one.
           * A trainee has nothing to act on, and an alert about a note that may
           * not even exist would sit above a report that loaded fine.
           */
          setError(viewer === "mentor" ? tRef.current("note.loadError") : null);
        }
      } finally {
        if (!cancelled) {
          setLoadedRunId(runId);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [runId, viewer]);

  if (!loaded) {
    // The compact editor opens on a click, so it owes the mentor a sign that
    // something is happening. On the run page it simply arrives with the rest.
    return compact ? (
      <p className="w-full text-xs text-[var(--color-ink-soft)]">{t("common.loading")}</p>
    ) : null;
  }

  if (viewer === "owner") {
    if (!note) {
      return null;
    }

    return (
      <section className="rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-primary)] bg-[var(--color-primary-soft)] p-5">
        <p className="eyebrow text-[var(--color-primary)]">{t("ownNote.eyebrow")}</p>
        <h2 className="display-sm mt-2">
          {t("ownNote.title", { name: note.mentorName || t("group.mentor") })}
        </h2>
        {/* pre-wrap: the mentor's own line breaks are part of what they wrote. */}
        <p className="mt-3 whitespace-pre-wrap text-[0.9375rem] leading-7 text-[var(--color-ink)]">
          {note.text}
        </p>
        <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
          {t("ownNote.when", { date: formatDate(note.updatedAt, language) })}
        </p>
      </section>
    );
  }

  const trimmed = draft.trim();
  const canSave = trimmed.length > 0 && trimmed !== (note?.text ?? "");
  const traineeName = run.userDisplayName || t("trainee.fallbackName");

  async function handleSave() {
    if (!profile) {
      return;
    }

    setBusy("saving");
    setError(null);

    try {
      const saved = await saveRunNote({ run, mentor: profile, text: draft, existing: note });
      setNote(saved);
      setDraft(saved.text);
      onNoteChange?.(saved);
    } catch {
      // The dictionary's wording, not Firestore's: the usual cause is a refused
      // write, whose own message is English and names no remedy.
      setError(t("note.saveError"));
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    setBusy("removing");
    setError(null);

    try {
      await deleteRunNote(run.id);
      setNote(null);
      setDraft("");
      onNoteChange?.(null);
    } catch {
      setError(t("note.removeError"));
    } finally {
      setBusy(null);
    }
  }

  // Unique per run: a list can have several of these open at once.
  const fieldId = `run-note-${run.id}`;

  const editor = (
    <>
      <label htmlFor={fieldId} className="sr-only">
        {t("note.label")}
      </label>
      <textarea
        id={fieldId}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={compact ? 3 : 4}
        maxLength={RUN_NOTE_MAX_LENGTH}
        placeholder={t("note.placeholder")}
        className={`${
          compact ? "mt-2" : "mt-4"
        } w-full resize-y border border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] p-4 text-sm leading-7 text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)] focus:bg-[var(--color-surface)]`}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <LoadingButton
            type="button"
            loading={busy === "saving"}
            disabled={!canSave || busy !== null}
            onClick={() => void handleSave()}
          >
            {note ? t("note.update") : t("note.save")}
          </LoadingButton>
          {note ? (
            <button
              type="button"
              onClick={() => void handleRemove()}
              disabled={busy !== null}
              className="link-editorial text-xs font-medium text-[var(--color-danger)] disabled:opacity-50"
            >
              {busy === "removing" ? t("common.removing") : t("note.remove")}
            </button>
          ) : null}
        </div>
        <p className="text-xs tabular-nums text-[var(--color-ink-soft)]">
          {note ? `${t("note.savedOn", { date: formatDate(note.updatedAt, language) })} · ` : ""}
          {draft.length} / {RUN_NOTE_MAX_LENGTH}
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-3 rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]"
        >
          {error}
        </div>
      ) : null}
    </>
  );

  if (compact) {
    return (
      <div className="w-full">
        <p className="text-xs leading-5 text-[var(--color-ink-soft)]">
          {t("note.intro", { name: traineeName })}
        </p>
        {editor}
      </div>
    );
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
      <p className="eyebrow text-[var(--color-primary)]">{t("note.eyebrow")}</p>
      <h2 className="display-sm mt-2">{t("note.title", { name: traineeName })}</h2>
      <p className="mt-1.5 max-w-3xl text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
        {t("note.intro", { name: traineeName })}
      </p>
      {editor}
    </section>
  );
}
