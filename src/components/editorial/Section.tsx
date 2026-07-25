import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";

/**
 * A numbered content section: small teal index, title, hairline rule, content.
 * Plain document flow — no viewport sizing, no scroll-triggered animation.
 */
export function Section({
  id,
  index,
  title,
  description,
  children,
  className = "",
}: {
  id: string;
  index: number;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`scroll-mt-20 ${className}`}
    >
      <Reveal>
        <div className="flex items-baseline gap-2.5">
          <span className="section-num">{String(index).padStart(2, "0")}</span>
          <h2 id={`${id}-title`} className="display-md">
            {title}
          </h2>
        </div>
        {description ? <p className="lede mt-2 max-w-2xl">{description}</p> : null}
        <hr className="rule mt-4" />
      </Reveal>

      <div className="mt-6">{children}</div>
    </section>
  );
}
