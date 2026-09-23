"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/strings";
import {
  dismissLanguageHint,
  setLanguage,
  useLanguage,
  useLanguageHintVisible,
} from "@/lib/i18n/languageStore";
import {
  APP_LANGUAGES,
  languageInvite,
  languageLabel,
  otherLanguage,
} from "@/types/language";

/**
 * Icon-only on purpose. The header already fits the logo, six nav links, the
 * group switcher and the account chip into a 1152px column with under 60px to
 * spare, and a labelled control would push that onto a second row.
 *
 * Because an icon alone is easy to miss, first-time visitors also get a
 * callout anchored under it (see `LanguageHint`) instead of a wider button.
 */
function GlobeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-4 w-4"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
    </svg>
  );
}

/**
 * "This site is also in Hindi", shown once per browser under the toggle.
 *
 * The headline and the button are written in the language being offered, not
 * the one on screen: the person this is for may not read the current one. The
 * smaller line under it is in the current language, for everyone else.
 */
function LanguageHint() {
  const language = useLanguage();
  const t = useT();
  const target = otherLanguage(language);
  const invite = languageInvite[target];

  return (
    <div
      role="note"
      lang={target}
      className="absolute right-0 top-full z-30 mt-2 w-64 rounded-[var(--radius-lg)] border border-[var(--color-primary)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-lift)]"
    >
      {/* The pointer back up at the globe, so it is clear what the callout is about. */}
      <span
        aria-hidden
        className="absolute -top-[7px] right-3 h-3 w-3 rotate-45 border-l border-t border-[var(--color-primary)] bg-[var(--color-surface)]"
      />
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-5 text-[var(--color-ink)]">{invite.headline}</p>
        <button
          type="button"
          onClick={dismissLanguageHint}
          aria-label={t("common.close")}
          className="-mr-1 -mt-1 px-1.5 text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]"
        >
          &times;
        </button>
      </div>
      <p lang={language} className="mt-1 text-xs leading-5 text-[var(--color-ink-soft)]">
        {t("language.hintBody", { language: languageLabel[target] })}
      </p>
      <button
        type="button"
        onClick={() => setLanguage(target)}
        className="btn-editorial btn-editorial--accent mt-3 min-h-8 w-full justify-center px-3 py-1"
      >
        {invite.action}
      </button>
    </div>
  );
}

export function LanguageToggle() {
  const language = useLanguage();
  const t = useT();
  const hintVisible = useLanguageHintVisible();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          // Opening the menu means they have found the switcher, which is all
          // the callout was for.
          if (hintVisible) {
            dismissLanguageHint();
          }
          setOpen((current) => !current);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`${t("language.label")}: ${languageLabel[language]}`}
        className={`grid h-8 w-8 place-items-center rounded-full border bg-[var(--color-surface)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-primary)] ${
          hintVisible
            ? "border-[var(--color-primary)] text-[var(--color-primary)]"
            : "border-[var(--color-border)] text-[var(--color-ink-muted)]"
        }`}
      >
        <GlobeIcon />
      </button>

      {hintVisible && !open ? <LanguageHint /> : null}

      {open ? (
        <>
          {/* Click-away layer, matching AccountChip and GroupSwitcher. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-44 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-lift)]"
          >
            <p className="px-2 pb-2 pt-1 text-xs text-[var(--color-ink-soft)]">
              {t("language.label")}
            </p>

            {APP_LANGUAGES.map((option) => {
              const isActive = option === language;

              return (
                <button
                  key={option}
                  type="button"
                  role="menuitem"
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => {
                    setLanguage(option);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--color-canvas-soft)] ${
                    isActive
                      ? "bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary-ink)]"
                      : "text-[var(--color-ink)]"
                  }`}
                >
                  {/* Fixed-width tick slot keeps the two labels aligned. */}
                  <span className="grid h-3.5 w-3.5 shrink-0 place-items-center">
                    {isActive ? (
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
                    ) : null}
                  </span>
                  {languageLabel[option]}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * A plain inline switch for the home page, which has room the header does not.
 * Unlike the callout it never goes away: it is where someone who dismissed the
 * callout, or never saw it, can still find the other language.
 */
export function LanguageInviteLink({ className = "" }: { className?: string }) {
  const language = useLanguage();
  const target = otherLanguage(language);

  return (
    <button
      type="button"
      lang={target}
      onClick={() => setLanguage(target)}
      className={`link-editorial inline-flex items-center gap-1.5 font-medium text-[var(--color-primary)] ${className}`}
    >
      <GlobeIcon />
      {languageInvite[target].action}
    </button>
  );
}
