"use client";

import Link from "next/link";
import { DropGlyph } from "@/components/common/DropGlyph";
import { SafetyNotice } from "@/components/common/SafetyNotice";
import { Section } from "@/components/editorial/Section";
import { HeroChatSnippet } from "@/components/home/HeroChatSnippet";
import { HowItWorksCta } from "@/components/home/HowItWorksCta";
import { PrimaryCta } from "@/components/home/PrimaryCta";
import { AppShell } from "@/components/layout/AppShell";
import { LanguageInviteLink } from "@/components/layout/LanguageToggle";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { useT, type StringKey } from "@/lib/i18n/strings";

/*
 * A client component, unlike most landing pages: its copy follows the reader's
 * language, which lives in localStorage and so is only known in the browser.
 * The server still prerenders the English, and the swap happens on hydration.
 */
const workflowSteps: [StringKey, StringKey, StringKey][] = [
  ["home.step.create", "home.step.createSub", "home.step.createBody"],
  ["home.step.practice", "home.step.practiceSub", "home.step.practiceBody"],
  ["home.step.review", "home.step.reviewSub", "home.step.reviewBody"],
];

const focusAreas: { title: StringKey; description: StringKey; icon: React.ReactNode }[] = [
  {
    title: "home.focus.empathy",
    description: "home.focus.empathyBody",
    icon: (
      <path d="M12 21s-7-4.35-9.5-8.5C.5 8.5 2.5 5 6 5c2 0 3.5 1.2 4 2.5.5-1.3 2-2.5 4-2.5 3.5 0 5.5 3.5 3.5 7.5C19 16.65 12 21 12 21Z" />
    ),
  },
  {
    title: "home.focus.clarity",
    description: "home.focus.clarityBody",
    icon: <path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5" />,
  },
  {
    title: "home.focus.listening",
    description: "home.focus.listeningBody",
    icon: <path d="M4 4h16v10H8l-4 4V4Z" />,
  },
  {
    title: "home.focus.pressure",
    description: "home.focus.pressureBody",
    icon: (
      <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
    ),
  },
];

function FocusIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      {children}
    </svg>
  );
}

export default function Home() {
  const t = useT();

  return (
    <AppShell>
      <div className="space-y-12">
        {/* Hero */}
        <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <RevealGroup stagger={0.08}>
            <RevealItem>
              <p className="eyebrow inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[var(--color-primary)] shadow-[var(--shadow-card)]">
                <DropGlyph />
                {t("home.eyebrow")}
              </p>
            </RevealItem>
            <RevealItem>
              <h1 className="display-xl mt-4 max-w-2xl">
                {t("home.title")}
              </h1>
            </RevealItem>
            <RevealItem>
              <p className="lede mt-4 max-w-xl">
                {t("home.lede")}
              </p>
            </RevealItem>
            <RevealItem>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <PrimaryCta defaultLabel={t("home.createScenario")} className="sheen" />
                <HowItWorksCta />
                <Link
                  href="/simulation"
                  className="link-editorial group text-[0.9375rem] font-medium text-[var(--color-ink-muted)]"
                >
                  {t("home.resume")}
                  <span
                    aria-hidden
                    className="transition-transform duration-300 ease-[cubic-bezier(0.215,0.61,0.355,1)] group-hover:translate-x-1"
                  >
                    &rarr;
                  </span>
                </Link>
              </div>
            </RevealItem>
            <RevealItem>
              <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-ink-soft)]">
                <span>{t("home.noSignup")}</span>
                {/* Permanent, unlike the header callout: the one place someone
                    who closed that, or never saw it, can still find it. */}
                <LanguageInviteLink />
              </p>
            </RevealItem>
          </RevealGroup>

          <Reveal delay={0.15} className="hidden lg:block">
            <HeroChatSnippet />
          </Reveal>
        </section>

        <Section
          id="focus"
          index={1}
          title={t("home.focusTitle")}
          description={t("home.focusDescription")}
        >
          <RevealGroup as="ul" className="grid gap-3 sm:grid-cols-2">
            {focusAreas.map((area) => (
              <RevealItem as="li" key={area.title}>
                <Link
                  href="/scenario"
                  className="card-hover group flex h-full items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]"
                >
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--color-primary-soft)] text-[var(--color-primary)] transition-all duration-[350ms] ease-[cubic-bezier(0.215,0.61,0.355,1)] group-hover:scale-110 group-hover:bg-[var(--color-primary)] group-hover:text-white">
                    <FocusIcon>{area.icon}</FocusIcon>
                  </span>
                  <span className="min-w-0">
                    <span className="display-sm block transition-colors duration-300 group-hover:text-[var(--color-primary)]">
                      {t(area.title)}
                    </span>
                    <span className="mt-1 block text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
                      {t(area.description)}
                    </span>
                  </span>
                </Link>
              </RevealItem>
            ))}
          </RevealGroup>
        </Section>

        <Section
          id="process"
          index={2}
          title={t("home.processTitle")}
          description={t("home.processDescription")}
        >
          <RevealGroup as="ol" stagger={0.09} className="grid gap-3 sm:grid-cols-3">
            {workflowSteps.map(([title, subtitle, body], index) => (
              <RevealItem
                as="li"
                key={title}
                className="card-hover accent-edge group rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[0.8125rem] font-semibold text-[var(--color-primary-ink)] transition-all duration-[350ms] ease-[cubic-bezier(0.215,0.61,0.355,1)] group-hover:bg-[var(--color-primary)] group-hover:text-white">
                    {index + 1}
                  </span>
                  <h3 className="display-sm">{t(title)}</h3>
                </div>
                <p className="eyebrow eyebrow-tight mt-3 text-[var(--color-primary)]">{t(subtitle)}</p>
                <p className="mt-2 text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">{t(body)}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </Section>

        <Section
          id="start"
          index={3}
          title={t("home.startTitle")}
          description={t("home.startDescription")}
        >
          <RevealGroup className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <RevealItem className="card-hover accent-edge rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
              <h3 className="display-sm">{t("home.oneIdea")}</h3>
              <p className="mt-2 max-w-xl text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
                {t("home.oneIdeaBody")}
              </p>
              <PrimaryCta defaultLabel={t("home.createFirst")} className="sheen mt-5" />
            </RevealItem>

            <RevealItem>
              <SafetyNotice />
            </RevealItem>
          </RevealGroup>
        </Section>
      </div>
    </AppShell>
  );
}
