/**
 * Sample exchanges for the homepage snippet. No AI calls, no storage — these
 * are written by hand so the hero never depends on a model being reachable.
 *
 * Several of them, cycled at random, because a single looping exchange makes a
 * live-looking panel read as a static screenshot within about ten seconds.
 * Each covers a different counterpart and a different pressure, so the loop
 * also shows the range of the product rather than one situation.
 */
export type HeroExchange = {
  id: string;
  speaker: string;
  prompt: string;
  reply: string;
};

export const heroExchanges: HeroExchange[] = [
  {
    id: "waiting-parent",
    speaker: "Parent",
    prompt: "Nobody has told me anything for an hour. Is my daughter okay?",
    reply:
      "I can hear how frightening this wait has been. Her results are back with the doctor now, and I'll come find you the moment we know more.",
  },
  {
    id: "angry-patient",
    speaker: "Patient",
    prompt: "This is the third time you've moved my appointment. Does my time mean nothing?",
    reply:
      "You're right to be frustrated, and I'm sorry. Let me find you the first slot we have and put it in writing before you leave.",
  },
  {
    id: "frightened-relative",
    speaker: "Family member",
    prompt: "Just tell me straight. Is he going to wake up?",
    reply:
      "I'm not going to guess with you. What I can tell you is what we know now, and I'll be honest with you as soon as anything changes.",
  },
  {
    id: "embarrassed-patient",
    speaker: "Patient",
    prompt: "Yes, yes, I understood all that. It's fine.",
    reply:
      "That was a lot at once, and I went quickly. Could you tell me what you'll say to your wife when you get home, so I know what I've missed?",
  },
  {
    id: "blaming-family",
    speaker: "Family member",
    prompt: "If you'd scanned her when we first came in, we wouldn't be here.",
    reply:
      "That question deserves a proper answer, not a rushed one. I'll go through the timeline with you, and I won't leave anything out.",
  },
];
