import Link from "next/link";
import { DropGlyph } from "@/components/common/DropGlyph";
import { SafetyNotice } from "@/components/common/SafetyNotice";
import { Section } from "@/components/editorial/Section";
import { HeroChatSnippet } from "@/components/home/HeroChatSnippet";
import { HowItWorksCta } from "@/components/home/HowItWorksCta";
import { AppShell } from "@/components/layout/AppShell";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";

const workflowSteps = [
  ["Create", "Rough note to brief", "Name the patient, the pressure point, and the skill to practice."],
  ["Practice", "Adaptive roleplay", "The AI plays the patient, family member, or nurse, turn by turn."],
  ["Review", "Scan feedback", "Scored, communication-focused coaching in seconds."],
];

const focusAreas = [
  {
    title: "Empathy",
    description: "Acknowledge emotion before explaining facts.",
    icon: (
      <path d="M12 21s-7-4.35-9.5-8.5C.5 8.5 2.5 5 6 5c2 0 3.5 1.2 4 2.5.5-1.3 2-2.5 4-2.5 3.5 0 5.5 3.5 3.5 7.5C19 16.65 12 21 12 21Z" />
    ),
  },
  {
    title: "Clarity",
    description: "Explain plans in plain, jargon-free language.",
    icon: <path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5" />,
  },
  {
    title: "Listening",
    description: "Notice both spoken and unspoken concerns.",
    icon: <path d="M4 4h16v10H8l-4 4V4Z" />,
  },
  {
    title: "Pressure handling",
    description: "Stay calm and clear when tension rises.",
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
  return (
    <AppShell>
      <div className="space-y-12">
        {/* Hero */}
        <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <RevealGroup stagger={0.08}>
            <RevealItem>
              <p className="eyebrow inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[var(--color-primary)] shadow-[var(--shadow-card)]">
                <DropGlyph />
                Healthcare communication training
              </p>
            </RevealItem>
            <RevealItem>
              <h1 className="display-xl mt-4 max-w-2xl">
                A training room for difficult conversations.
              </h1>
            </RevealItem>
            <RevealItem>
              <p className="lede mt-4 max-w-xl">
                Practice difficult healthcare conversations in a safe AI roleplay room, then get
                scored, actionable feedback in seconds.
              </p>
            </RevealItem>
            <RevealItem>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/scenario" className="btn-editorial btn-editorial--accent sheen">
                  Create a scenario
                </Link>
                <HowItWorksCta />
                <Link
                  href="/simulation"
                  className="link-editorial group text-[0.9375rem] font-medium text-[var(--color-ink-muted)]"
                >
                  Resume simulation
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
              <p className="mt-4 text-xs text-[var(--color-ink-soft)]">
                Runs in your browser. No signup needed.
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
          title="Focus areas"
          description="The four communication skills every trainee practices here."
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
                      {area.title}
                    </span>
                    <span className="mt-1 block text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
                      {area.description}
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
          title="How it works"
          description="Three steps from a rough idea to scored feedback."
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
                  <h3 className="display-sm">{title}</h3>
                </div>
                <p className="eyebrow eyebrow-tight mt-3 text-[var(--color-primary)]">{subtitle}</p>
                <p className="mt-2 text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">{body}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </Section>

        <Section
          id="start"
          index={3}
          title="Start"
          description="Name the patient, the pressure point, and the skill to practice."
        >
          <RevealGroup className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <RevealItem className="card-hover accent-edge rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
              <h3 className="display-sm">Use one rough idea</h3>
              <p className="mt-2 max-w-xl text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
                The app turns it into a structured training brief you can edit before you begin.
                Optional voice features let you dictate a response or have messages read aloud.
              </p>
              <Link href="/scenario" className="btn-editorial btn-editorial--accent sheen mt-5">
                Create your first scenario
              </Link>
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
