"use client";

import { Fragment, createElement, useMemo, type ReactNode } from "react";

import { getLanguage, useLanguage } from "./languageStore";
import * as auth from "./copy/auth";
import * as common from "./copy/common";
import * as marketing from "./copy/marketing";
import * as mentor from "./copy/mentor";
import * as progress from "./copy/progress";
import * as run from "./copy/run";
import * as scenario from "./copy/scenario";
import type { AppLanguage } from "@/types/language";

/**
 * All UI copy, English and Hindi.
 *
 * Flat dotted keys rather than nested objects, so a string can be moved between
 * screens without restructuring both dictionaries. `StringKey` is derived from
 * the English copy, and every Hindi dictionary is typed against its English
 * twin, which makes a missing or misspelt Hindi key a type error rather than a
 * silent fallback to a key name on screen.
 *
 * The core run-flow and navigation strings below came first; each area added
 * since keeps its own pair of dictionaries under `./copy/`, so a translator
 * reviewing, say, the mentor dashboard reads one file.
 *
 * Deliberately NOT translated: anything a person typed (group names, trainee
 * names, scenario text a mentor edited), anything the model wrote (it already
 * writes in the scenario's language), and stored values such as a track's
 * `category`, which the skill tree matches on.
 */
const coreEn = {
  "nav.howItWorks": "How It Works",
  "nav.myCases": "My Cases",
  "nav.cases": "Cases",
  "nav.simulation": "Simulation",
  "nav.feedback": "Feedback",
  "nav.myProgress": "My Progress",
  "nav.myGroup": "My Group",
  "nav.joinAGroup": "Join a group",
  "nav.create": "Create",
  "nav.scenario": "Scenario",
  "nav.groups": "Groups",
  "nav.dashboard": "Dashboard",

  "language.label": "Language",

  "cases.eyebrow": "My cases",
  "cases.title": "Cases set by your mentor.",
  "cases.intro":
    "Pick one to start. Each attempt is recorded separately, so you can run the same case again as you improve.",
  "cases.count": "Cases",
  "cases.loading": "Loading cases...",
  "cases.emptyTitle": "No cases yet.",
  "cases.emptyBody": "Your mentor has not set any cases yet. Check back shortly.",
  "cases.loadError": "Could not load your cases.",
  "cases.noGroup": "You are not in a group yet, so no cases have been set for you.",
  "cases.enterCode": "Enter a join code",
  /*
   * The empty state has to distinguish "your mentor has set nothing" from
   * "everything here is in the other language". They look identical on screen
   * and have completely different fixes, so the count of hidden cases is part
   * of the message rather than a detail left for someone to guess at.
   */
  "cases.noneInLanguage": "No cases in {language} yet.",
  /*
   * Split by count because both languages inflect: English on the noun, Hindi
   * on the verb ("तय किया है" against "तय किए हैं"). One template with a
   * substituted number reads as broken grammar to a native speaker at n=1.
   */
  "cases.othersInLanguage.one":
    "Your mentor has set 1 case in {other}. Cases are shown in the language they were written in — switch language in the header to see it.",
  "cases.othersInLanguage.other":
    "Your mentor has set {count} cases in {other}. Cases are shown in the language they were written in — switch language in the header to see them.",
  "cases.hiddenByLanguage.one":
    "1 more case in {other}, hidden because you are reading in {language}.",
  "cases.hiddenByLanguage.other":
    "{count} more cases in {other}, hidden because you are reading in {language}.",

  "simulation.room": "Simulation room",
  "simulation.live": "Live roleplay",
  "simulation.history": "Conversation history",
  "simulation.placeholder": "Type what the trainee says or does next.",
  "simulation.whatDoYouSay": "What do you say?",
  "simulation.completed": "Simulation completed",
  "simulation.wrapUp": "Wrap up when ready",
  "simulation.openReport": "Open the feedback report for this roleplay.",
  "simulation.none": "No active simulation",
  "simulation.audioError": "Could not play audio.",
  "simulation.turnError": "Unable to continue simulation.",
  "simulation.setting": "Setting",
  "simulation.speaker": "Speaker",
  "simulation.patient": "Patient",
  "simulation.turnsUsed": "Turns used",
  "simulation.autoRead": "Auto-read new messages",
  "simulation.yourResponse": "Your next response",
  "simulation.send": "Send Response",
  "simulation.session": "Session",
  "simulation.end": "End Simulation",
  "simulation.finish": "Finish & Generate Feedback",
  "simulation.situation": "Situation",
  "simulation.goal": "Goal",
  "simulation.challenge": "Challenge",
  "simulation.messages": "Messages",
  "simulation.pacedFor": "Paced for about {n}; ends when the conversation resolves.",
  "simulation.tension": "{level} tension",
  "tension.low": "Low",
  "tension.medium": "Medium",
  "tension.high": "High",
  "simulation.audioDisclaimer":
    "Read-aloud audio is AI-generated and speaks only the words shown in the conversation. Delivery — pace, breath, emotion — is directed separately and is not part of what is said.",

  // Speaker and role names are keyed by their union member, so a lookup can be
  // built from `message.speaker` without a second mapping table per surface.
  "speaker.patient": "Patient",
  "speaker.family_member": "Family member",
  "speaker.nurse": "Nurse",
  "speaker.bystander": "Bystander",
  "speaker.narrator": "Narrator",
  "role.system": "System",
  "role.scenario": "Scenario",
  "role.trainee": "Trainee",
  "role.feedback": "Feedback",

  "feedback.title": "Feedback report",
  "feedback.generating": "Generating AI feedback",
  "feedback.sections": "Report sections",
  "feedback.improveNext": "Improve next",
  "feedback.practice": "Practice responses",
  "feedback.saving": "Saving to your record",
  "feedback.saved": "Saved to your record",
  "feedback.none": "No simulation to review",
  "feedback.error": "Unable to generate feedback.",
  "report.summary": "Summary",
  "report.quickRead": "Quick read",
  "report.strength": "Strength",
  "report.whatWorked": "What worked",
  "report.improve": "Improve",
  "report.nextFocus": "Next focus",
  "report.dimensions": "Dimensions",
  "report.fiveSkills": "Five communication skills",
  "report.delivery": "Delivery",
  "report.howYouSounded": "How you sounded",
  "report.example": "Example",
  "report.linesYouCouldHaveUsed": "Lines you could have used",
  "report.finalAdvice": "Final advice",
  "report.carryForward": "Carry forward",
  "report.readingThis": "Reading this",
  "report.whatItMeans": "What it means",
  "report.watchGaps": "Watch gaps",
  "report.whatWentWell": "What went well",
  "report.improveNextTime": "Improve next time",
  "report.customCriteria": "Custom criteria",
  "report.yourAddedCriteria": "Your added evaluation criteria",
  "report.pages": "Feedback report pages",
  "report.coach": "FirstDrop Coach",
  "report.atAGlance": "At a glance",
  "report.howItWent": "How it went",
  "feedback.setting": "Setting",
  "feedback.endedIn": "Ended in",
  "feedback.goal": "Goal",
  "feedback.scopeNote": "Feedback is limited to communication behaviors and training performance.",

  "progress.title": "My progress",
  "progress.subtitle": "Where your communication is going.",
  "progress.scoredCases": "Scored cases",
  "progress.loading": "Loading your progress...",
  "progress.emptyTitle": "No cases yet.",
  "progress.unscored":
    "Your cases ran, but none could be scored. Finish one while the simulator is available to start tracking.",
  "progress.skillBalance": "Skill balance",
  "progress.skillTree": "Skill tree",
  "progress.recentSessions": "Recent sessions",
  "progress.loadError": "Could not load your progress.",

  "join.title": "Join a group",
  "join.enterCode": "Enter your mentor's code.",
  "join.inAGroup": "You are in a group",
  "join.yourGroup": "Your training group",
  "join.sharedWithMentor": "Completed cases are shared with your mentor.",
  "join.startCase": "Start a case",
  "join.myProgress": "My progress",
  "join.leave": "Leave this group",
  "join.codeError": "That code did not work.",
  "join.leaveError": "Could not leave that group.",
  "join.joinError": "Could not join that group.",

  /*
   * Shared vocabulary, looked up by union member. The maps next to the data
   * (difficultyMeta, scoreBandMeta) keep only the styling and ordering; the
   * wording lives here and nowhere else, so the two languages cannot drift
   * from a third English copy.
   */
  "difficulty.foundational": "Foundational",
  "difficulty.intermediate": "Intermediate",
  "difficulty.advanced": "Advanced",
  "difficultyBlurb.foundational": "Clear task, cooperative counterpart.",
  "difficultyBlurb.intermediate": "Conflict, blame, or an anxious family to steady.",
  "difficultyBlurb.advanced": "Death, safeguarding, or hostility under pressure.",
  "subscore.empathy": "Empathy",
  "subscore.clarity": "Clarity",
  "subscore.structure": "Structure & next steps",
  "subscore.professionalism": "Professionalism",
  "subscore.deEscalation": "Pressure & de-escalation",
  "band.strong": "Strong",
  "band.developing": "Developing",
  "band.needsFocus": "Needs focus",
  "role.mentor": "Mentor",
  "role.traineeRole": "Trainee",
} as const;

