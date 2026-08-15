# Future Media Architecture

This MVP only stores future media placeholders in the `MediaAsset` type. Media features should be added behind explicit trainer controls and should stay separate from clinical decision-making.

## Patient Avatar

- Add `avatar` media assets to scenarios.
- Store avatar provider metadata on `MediaAsset`.
- Render the avatar in the simulation room beside scenario messages.
- Keep avatar expression/state driven by communication tension, not medical status.

## Image-Based Scenario Context

- Add `image` media assets for room context, equipment, printed notices, or environmental details.
- Let trainers attach an uploaded image or generate one from a prompt.
- Show image cards in the scenario preview and simulation sidebar.

## Video Scenario Playback

- Add `video` media assets for trainer-provided opening clips.
- Display videos before the first trainee response.
- Keep transcript and feedback generation based on explicit message text unless a backend transcription service is added.

## Audio Conversations

- Add speech-to-text for trainee input and text-to-speech for scenario responses.
- Store audio clips as optional `audio` media assets only when user consent and storage rules are defined.
- Use a backend service for durable audio storage instead of `localStorage`.

## Document and Chart Preview

- Add `document` media assets for generic charts, discharge paperwork, consent forms, or clinic notes.
- Keep documents as roleplay props and avoid clinical instruction generation.
- Render previews in a dedicated simulation context panel.

## Backend Database — done (Firebase), deliberately narrowed

The original plan here was to replace `localStorageProvider` with a backend
implementation behind `storageProvider.ts`. That stub has been deleted and the
scope narrowed on purpose:

- The backend persists **completed runs only**, through
  `src/lib/runs/runRepository.ts`. Live session state stays in `localStorage`.
- The reason is the call sites, not the store. `saveSimulationState` runs on
  every turn from synchronous handlers, and `/scenario` saves then immediately
  navigates. Making that path async would let a flaky network break a roleplay
  mid-conversation and would race the navigation, for no product gain — nothing
  requires resuming an in-progress run on another device.
- One Firestore write happens per run, on the feedback page, once a report
  exists. It is awaited but non-fatal.

## Trainer and Trainee Login — done (Firebase Auth)

- Email/password auth with an immutable `role` of `mentor` or `trainee` on
  `users/{uid}`.
- Mentors create a group and share a six-character join code; trainees redeem
  it. Codes are keyed by the code itself so redemption is a `get()` by id —
  security rules cannot run a query.
- All access control lives in `firestore.rules`. The route guards in the app are
  redirects for convenience; with no Admin SDK there is no server-readable
  session for middleware to check.
- Known limit: with a client SDK and no trusted server, the client performs the
  write that carries its own score. Rules enforce shape, cohort, and
  immutability — they cannot enforce truth.

## Scenario Library

- Add saved scenario templates, search, duplication, and versioning.
- Support trainer notes and evaluation rubric presets.
- Keep generated scenarios editable before simulation starts.

## Analytics Dashboard

- Aggregate communication scores, completion rates, tension patterns, and repeated feedback themes.
- Avoid medical performance scoring unless reviewed by qualified clinical educators.
- Provide exportable training summaries for facilitators.

## Gemini Live API future upgrade

- Gemini Live API is a better fit for true real-time voice conversations because it supports WebSockets and native audio streaming.
- Add Live API in a separate PR because it changes the app architecture around streaming sessions, connection state, and interruption handling.
- The current implementation uses chunked MediaRecorder uploads for Gemini live captions plus final full-audio transcription; Live API should replace that in a separate architecture change.
