# FirstDropAI Healthcare Simulation MVP

FirstDropAI is a healthcare communication simulation prototype for roleplay-style training. A trainer enters a rough scenario idea, Gemini converts it into a structured training scenario, a trainee responds step by step, and the app generates a feedback report on communication quality.

## Safety Disclaimer

This is not a medical diagnosis tool. It is only for communication training and scenario-based roleplay. The AI should not be used for diagnosis, medication, treatment instructions, triage, or clinical decision-making advice.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Gemini API through a Next.js API route
- Browser `localStorage` for the current simulation session
- Browser Web Speech API for optional voice input
- Browser SpeechSynthesis API for scenario message playback
- Browser Web Audio API for approximate voice delivery estimates

## Local Setup

```bash
npm install
```

Create a local environment file:

```bash
copy .env.example .env.local
```

Add your Gemini key to `.env.local`:

```bash
GEMINI_API_KEY=your_real_key_here
GEMINI_MODEL=gemini-2.5-flash-lite
```

`GEMINI_MODEL` is optional. The app defaults to `gemini-2.5-flash-lite` and automatically falls back to `gemini-2.5-flash` and `gemini-3.5-flash` when Gemini returns temporary overload errors.

Run the app locally:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Vercel Deployment

1. Push this project to a Git provider connected to Vercel.
2. Create a new Vercel project from the repository.
3. In Vercel, open Project Settings, then Environment Variables.
4. Add `GEMINI_API_KEY` with your Gemini API key.
5. Deploy.

The API key is only read in `src/app/api/gemini/route.ts` and is never exposed to frontend code.

## Current Features

- Home page with product explanation and safety disclaimer.
- Scenario creator with typed and voice input.
- Gemini-powered structured scenario generation.
- Chat-style simulation room with turn count and tension level.
- Scenario message playback with browser text-to-speech.
- Voice capture that can estimate volume, pitch, pace, pauses, and likely tone.
- Gemini-powered next-turn generation.
- Feedback report generation focused on communication, empathy, clarity, pressure handling, and optional estimated voice delivery.
- Feedback export as a `.txt` file.
- Current simulation persistence through `localStorage`.

## How to Test This Prototype

1. Create a scenario from one of the sample ideas below or your own communication challenge.
2. Start the simulation and read the first patient or family prompt.
3. Type a response, or use **Start voice recording** to capture speech.
4. Stop recording, review the transcript, and edit it before sending.
5. Check the estimated voice delivery pattern when available.
6. Continue for a few turns, then use **Generate Feedback**.
7. Export the feedback report as `.txt` and confirm it includes the transcript and coaching notes.

Text input should always work. Browser voice features depend on microphone permission and browser support.

## Demo Testing Scenarios

Use these trainer prompts to test the prototype end to end. They are designed to check live role boundaries, speaker labels, TTS behavior, estimated voice delivery, and communication-focused feedback.

### 1. ER patient with anxious family

**Trainer prompt:** A child has been waiting in the emergency department for several hours. The parent is anxious, repeatedly asking whether the child is safe and why no one has explained the delay.

**Doctor response to test:** Clear acknowledgement of anxiety, simple explanation of next communication steps, and a check for understanding without giving unsupported clinical details.

**Expected simulation behavior:** The AI should speak as the parent, patient, nurse, or narrator. If the doctor is vague, the parent should become more anxious and ask for clearer updates or escalation.

**Good feedback should mention:** Empathy, naming the concern, explaining what can be shared, setting expectations, and avoiding dismissive or overly technical language.

### 2. Post-surgery update to worried relative

**Trainer prompt:** A relative is waiting after a surgery and has only heard that the patient is in recovery. They are worried, tired, and asking whether something went wrong.

**Doctor response to test:** Calm update structure, reassurance without overpromising, clear boundaries around what is known, and a plan for the next update.

**Expected simulation behavior:** The AI should respond as the worried relative or narrator. If the doctor sounds rushed or unclear, the relative should press for more certainty or ask who can answer.

**Good feedback should mention:** Reassurance, transparency, pacing, avoiding false certainty, and giving a concrete next communication step.

### 3. Patient angry about long waiting time

**Trainer prompt:** An adult patient is angry after waiting a long time for an appointment. They feel ignored and say the clinic does not care about them.

**Doctor response to test:** De-escalation, apology for the experience, acknowledgement of frustration, and a practical next step without blaming staff or the patient.

**Expected simulation behavior:** The AI should speak as the angry patient or narrator. If the doctor becomes defensive, the patient should remain upset or challenge the response.

**Good feedback should mention:** De-escalation, non-defensive wording, validating emotion, concise explanation, and keeping the conversation focused on what happens next.

### 4. Elderly patient confused and scared

**Trainer prompt:** An elderly patient is confused in a busy hospital setting and is scared because they do not understand where they are being taken or why.

**Doctor response to test:** Slower, simpler communication; reassurance; orientation; one step at a time; and checking whether the patient understood.

**Expected simulation behavior:** The AI should speak as the elderly patient, nurse, or narrator. If the doctor uses complex language, the patient should stay confused or ask repeated questions.

**Good feedback should mention:** Plain language, slower pace, checking understanding, emotional reassurance, and avoiding information overload.

### 5. Family demanding information the doctor cannot fully share yet

**Trainer prompt:** A family member demands detailed information about a patient before the team has confirmed what can be shared. The family member is upset and believes staff are hiding something.

**Doctor response to test:** Boundary-setting, empathy, privacy-aware communication, and offering what can be shared now without inventing or disclosing unsupported details.

**Expected simulation behavior:** The AI should speak as the demanding family member or narrator. If the doctor shares too much or is vague, the family member should challenge the response.

**Good feedback should mention:** Respectful boundaries, calm tone, explaining limits, offering next steps, and maintaining trust without giving diagnosis or treatment advice.

## Internal QA Checklist

- AI should never speak as the doctor during live simulation.
- AI should label the scenario speaker correctly.
- TTS should only read AI scenario messages.
- Voice metrics should be shown as estimates.
- Feedback should be communication-focused.
- No diagnosis or treatment advice should be generated.

## Voice Prototype Notes

- Voice input uses the browser Web Speech API.
- Scenario playback uses the browser SpeechSynthesis API.
- Voice tone analysis uses the browser Web Audio API and simple heuristics.
- Tone detection is approximate and intended only for communication training feedback.
- Browser support varies. Chrome and Edge generally provide the best Web Speech support.
- No audio is stored, uploaded, or saved by this prototype unless that behavior is explicitly changed later.

## Future Roadmap

- Patient avatar support.
- Image-based scenario context.
- Video scenario playback.
- Audio conversation mode.
- Document/chart preview.
- Backend database.
- Trainer and trainee login.
- Scenario library.
- Analytics dashboard.

## Folder Structure

```text
src/
  app/
    page.tsx
    scenario/page.tsx
    simulation/page.tsx
    feedback/page.tsx
    api/gemini/route.ts
  components/
    common/
    feedback/
    layout/
    scenario/
    simulation/
  hooks/
    useSpeechToText.ts
    useTextToSpeech.ts
    useVoiceCapture.ts
  lib/
    ai/
    export/
    prompts/
    safety/
    simulation/
    storage/
  types/
    feedback.ts
    media.ts
    scenario.ts
    simulation.ts
    voice.ts
roadmap/
  futureMediaArchitecture.md
```

## Validation

```bash
npm run lint
npm run build
```
