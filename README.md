# FirstDrop Healthcare Simulation MVP

FirstDrop is a healthcare communication simulation prototype for roleplay-style training. A trainer enters a rough scenario idea, Gemini converts it into a structured training scenario, a trainee responds step by step, and the app generates a feedback report on communication quality.

## Safety Disclaimer

This is not a medical diagnosis tool. It is only for communication training and scenario-based roleplay. The AI should not be used for diagnosis, medication, treatment instructions, triage, or clinical decision-making advice.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Gemini API through a Next.js API route
- Browser `localStorage` for the current simulation session
- Browser Web Speech API for optional voice input

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
- Gemini-powered next-turn generation.
- Feedback report generation focused on communication, empathy, clarity, and pressure handling.
- Feedback export as a `.txt` file.
- Current simulation persistence through `localStorage`.

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
roadmap/
  futureMediaArchitecture.md
```

## Validation

```bash
npm run lint
npm run build
```
