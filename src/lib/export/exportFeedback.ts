import {
  getScenarioMessages,
  resolveRespondedMessage,
} from "@/lib/feedback/betterResponses";
import { getLanguage } from "@/lib/i18n/languageStore";
import type { StringKey, Translator } from "@/lib/i18n/strings";
import { subscoreDimensions, type FeedbackReport } from "@/types/feedback";
import { languageDateLocale } from "@/types/language";
import type { SimulationState } from "@/types/simulation";

/*
 * The export is written in the reader's language, like the screen it was
 * downloaded from. The report's own content -- summary, notes, suggestions --
 * is whatever the model wrote, which is already in the scenario's language.
 */

function formatList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function formatSubscores(report: FeedbackReport, t: Translator): string {
  if (!report.subscores) {
    return "";
  }

  const lines = subscoreDimensions
    .map((dimension) => `- ${t(`subscore.${dimension}`)}: ${report.subscores?.[dimension]}/10`)
    .join("\n");

  return `\n${t("export.byDimension")}\n${lines}\n`;
}

function speakerLabel(speaker: string | undefined, t: Translator): string {
  return t(`speaker.${speaker || "narrator"}` as StringKey).toUpperCase();
}

/**
 * Each suggestion is written under the line it answers, so the exported file
 * carries the same pairing the report shows on screen.
 */
function formatBetterResponses(
  state: SimulationState,
  report: FeedbackReport,
  t: Translator,
): string {
  const scenarioMessages = getScenarioMessages(state);

  return report.betterResponses
    .map((entry) => {
      const responded = resolveRespondedMessage(entry, scenarioMessages);

      if (!responded) {
        return `- "${entry.suggestion}"`;
      }

      const speaker = speakerLabel(responded.speaker, t);

      return `- ${t("export.whenSaid", { speaker })}: "${responded.content}"\n  ${t("export.couldHaveSaid")}: "${entry.suggestion}"`;
    })
    .join("\n\n");
}

function formatRoleLabel(message: SimulationState["messages"][number], t: Translator): string {
  if (message.role === "scenario" && message.speaker) {
    return speakerLabel(message.speaker, t);
  }

  return t(`role.${message.role}` as StringKey).toUpperCase();
}

export function buildFeedbackExportText(
  state: SimulationState,
  report: FeedbackReport,
  t: Translator,
): string {
  const conversationLog = state.messages
    .map((message) => `[${formatRoleLabel(message, t)}] ${message.content}`)
    .join("\n\n");
  const generated = new Date().toLocaleString(languageDateLocale[getLanguage()]);

  return `${t("export.title")}

${t("export.scenario")}: ${state.scenario.title}
${t("export.generated")}: ${generated}${report.source === "fallback" ? `\n${t("export.source")}: ${t("feedback.fallback")}` : ""}

${t("export.log")}
${conversationLog}

${t("export.overall")}
${report.overallScore}/10
${formatSubscores(report, t)}
${t("export.summary")}
${report.summary}

${t("export.wentWell")}
${formatList(report.whatWentWell)}

${t("export.couldImprove")}
${formatList(report.whatCouldImprove)}

${t("export.gaps")}
${formatList(report.communicationGaps)}

${t("export.better")}
${formatBetterResponses(state, report, t)}
${
  report.deliveryFeedback && report.deliveryFeedback.length > 0
    ? `\n${t("export.delivery")}\n${formatList(report.deliveryFeedback)}\n`
    : ""
}${
  report.customCriteriaFeedback && report.customCriteriaFeedback.length > 0
    ? `\n${t("export.criteria")}\n${report.customCriteriaFeedback
        .map((item) => `- ${item.criterion}: ${item.assessment}`)
        .join("\n")}\n`
    : ""
}
${t("export.finalAdvice")}
${report.finalAdvice}
`;
}

export function exportFeedback(
  state: SimulationState,
  report: FeedbackReport,
  t: Translator,
): void {
  const text = buildFeedbackExportText(state, report, t);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  // A Devanagari title slugs to nothing under an ASCII pattern, which named
  // every Hindi export "-feedback.txt"; fall back to a fixed stem instead.
  const slug = state.scenario.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
  anchor.download = `${slug || "firstdrop"}-feedback.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}
