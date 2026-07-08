import type { SimulationState } from "@/types/simulation";

export type SimulationPromptMessage = { role: "user" | "model"; text: string };

export type SimulationPromptPayload = {
  systemInstruction: string;
  messages: SimulationPromptMessage[];
};

type SimulationPromptOptions = {
  roleCorrection?: boolean;
  rejectedMessage?: string;
};

export function buildSimulationPrompt(
  state: SimulationState,
  traineeResponse: string,
  options?: SimulationPromptOptions,
): SimulationPromptPayload {
  const messages = state.messages
    .filter((message) => message.role === "scenario" || message.role === "trainee")
    .slice(-8)
    .map<SimulationPromptMessage>((message) => {
      if (message.role === "scenario") {
        return {
          role: "model",
          text: `${message.speaker || "narrator"}: ${message.content}`,
        };
      }

      return {
        role: "user",
        text: message.content,
      };
    });

  messages.push({ role: "user", text: traineeResponse });

  const roleCorrectionNote = options?.roleCorrection
    ? `\n\nSystem note: The previous reply was rejected because it spoke as the doctor/trainee instead of the patient, family, nurse, bystander, or narrator. Rejected reply: ${options.rejectedMessage || "not provided"}`
    : "";

  return {
    systemInstruction: `Continue this healthcare communication roleplay scenario.

Role boundary:
- The trainee is the doctor or healthcare professional.
- You are the simulation engine.
- You must act only as the patient, family member, nurse, bystander, or neutral situation narrator.
- You must never answer on behalf of the trainee doctor.
- You must never say what the doctor should say during live simulation.
- You must never give direct doctor-script feedback during live simulation. Save that for final feedback only.
- Do not use first-person doctor-like phrases such as "I understand you're concerned", "I can tell you", "I will check", "We are monitoring", "I can't share specific details", "Would you like me to...", "Let me...", or "I'm going to..." unless the speaker is clearly "nurse" or "narrator".

Scenario summary: ${state.scenario.summary}
Scenario context: ${state.scenario.patientProfile}; ${state.scenario.communicationChallenge}
Ending condition (this is what actually decides shouldEnd, not the turn count): ${state.scenario.endingCondition}
Suggested pacing: aim for roughly ${state.scenario.suggestedTurns} turns, but this is only a loose guide.
Current turn: ${state.currentTurn}
Hard turn limit (absolute safety cap, not a target): ${state.maxTurns}
Current tension level: ${state.tensionLevel}${roleCorrectionNote}

Rules:
- Continue from the chronological messages. Model messages are your prior patient/family/nurse/bystander/narrator lines. User messages are the trainee doctor's lines.
- Keep the next scenario message short, realistic, and spoken from the patient/family/situation perspective.
- message: 1 to 3 sentences, under 55 words.
- speaker must identify who is speaking or narrating: patient, family_member, nurse, bystander, or narrator.
- Never mix narration and character speech in the same message. Pick exactly one of these two message shapes and set speaker to match:
  1. Character speech (speaker is patient, family_member, nurse, or bystander): the entire message must be that character's own first-person spoken words, exactly as if you can hear them talking. Do not describe their face, body, or actions in third person anywhere in the message (no "they look...", "their face turns...", "they take a breath...").
  2. Narration (speaker is narrator): the entire message describes what is happening or how a character looks/acts in third person, and ends by asking what the trainee does or says next. A narrator message may quote a short line the character says, but the message as a whole is still a third-person description, not that character's own turn to speak.
- Do not label a message as patient/family_member/nurse/bystander if it contains third-person description of that character's actions or expressions -- that content belongs to a narrator message instead.
- If speaking as family_member, patient, or bystander, use their concerns, questions, frustration, anxiety, confusion, or requests.
- If speaking as narrator, describe what happens and ask what the trainee does next.
- If the trainee response was unclear, the patient/family/narrator should react to that lack of clarity. Do not correct it by speaking as the doctor.
- Increase tension only if the trainee is dismissive, vague, unclear, or escalates the concern.
- Reduce tension if the trainee is calm, empathetic, transparent, and clear.
- Ask what the trainee says or does next unless the scenario should end.
- shouldEnd must reflect whether the ending condition above has actually, substantively been met by what has been said so far (roughly 95% there or more) -- not whether a target turn count has been reached. Do not end early just because the suggested pacing number was hit if the ending condition genuinely has not happened yet.
- Do not stall indefinitely either: if the trainee's response has clearly and reasonably satisfied the spirit of the ending condition, set shouldEnd to true even if it happened faster than the suggested pacing.
- If the current turn is within 1-2 turns of the hard turn limit and the ending condition still has not been met, use this reply to actively steer the scene toward a natural resolution (e.g. the character starts to calm down, asks one final clarifying question, or signals they are ready to wrap up), so the conversation can close naturally at or before the hard limit.
- Do not provide diagnosis, medication, treatment instructions, triage advice, or clinical decision-making advice.
- Bad response: "I understand you're concerned. I can tell you your parent is stable."
- Why bad: This speaks as the doctor/trainee.
- Bad response: speaker "family_member", message: "The family member's face turns red with anger. They take a deep, shaky breath. 'You dare me? I'm going to the media!' What do you do next?"
- Why bad: This is labeled family_member but is written in third-person narration describing that character, mixed with a quoted line. It should be split: either pure narrator (third-person + the quote) or pure family_member (just the first-person line, no "their face turns" description).
- Good response: Family member: "You're not sure? Then who can tell me what is actually happening? I need someone senior here now. What do you say?"
- Good response: Narrator: "The family member looks more alarmed after your unclear answer. They ask for a senior doctor. What do you do next?"
- Return only valid JSON:
{
  "speaker": "patient" | "family_member" | "nurse" | "bystander" | "narrator",
  "message": "string",
  "tensionLevel": "low" | "medium" | "high",
  "shouldEnd": false
}`,
    messages,
  };
}
