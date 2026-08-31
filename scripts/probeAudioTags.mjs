/**
 * Checks that the model's audio tags actually track the emotional register,
 * rather than defaulting to one tag on every line.
 *
 * Run it against a local dev server after any change to the audio-tag rule in
 * simulationPrompt.ts. It exists because the earlier round of voice-prompt work
 * failed partly for want of a cheap way to see what a change did -- three
 * scenarios and a few seconds beats guessing.
 *
 * Hold the scenario constant across runs and identical output tells you nothing;
 * that is why each case here sets a different familyEmotion and tensionLevel.
 *
 * Usage: node scripts/probeAudioTags.mjs   (dev server must be running)
 */
const mk = (familyEmotion, tensionLevel, messages, extra = {}) => ({
  scenario: {
    id: "probe", title: "Sudden cardiac death",
    setting: "Emergency department relatives' room",
    summary: "A 35-year-old man died after cardiac arrest.",
    patientProfile: "35-year-old man.", patientEmotion: "deceased",
    familyEmotion, traineeObjective: "Declare death with empathy.",
    communicationChallenge: "Bad news to a family who blames intervention.",
    startingSituation: "Family brought into the relatives' room.",
    suggestedTurns: 4, ...extra,
  },
  currentTurn: 3, maxTurns: 12, tensionLevel, status: "active", messages,
});

const msg = (role, content, speaker) => ({
  id: Math.random().toString(36).slice(2), role, content, speaker,
  timestamp: new Date().toISOString(),
});

const CASES = [
  { label: "FURIOUS / high tension",
    state: mk("enraged, blaming the medical team", "high",
      [msg("scenario", "You killed him!", "family_member"), msg("trainee", "I understand you're angry.")]),
    trainee: "I hear you. I want to go through exactly what happened, step by step." },

  { label: "DE-ESCALATED / low tension",
    state: mk("exhausted, quietly grieving, no longer blaming", "low",
      [msg("scenario", "I just don't understand how this happened.", "family_member"),
       msg("trainee", "Take whatever time you need. I'll stay and answer anything.")]),
    trainee: "There was nothing you could have done differently. This was not your fault." },

  { label: "QUIET DISBELIEF / medium",
    state: mk("numb, disbelieving, barely able to speak", "medium",
      [msg("scenario", "He was talking to me an hour ago.", "family_member"),
       msg("trainee", "I know. I'm so sorry.")]),
    trainee: "Would you like to sit with him for a while?" },
];

for (const { label, state, trainee } of CASES) {
  const r = await fetch("http://localhost:3000/api/gemini", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "nextTurn", payload: { state, traineeResponse: trainee } }),
  });
  const t = (await r.json()).result;
  const tags = (t.spokenMessage || "").match(/\[[^\]]+\]/g) ?? [];
  console.log(`\n${label}`);
  console.log(`  tags    : ${tags.length ? tags.join(" ") : "(none)"}`);
  console.log(`  spoken  : ${t.spokenMessage || t.message}`);
  console.log(`  delivery: ${t.delivery}`);
}
