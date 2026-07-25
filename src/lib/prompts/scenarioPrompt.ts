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
- firstPrompt is the OPENING LINE of the simulation, spoken ONLY from the patient / family member / narrator perspective - the situation the trainee (who is the doctor) must respond to. It must NEVER be the doctor's or trainee's dialogue. Write it as the narrator setting the scene and/or the patient's own words, ending by prompting the trainee to respond. Max 35 words.
- CRITICAL: the doctor/clinician is the TRAINEE. Never write the firstPrompt as the clinician greeting, questioning, reassuring, or introducing themselves to the patient. It must not contain the clinician speaking in the first person ("I'm here to...", "the nurse told me...", "how are you feeling?", "let me explain..."). Any first-person "I" in the firstPrompt must belong to the patient or family member, never the doctor.
- Bad firstPrompt (this is the DOCTOR speaking - never do this):
  "Mr. Harrison, it's completely normal to have questions. How are you feeling?"
- Bad firstPrompt (also the DOCTOR speaking - never do this):
  "Mr. Harrison, the nurse just told me you're waiting for an update on your child. I'm here to speak with you. What do you say?"
- Good firstPrompt (narrator sets the scene and prompts the trainee):
  "Mr. Harrison sits with his arms crossed, avoiding eye contact and giving short answers. He asks nothing. What do you say to him?"
- Good firstPrompt (narrator scene + patient's own words):
  "Mrs. Alvarez looks up as you enter, still calm. 'Is there any news on my daughter yet?' she asks. What do you say?"
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
