export function buildScenarioPrompt(input: string): string {
  return `Convert this rough trainer idea into a structured healthcare communication training scenario.

Trainer idea:
${input}

Rules:
- Focus on communication, empathy, patient interaction, and pressure handling.
- Do not provide diagnosis, medication, treatment instructions, triage advice, or clinical decision-making advice.
- Keep clinical details generic and only as context for communication.
- Keep every string short and skimmable. Prefer one sentence per field.
- summary: max 30 words.
- patientProfile: max 22 words.
- startingSituation: max 35 words.
- firstPrompt: max 35 words.
- evaluationCriteria: exactly 4 short items.
- suggestedTurns: 3 to 5.
- Return only valid JSON matching this TypeScript shape:
{
  "id": "string",
  "title": "string",
  "setting": "string",
  "summary": "string",
  "patientProfile": "string",
  "patientEmotion": "string",
  "familyEmotion": "string optional",
  "traineeObjective": "string",
  "communicationChallenge": "string",
  "startingSituation": "string",
  "firstPrompt": "string",
  "suggestedTurns": 5,
  "endingCondition": "string",
  "evaluationCriteria": ["string"],
  "mediaAssets": []
}`;
}
