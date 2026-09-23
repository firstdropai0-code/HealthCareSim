"use client";

import { InfoCard, ScoreCard } from "@/components/common/VisualCards";
import { useT } from "@/lib/i18n/strings";

/**
 * `ScoreCard` clamps to a minimum of 1, so feeding it a null average would
 * render a confident red "1 / 10" for someone who simply has no scored cases
 * yet. This shows the empty state instead.
 */
export function AverageScoreCard({
  average,
  emptyHint,
}: {
  average: number | null;
  emptyHint: string;
}) {
  const t = useT();

  if (average === null) {
    return (
      <InfoCard label={t("common.score")} title={t("average.noneTitle")} tone="slate">
        <p className="text-[0.9375rem] leading-6">{emptyHint}</p>
      </InfoCard>
    );
  }

  // Not rounded: a mean of 4.5 shown as "5" contradicts the per-dimension
  // figures on the same page, and flatters the trainee by half a point.
  return <ScoreCard score={average} label={t("average.label")} decimals={1} />;
}
