"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/languageStore";
import { useT } from "@/lib/i18n/strings";
import type { GroupMember } from "@/types/group";
import { languageDateLocale, type AppLanguage } from "@/types/language";

function formatJoined(iso: string, language: AppLanguage): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(languageDateLocale[language], {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

export function MemberList({
  members,
  onRemove,
  removingUid,
}: {
  members: GroupMember[];
  onRemove?: (member: GroupMember) => void;
  removingUid?: string | null;
}) {
  const t = useT();
  const language = useLanguage();

  if (members.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] p-6 text-center">
        <p className="text-sm font-medium text-[var(--color-ink)]">{t("members.emptyTitle")}</p>
        <p className="mt-1.5 text-xs leading-5 text-[var(--color-ink-soft)]">
          {t("members.emptyBody")}
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      {members.map((member) => (
        <li key={member.uid} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            {/* Only the name is a link, not the whole row — Remove sits in the
                same row and nesting it inside a link would be a trap. */}
            <Link
              href={`/mentor/trainee/${member.uid}`}
              className="link-editorial block truncate text-sm font-medium text-[var(--color-ink)] transition-colors hover:text-[var(--color-primary)]"
            >
              {member.displayName || member.email}
            </Link>
            <p className="truncate text-xs text-[var(--color-ink-soft)]">
              {t("members.joined", {
                email: member.email,
                date: formatJoined(member.joinedAt, language),
              })}
            </p>
          </div>

          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(member)}
              disabled={removingUid === member.uid}
              className="link-editorial shrink-0 text-xs font-medium text-[var(--color-danger)] disabled:opacity-50"
            >
              {removingUid === member.uid ? t("common.removing") : t("common.remove")}
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
