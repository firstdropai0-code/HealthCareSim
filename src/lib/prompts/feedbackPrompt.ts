import type { SimulationState } from "@/types/simulation";

export function buildFeedbackPrompt(state: SimulationState): string {
  const transcript = state.messages.map((message) => ({
    role: message.role,
    ...(message.role === "scenario" && message.speaker ? { speaker: message.speaker } : {}),
    content: message.content,
    ...(message.role === "trainee" && message.voiceMetrics
      ? {
          voiceDeliveryEstimate: {
            volume: message.voiceMetrics.volumeLevel,
            pitch: message.voiceMetrics.pitchLevel,
            pace: message.voiceMetrics.paceLevel,
            pauses: message.voiceMetrics.pausePattern,
            clarity: message.voiceMetrics.clarityLevel,
            toneEstimate: message.voiceMetrics.toneEstimate,
            confidence: message.voiceMetrics.confidence,
          },
        }
      : {}),
  }));
  const hasVoiceMetrics = state.messages.some((message) => message.voiceMetrics);

  return `Evaluate this healthcare communication training simulation.

Scenario title: ${state.scenario.title}
Scenario summary: ${state.scenario.summary}
Trainee objective: ${state.scenario.traineeObjective}
Evaluation criteria: ${state.scenario.evaluationCriteria.join(", ")}
Transcript: ${JSON.stringify(transcript)}

Rules:
- Evaluate communication, empathy, clarity, stress handling, and scenario management.
- Do not deeply judge medical correctness.
- Do not provide clinical recommendations, treatment instructions, diagnosis, medication, or triage advice.
- Keep the feedback practical and communication-focused.
- Make the output easy to scan.
- summary: max 35 words.
- Each array should contain 2 to 4 short items.
- Each item should be one clear sentence under 22 words.
- betterResponses should be phrased as direct example lines the trainee could say.
- ${
    hasVoiceMetrics
      ? "Include constructive voiceDeliveryFeedback based on estimated voice delivery patterns: calmness, clarity, pacing, tone under pressure, reassurance, and whether delivery matched the words."
      : "Omit voiceDeliveryFeedback because no voice delivery estimates were captured."
  }
- If voiceDeliveryFeedback is included, state that it is based on estimated voice delivery patterns and avoid overclaiming accuracy.
- Voice delivery feedback must not sound like medical judgement or personality judgement.
- Give practical delivery suggestions such as slower pace, calmer tone, shorter pauses, or clearer reassurance.
- Treat low-confidence voice metrics as weak signals.
- Return only valid JSON matching this shape. voiceDeliveryFeedback is optional when no voice estimates exist:
{
  "overallScore": 8,
  "summary": "string",
  "whatWentWell": ["string"],
  "whatCouldImprove": ["string"],
  "communicationGaps": ["string"],
  "betterResponses": ["string"],
  "finalAdvice": "string",
  "voiceDeliveryFeedback": {
    "summary": "string",
    "strengths": ["string"],
    "improvements": ["string"]
  }
}`;
}
