import type { StringKey } from "@/lib/i18n/strings";

/**
 * Sample exchanges for the homepage snippet. No AI calls, no storage — these
 * are written by hand so the hero never depends on a model being reachable.
 *
 * Several of them, cycled at random, because a single looping exchange makes a
 * live-looking panel read as a static screenshot within about ten seconds.
 * Each covers a different counterpart and a different pressure, so the loop
 * also shows the range of the product rather than one situation.
 *
 * The lines themselves live in the dictionaries (`hero.*`), so a Hindi reader
 * watches a Hindi conversation; this list only fixes the order and speakers.
 */
export type HeroExchange = {
  id: string;
  speaker: StringKey;
  prompt: StringKey;
  reply: StringKey;
};

export const heroExchanges: HeroExchange[] = [
  {
    id: "waiting-parent",
    speaker: "hero.parent",
    prompt: "hero.waiting.prompt",
    reply: "hero.waiting.reply",
  },
  {
    id: "angry-patient",
    speaker: "hero.patient",
    prompt: "hero.angry.prompt",
    reply: "hero.angry.reply",
  },
  {
    id: "frightened-relative",
    speaker: "hero.family",
    prompt: "hero.frightened.prompt",
    reply: "hero.frightened.reply",
  },
  {
    id: "embarrassed-patient",
    speaker: "hero.patient",
    prompt: "hero.embarrassed.prompt",
    reply: "hero.embarrassed.reply",
  },
  {
    id: "blaming-family",
    speaker: "hero.family",
    prompt: "hero.blaming.prompt",
    reply: "hero.blaming.reply",
  },
];
