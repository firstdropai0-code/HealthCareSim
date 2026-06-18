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

## Sample Trainer Scenario Ideas

- A parent is anxious because their child has been waiting in the emergency department and wants clearer updates.
- A patient is frustrated about a delayed test result and needs a calm explanation of what will happen next.
- A family member is upset after hearing confusing information from multiple staff members and wants reassurance.

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
