"use client";

import { useState } from "react";
import { InfoCard } from "@/components/common/VisualCards";
import { useT } from "@/lib/i18n/strings";

export function JoinCodeCard({
  code,
  onRotate,
  rotating,
}: {
  code: string;
  onRotate: () => void;
  rotating: boolean;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be blocked; the code is on screen either way.
      setCopied(false);
    }
  }

  return (
    <InfoCard label={t("joinCode.label")} title={t("joinCode.title")} tone="emerald">
      <p className="text-sm leading-6 text-[var(--color-ink-soft)]">{t("joinCode.body")}</p>

      <p className="mt-4 font-mono text-3xl font-semibold tracking-[0.3em] tabular-nums text-[var(--color-ink)]">
        {code}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => void handleCopy()} className="btn-editorial btn-editorial--solid">
          {copied ? t("joinCode.copied") : t("joinCode.copy")}
        </button>
        <button
          type="button"
          onClick={onRotate}
          disabled={rotating}
          className="btn-editorial btn-editorial--quiet"
        >
          {rotating ? t("common.working") : t("joinCode.rotate")}
        </button>
      </div>

      <p className="mt-3 text-xs leading-5 text-[var(--color-ink-soft)]">
        {t("joinCode.rotateHint")}
      </p>
    </InfoCard>
  );
}
