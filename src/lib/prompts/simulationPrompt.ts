import type { SimulationState } from "@/types/simulation";
import type { VoiceMetrics } from "@/types/voice";

type SimulationPromptOptions = {
  roleCorrection?: boolean;
  rejectedMessage?: string;
};

function summarizeVoiceMetrics(metrics?: VoiceMetrics): string {
  if (!metrics) {
    return "None provided.";
  }

  return JSON.stringify({
    volume: metrics.volumeLevel,
    pitch: metrics.pitchLevel,
    pace: metrics.paceLevel,
    pauses: metrics.pausePattern,
    clarity: metrics.clarityLevel,
    toneEstimate: metrics.toneEstimate,
    confidence: metrics.confidence,
  });
}

export function buildSimulationPrompt(
  state: SimulationState,
  traineeResponse: string,
  voiceMetrics?: VoiceMetrics,
  options?: SimulationPromptOptions,
): string {
  const recentMessages = state.messages.slice(-6).map((message) => ({
    role: message.role,
    ...(message.role === "scenario" && message.speaker ? { speaker: message.speaker } : {}),
    content: message.content,
    ...(message.role === "trainee" && message.voiceMetrics
      ? { voiceDeliveryEstimate: summarizeVoiceMetrics(message.voiceMetrics) }
      : {}),
  }));

  return `Continue this healthcare communication roleplay scenario.

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
Current turn: ${state.currentTurn}
Remaining turns: ${Math.max(state.maxTurns - state.currentTurn, 0)}
Current tension level: ${state.tensionLevel}
Recent messages: ${JSON.stringify(recentMessages)}
Latest trainee response: ${traineeResponse}
Latest voice delivery estimate: ${summarizeVoiceMetrics(voiceMetrics)}
${options?.roleCorrection ? `Rejected previous response for speaking like the doctor/trainee: ${options.rejectedMessage || "not provided"}` : ""}

Rules:
- Keep the next scenario message short, realistic, and spoken from the patient/family/situation perspective.
- message: 1 to 3 sentences, under 55 words.
- speaker must identify who is speaking or narrating: patient, family_member, nurse, bystander, or narrator.
- If speaking as family_member, patient, or bystander, use their concerns, questions, frustration, anxiety, confusion, or requests.
- If speaking as narrator, describe what happens and ask what the trainee does next.
- If the trainee response was unclear, the patient/family/narrator should react to that lack of clarity. Do not correct it by speaking as the doctor.
- Consider both what the trainee said and the estimated delivery pattern.
- Treat voice delivery as a light communication cue, never as the main reason for the next turn.
- Do not change tension based on one voice metric alone.
- Increase tension only if the trainee is dismissive, vague, unclear, or if several medium/high-confidence delivery cues suggest rushed, loud, tense, or frustrated communication.
- Reduce tension if the trainee is calm, empathetic, transparent, clear, and delivery appears steady.
- Voice estimates are approximate; low-confidence metrics are weak signals and may be ignored.
- Ask what the trainee says or does next unless the scenario should end.
- Do not provide diagnosis, medication, treatment instructions, triage advice, or clinical decision-making advice.
- Bad response: "I understand you're concerned. I can tell you your parent is stable."
- Why bad: This speaks as the doctor/trainee.
- Good response: Family member: "You're not sure? Then who can tell me what is actually happening? I need someone senior here now. What do you say?"
- Good response: Narrator: "The family member looks more alarmed after your unclear answer. They ask for a senior doctor. What do you do next?"
- Return only valid JSON:
{
  "speaker": "patient" | "family_member" | "nurse" | "bystander" | "narrator",
  "message": "string",
  "tensionLevel": "low" | "medium" | "high",
  "shouldEnd": false
}`;
}
