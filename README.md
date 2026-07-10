# FirstDropAI Healthcare Simulation MVP

FirstDropAI is a healthcare communication simulation prototype for roleplay-style training. A trainer enters a rough scenario idea, Gemini converts it into a structured training scenario, a trainee responds step by step, and the app generates a feedback report on communication quality.

## Safety Disclaimer

This is not a medical diagnosis tool. It is only for communication training and scenario-based roleplay. The AI should not be used for diagnosis, medication, treatment instructions, triage, or clinical decision-making advice.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Gemini API through Next.js API routes
- Browser `localStorage` for the current simulation session
- OpenAI speech-to-text through `/api/openai/transcribe` for scenario-idea and trainee voice input
- OpenAI text-to-speech through `/api/openai/tts` for reading scenario (patient, family, nurse, narrator) messages aloud

## Local Setup

```bash
npm install
```

Create a local environment file:

```bash
copy .env.example .env.local
```

Add your keys to `.env.local`:

```bash
GEMINI_API_KEY=your_real_key_here
GEMINI_MODEL=gemini-2.5-flash

# Voice is optional. Set OPENAI_API_KEY to enable speech-to-text and read-aloud.
OPENAI_API_KEY=your_openai_key_here
OPENAI_TRANSCRIBE_MODEL=gpt-4o-transcribe
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=alloy
```

`GEMINI_API_KEY` is required for all text generation (scenario, simulation turns, feedback). `GEMINI_MODEL` is optional and defaults to `gemini-2.5-flash`.

Voice is powered by OpenAI and is fully optional: only `OPENAI_API_KEY` is needed to enable it. `OPENAI_TRANSCRIBE_MODEL`, `OPENAI_TTS_MODEL`, and `OPENAI_TTS_VOICE` are optional and default to `gpt-4o-transcribe`, `gpt-4o-mini-tts`, and `alloy`. If `OPENAI_API_KEY` is absent, the app still works fully by typing and the voice controls surface a clear disabled/error state.

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
5. Optionally add `OPENAI_API_KEY` (and the optional `OPENAI_*` model/voice overrides) to enable voice.
6. Deploy.

API keys are only read in server API routes (`src/app/api/gemini/route.ts`, `src/app/api/openai/transcribe/route.ts`, and `src/app/api/openai/tts/route.ts`). They are never exposed to frontend code.

## Current Features

- Home page with product explanation and safety disclaimer.
- Scenario creator with typed input plus optional OpenAI speech-to-text for the idea field.
- Gemini-powered structured scenario generation.
- Chat-style simulation room with turn count and tension level.
- Optional OpenAI speech-to-text for the trainee response (transcript is editable; never auto-sent).
- Read-aloud of scenario messages via OpenAI text-to-speech, with a per-message speaker button and an "Auto-read new patient messages" toggle. The audio only voices the exact text Gemini already produced.
- Gemini-powered next-turn generation.
- Feedback report generation focused on communication, empathy, clarity, and pressure handling.
- Feedback export as a `.txt` file.
- Current simulation persistence through `localStorage`.

## How to Test This Prototype

1. Create a scenario from one of the sample ideas below or your own communication challenge. Optionally press **Speak** next to the idea field to dictate it instead of typing.
2. Start the simulation.
3. Press the speaker icon on any patient/family/nurse/narrator message to hear it read aloud, or toggle **Auto-read new patient messages** so each new AI turn plays automatically. Use **Stop reading aloud** to interrupt playback.
4. Type a response, or press **Speak** next to the response box to dictate it. The transcript lands in the box for you to review and edit — it is never auto-sent.
5. Continue for a few turns, then use **Generate Feedback**.
6. Export the feedback report as `.txt` and confirm it includes coaching notes.

Text input and text-only play always work. Voice input uses the browser MediaRecorder to capture microphone audio, then OpenAI transcribes it through a server route. Read-aloud uses OpenAI text-to-speech through a server route and only voices the exact scenario text Gemini already produced. Both OpenAI keys stay server-side. The transcript remains editable and must be sent manually.

## Demo Testing Scenarios

Use these trainer prompts to test the prototype end to end. They are designed to check live role boundaries, speaker labels, read-aloud behavior, and communication-focused feedback.

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
- Read-aloud should only voice AI scenario messages, never the trainee's own turns.
- Feedback should be communication-focused.
- No diagnosis or treatment advice should be generated.

## Voice Notes

- Text generation (scenario, simulation turns, feedback) is entirely Gemini and is unchanged by the voice features.
- Voice is powered by OpenAI and is optional. Speech-to-text uses MediaRecorder to capture microphone audio, which OpenAI transcribes through `/api/openai/transcribe`.
- Read-aloud uses OpenAI text-to-speech through `/api/openai/tts` and only voices the exact scenario text Gemini produced — it never regenerates or alters that text.
- The OpenAI API key stays server-side and is not sent to the browser.
- Read-aloud audio is AI-generated; this is disclosed in the UI next to the read-aloud controls.
- Browser support depends on microphone permission and MediaRecorder support; if voice is unavailable or a call fails, the app still works fully by typing.
- When recording stops, the transcript remains editable and must be sent manually.
- Generated audio is played in the browser and is not saved as a file by the app.

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
    api/openai/transcribe/route.ts
    api/openai/tts/route.ts
  components/
    common/
    feedback/
    layout/
    scenario/
    simulation/
  lib/
    ai/
    export/
    hooks/
    prompts/
    safety/
    simulation/
    storage/
  types/
    feedback.ts
    media.ts
    scenario.ts
    simulation.ts
roadmap/
  futureMediaArchitecture.md
```

## Validation

```bash
npm run lint
npm run build
```