type CoreKey = keyof typeof coreEn;

const coreHi: Record<CoreKey, string> = {
  "nav.howItWorks": "यह कैसे काम करता है",
  "nav.myCases": "मेरे केस",
  "nav.cases": "केस",
  "nav.simulation": "सिमुलेशन",
  "nav.feedback": "फ़ीडबैक",
  "nav.myProgress": "मेरी प्रगति",
  "nav.myGroup": "मेरा ग्रुप",
  "nav.joinAGroup": "ग्रुप जॉइन करें",
  "nav.create": "बनाएँ",
  "nav.scenario": "परिदृश्य",
  "nav.groups": "ग्रुप",
  "nav.dashboard": "डैशबोर्ड",

  "language.label": "भाषा",

  "cases.eyebrow": "मेरे केस",
  "cases.title": "आपके मेंटर द्वारा तय किए गए केस।",
  "cases.intro":
    "शुरू करने के लिए कोई एक चुनें। हर प्रयास अलग से दर्ज होता है, इसलिए बेहतर होते जाने पर आप वही केस दोबारा कर सकते हैं।",
  "cases.count": "केस",
  "cases.loading": "केस लोड हो रहे हैं...",
  "cases.emptyTitle": "अभी कोई केस नहीं।",
  "cases.emptyBody": "आपके मेंटर ने अभी कोई केस तय नहीं किया है। थोड़ी देर बाद देखें।",
  "cases.loadError": "आपके केस लोड नहीं हो सके।",
  "cases.noGroup": "आप अभी किसी ग्रुप में नहीं हैं, इसलिए आपके लिए कोई केस तय नहीं हुआ है।",
  "cases.enterCode": "जॉइन कोड डालें",
  "cases.noneInLanguage": "{language} में अभी कोई केस नहीं।",
  "cases.othersInLanguage.one":
    "आपके मेंटर ने {other} में 1 केस तय किया है। केस उसी भाषा में दिखते हैं जिसमें वे लिखे गए थे — उसे देखने के लिए ऊपर भाषा बदलें।",
  "cases.othersInLanguage.other":
    "आपके मेंटर ने {other} में {count} केस तय किए हैं। केस उसी भाषा में दिखते हैं जिसमें वे लिखे गए थे — उन्हें देखने के लिए ऊपर भाषा बदलें।",
  "cases.hiddenByLanguage.one":
    "{other} में 1 और केस है, जो {language} में पढ़ने के कारण छिपा है।",
  "cases.hiddenByLanguage.other":
    "{other} में {count} और केस हैं, जो {language} में पढ़ने के कारण छिपे हैं।",

  "simulation.room": "सिमुलेशन रूम",
  "simulation.live": "लाइव रोलप्ले",
  "simulation.history": "बातचीत का रिकॉर्ड",
  "simulation.placeholder": "ट्रेनी आगे क्या कहता या करता है, वह लिखें।",
  "simulation.whatDoYouSay": "आप क्या कहेंगे?",
  "simulation.completed": "सिमुलेशन पूरा हुआ",
  "simulation.wrapUp": "तैयार हों तो समाप्त करें",
  "simulation.openReport": "इस रोलप्ले की फ़ीडबैक रिपोर्ट खोलें।",
  "simulation.none": "कोई सक्रिय सिमुलेशन नहीं",
  "simulation.audioError": "ऑडियो नहीं चल सका।",
  "simulation.turnError": "सिमुलेशन जारी नहीं रखा जा सका।",
  "simulation.setting": "परिवेश",
  "simulation.speaker": "बोलने वाला",
  "simulation.patient": "मरीज़",
  "simulation.turnsUsed": "उपयोग किए गए मोड़",
  "simulation.autoRead": "नए संदेश अपने आप पढ़ें",
  "simulation.yourResponse": "आपका अगला जवाब",
  "simulation.send": "जवाब भेजें",
  "simulation.session": "सेशन",
  "simulation.end": "सिमुलेशन समाप्त करें",
  "simulation.finish": "समाप्त करें और फ़ीडबैक बनाएँ",
  "simulation.situation": "स्थिति",
  "simulation.goal": "लक्ष्य",
  "simulation.challenge": "चुनौती",
  "simulation.messages": "संदेश",
  "simulation.pacedFor": "लगभग {n} मोड़ के लिए; बातचीत सुलझते ही समाप्त हो जाएगी।",
  "simulation.tension": "तनाव: {level}",
  "tension.low": "कम",
  "tension.medium": "मध्यम",
  "tension.high": "अधिक",
  "simulation.audioDisclaimer":
    "पढ़कर सुनाया जा रहा ऑडियो AI से बना है और केवल वही शब्द बोलता है जो बातचीत में दिख रहे हैं। बोलने का अंदाज़ — गति, साँस, भाव — अलग से तय होता है और कही गई बात का हिस्सा नहीं है।",

  "speaker.patient": "मरीज़",
  "speaker.family_member": "परिजन",
  "speaker.nurse": "नर्स",
  "speaker.bystander": "पास खड़ा व्यक्ति",
  "speaker.narrator": "सूत्रधार",
  "role.system": "सिस्टम",
  "role.scenario": "परिदृश्य",
  "role.trainee": "ट्रेनी",
  "role.feedback": "फ़ीडबैक",

  "feedback.title": "फ़ीडबैक रिपोर्ट",
  "feedback.generating": "AI फ़ीडबैक तैयार हो रहा है",
  "feedback.sections": "रिपोर्ट के हिस्से",
  "feedback.improveNext": "अगली बार क्या सुधारें",
  "feedback.practice": "अभ्यास के लिए जवाब",
  "feedback.saving": "आपके रिकॉर्ड में सहेजा जा रहा है",
  "feedback.saved": "आपके रिकॉर्ड में सहेजा गया",
  "feedback.none": "समीक्षा के लिए कोई सिमुलेशन नहीं",
  "feedback.error": "फ़ीडबैक तैयार नहीं किया जा सका।",
  "report.summary": "सारांश",
  "report.quickRead": "एक नज़र में",
  "report.strength": "मज़बूती",
  "report.whatWorked": "क्या अच्छा रहा",
  "report.improve": "सुधार",
  "report.nextFocus": "अगला ध्यान",
  "report.dimensions": "आयाम",
  "report.fiveSkills": "संवाद के पाँच कौशल",
  "report.delivery": "बोलने का अंदाज़",
  "report.howYouSounded": "आप कैसे सुनाई दिए",
  "report.example": "उदाहरण",
  "report.linesYouCouldHaveUsed": "आप ये वाक्य कह सकते थे",
  "report.finalAdvice": "अंतिम सलाह",
  "report.carryForward": "आगे के लिए",
  "report.readingThis": "इसे कैसे पढ़ें",
  "report.whatItMeans": "इसका क्या मतलब है",
  "report.watchGaps": "इन कमियों पर ध्यान दें",
  "report.whatWentWell": "क्या अच्छा रहा",
  "report.improveNextTime": "अगली बार सुधारें",
  "report.customCriteria": "अतिरिक्त मानदंड",
  "report.yourAddedCriteria": "आपके जोड़े गए मूल्यांकन मानदंड",
  "report.pages": "फ़ीडबैक रिपोर्ट के पन्ने",
  "report.coach": "FirstDrop Coach",
  "report.atAGlance": "एक नज़र में",
  "report.howItWent": "कैसा रहा",
  "feedback.setting": "परिवेश",
  "feedback.endedIn": "समाप्त हुआ",
  "feedback.goal": "लक्ष्य",
  "feedback.scopeNote": "फ़ीडबैक केवल संवाद के व्यवहार और प्रशिक्षण प्रदर्शन तक सीमित है।",

  "progress.title": "मेरी प्रगति",
  "progress.subtitle": "आपका संवाद किस दिशा में जा रहा है।",
  "progress.scoredCases": "स्कोर किए गए केस",
  "progress.loading": "आपकी प्रगति लोड हो रही है...",
  "progress.emptyTitle": "अभी कोई केस नहीं।",
  "progress.unscored":
    "आपके केस चले, लेकिन किसी का स्कोर नहीं बन सका। सिम्युलेटर उपलब्ध रहते हुए कोई एक पूरा करें ताकि ट्रैकिंग शुरू हो सके।",
  "progress.skillBalance": "कौशल संतुलन",
  "progress.skillTree": "कौशल वृक्ष",
  "progress.recentSessions": "हाल के सेशन",
  "progress.loadError": "आपकी प्रगति लोड नहीं हो सकी।",

  "join.title": "ग्रुप जॉइन करें",
  "join.enterCode": "अपने मेंटर का कोड डालें।",
  "join.inAGroup": "आप एक ग्रुप में हैं",
  "join.yourGroup": "आपका ट्रेनिंग ग्रुप",
  "join.sharedWithMentor": "पूरे किए गए केस आपके मेंटर के साथ साझा होते हैं।",
  "join.startCase": "केस शुरू करें",
  "join.myProgress": "मेरी प्रगति",
  "join.leave": "यह ग्रुप छोड़ें",
  "join.codeError": "वह कोड काम नहीं आया।",
  "join.leaveError": "वह ग्रुप छोड़ा नहीं जा सका।",
  "join.joinError": "उस ग्रुप में शामिल नहीं हो सके।",

  "difficulty.foundational": "आधारभूत",
  "difficulty.intermediate": "मध्यम",
  "difficulty.advanced": "उन्नत",
  "difficultyBlurb.foundational": "स्पष्ट काम, सहयोगी सामने वाला।",
  "difficultyBlurb.intermediate": "टकराव, दोषारोपण, या घबराए परिवार को संभालना।",
  "difficultyBlurb.advanced": "मृत्यु, सुरक्षा का सवाल, या दबाव में आक्रामकता।",
  "subscore.empathy": "सहानुभूति",
  "subscore.clarity": "स्पष्टता",
  "subscore.structure": "संरचना और अगले कदम",
  "subscore.professionalism": "व्यावसायिकता",
  "subscore.deEscalation": "दबाव और तनाव कम करना",
  "band.strong": "मज़बूत",
  "band.developing": "विकसित हो रहा",
  "band.needsFocus": "ध्यान चाहिए",
  "role.mentor": "मेंटर",
  "role.traineeRole": "ट्रेनी",
};

