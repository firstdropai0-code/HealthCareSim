/**
 * The languages the app can be run in.
 *
 * Two separate things wear this type and they are not always the same value:
 *
 *  - the UI language, a per-browser preference (see `languageStore`);
 *  - `Scenario.language`, pinned when a scenario is generated.
 *
 * They diverge on purpose. A case authored in Hindi keeps its Devanagari text,
 * its Hindi roleplay and its Hindi voice however the reader has set their UI —
 * translating a saved scenario on the fly would change the exercise, and the
 * transcript already on a trainee's run would stop matching the case they sat.
 */
export type AppLanguage = "en" | "hi";

export const APP_LANGUAGES: AppLanguage[] = ["en", "hi"];

/** Each language named in itself, which is how a language picker should read. */
export const languageLabel: Record<AppLanguage, string> = {
  en: "English",
  hi: "हिन्दी",
};

/**
 * The invitation to switch INTO a language, written in that language.
 *
 * Deliberately not in the UI dictionaries: the whole point is that someone who
 * reads Hindi but has landed on the English site can read the offer, so it has
 * to be in the target language whatever the page is currently showing -- the
 * same reason `languageLabel` names each language in itself.
 */
export const languageInvite: Record<AppLanguage, { headline: string; action: string }> = {
  en: { headline: "Also available in English", action: "View in English" },
  hi: { headline: "हिन्दी में भी उपलब्ध", action: "हिन्दी में देखें" },
};

/** The language a two-language toggle would switch to. */
export function otherLanguage(language: AppLanguage): AppLanguage {
  return language === "en" ? "hi" : "en";
}

/** For `<html lang>` and for the speech-to-text `language` parameter. */
export const languageBcp47: Record<AppLanguage, string> = {
  en: "en",
  hi: "hi",
};

/**
 * For `toLocaleDateString`. English stays `undefined` -- the browser's own
 * locale -- which is what every date read before languages existed, so an
 * English reader in the US still sees "Sep 23" rather than "23 Sept". Hindi
 * names the Indian locale so months come out in Devanagari.
 */
export const languageDateLocale: Record<AppLanguage, string | undefined> = {
  en: undefined,
  hi: "hi-IN",
};

/**
 * What the model should write in. Naming the script matters as much as the
 * language: ElevenLabs reads Devanagari cleanly, and romanised Hindi would also
 * break the feedback report's quoting of the trainee's own words.
 */
export const languageDirective: Record<AppLanguage, string> = {
  en: "Write everything in English.",
  hi: "पूरा उत्तर हिन्दी में, देवनागरी लिपि में लिखें। Write every field in natural spoken Hindi using Devanagari script -- never romanised Hindi. Common English clinical terms that Indian clinicians genuinely say in English (blood test, ICU, discharge, scan, report) may stay in Latin script inside the Hindi sentence, because that is how the conversation really sounds.",
};

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === "en" || value === "hi";
}