const en = {
  ...coreEn,
  ...common.en,
  ...marketing.en,
  ...auth.en,
  ...scenario.en,
  ...mentor.en,
  ...progress.en,
  ...run.en,
};

export type StringKey = keyof typeof en;

const hi: Record<StringKey, string> = {
  ...coreHi,
  ...common.hi,
  ...marketing.hi,
  ...auth.hi,
  ...scenario.hi,
  ...mentor.hi,
  ...progress.hi,
  ...run.hi,
};

/**
 * Both dictionaries ship in the bundle. They are some tens of kilobytes of
 * text, so splitting them would trade a synchronous lookup -- which is what
 * keeps the first render free of an English flash -- for a loading state on
 * every string.
 */
const dictionaries: Record<AppLanguage, Record<StringKey, string>> = { en, hi };

type Vars = Record<string, string | number>;

/**
 * `vars` fills `{name}` placeholders. They are named rather than positional
 * because word order differs between the two languages -- Hindi puts the count
 * before the noun where English puts it after -- so a translator has to be free
 * to move a value without the call site changing.
 */
function format(language: AppLanguage, key: StringKey, vars?: Vars): string {
  const text = dictionaries[language][key];
  if (!vars) {
    return text;
  }

  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** Keys that come in a `.one` / `.other` pair, named by their shared stem. */
export type PluralStem = {
  [K in StringKey]: K extends `${infer Stem}.one` ? Stem : never;
}[StringKey];

function pluralKey(stem: PluralStem, count: number): StringKey {
  // Both languages treat exactly one as singular and everything else, zero
  // included, as plural, so two forms cover them. A language with a dual or a
  // "few" would need Intl.PluralRules here instead.
  return `${stem}.${count === 1 ? "one" : "other"}` as StringKey;
}

/**
 * Splits a translated sentence around `{name}` placeholders and drops React
 * nodes into the gaps, so a bold number or an inline link can sit wherever the
 * translator put it instead of the English word order being baked into JSX.
 */
function renderRich(text: string, nodes: Record<string, ReactNode>): ReactNode {
  return text.split(/(\{\w+\})/g).map((part, index) => {
    const match = /^\{(\w+)\}$/.exec(part);
    const content = match && match[1] in nodes ? nodes[match[1]] : part;
    return createElement(Fragment, { key: index }, content);
  });
}

export type Translator = ((key: StringKey, vars?: Vars) => string) & {
  /** Picks the `.one` or `.other` form of `stem`; `{count}` is filled in. */
  plural: (stem: PluralStem, count: number, vars?: Vars) => string;
  /** Like calling `t`, but placeholders may be filled with elements. */
  rich: (key: StringKey, nodes: Record<string, ReactNode>) => ReactNode;
  /** `rich` for a plural pair. */
  richPlural: (stem: PluralStem, count: number, nodes: Record<string, ReactNode>) => ReactNode;
};

function createTranslator(language: AppLanguage): Translator {
  const t = (key: StringKey, vars?: Vars) => format(language, key, vars);

  return Object.assign(t, {
    plural: (stem: PluralStem, count: number, vars?: Vars) =>
      format(language, pluralKey(stem, count), { count, ...vars }),
    rich: (key: StringKey, nodes: Record<string, ReactNode>) =>
      renderRich(dictionaries[language][key], nodes),
    richPlural: (stem: PluralStem, count: number, nodes: Record<string, ReactNode>) =>
      renderRich(dictionaries[language][pluralKey(stem, count)], { count, ...nodes }),
  });
}

export function useT(): Translator {
  const language = useLanguage();

  // Memoised so the identity changes only with the language. Callers put `t`
  // in dependency arrays -- a fresh function every render would rebuild those
  // memos on every render and defeat the point of having them.
  return useMemo(() => createTranslator(language), [language]);
}

/**
 * For library code with no hook to call: repository errors, the audio client,
 * the recorder. Reads the language at call time, which is always after
 * hydration for anything that throws in response to a user action.
 */
export function translate(key: StringKey, vars?: Vars): string {
  return format(getLanguage(), key, vars);
}

/**
 * The API routes answer in English, and they are shared by callers that do
 * not know the reader's language. Rather than threading a language into every
 * route, the client recognises the handful of messages a trainee can actually
 * meet and swaps in the translation. Anything unrecognised -- a missing API
 * key, say, which only a developer sees -- passes through untouched.
 */
const serverErrorKeys: Record<string, StringKey> = {
  "The AI request failed. Please try again.": "error.aiFailed",
  "The simulator is busy right now - please retry in a moment.": "error.aiBusy",
  "AI returned an unreadable response. Please try again.": "error.aiUnreadable",
  "Gemini returned an empty response. Please try again.": "error.aiEmpty",
  "Enter a scenario idea before generating.": "error.ideaRequired",
  "Add at least one trainee response before generating feedback.": "error.needResponse",
  "Transcription failed. Please try again.": "error.transcriptionFailed",
  "Transcription timed out. Please try a shorter clip.": "error.transcriptionTimeout",
  "Could not generate audio. Please try again.": "error.audioFailed",
  "Audio generation timed out. Please try again.": "error.audioTimeout",
};

export function localizeServerError(message: string | undefined, fallback: StringKey): string {
  if (!message) {
    return translate(fallback);
  }

  const key = serverErrorKeys[message];
  return key ? translate(key) : message;
}

/**
 * A track's display name. The stored value stays English (see the note at
 * the top of this file); a track this build does not know -- older data, or a
 * category added without copy -- is shown as stored rather than as a key.
 */
export function categoryLabel(t: Translator, category: string): string {
  const key = `category.${category}`;
  return key in en ? t(key as StringKey) : category;
}
