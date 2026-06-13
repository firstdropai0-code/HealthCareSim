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

## Backend Database

- Replace `localStorageProvider` with a backend implementation behind `storageProvider.ts`.
- Candidate stores: Firebase, Supabase, MongoDB, or PostgreSQL.
- Persist scenarios, simulation messages, feedback reports, and media metadata.

## Trainer and Trainee Login

- Add authentication before storing user-owned scenarios.
- Separate trainer permissions from trainee simulation access.
- Store ownership, session status, and audit metadata.

## Scenario Library

- Add saved scenario templates, search, duplication, and versioning.
- Support trainer notes and evaluation rubric presets.
- Keep generated scenarios editable before simulation starts.

## Analytics Dashboard

- Aggregate communication scores, completion rates, tension patterns, and repeated feedback themes.
- Avoid medical performance scoring unless reviewed by qualified clinical educators.
- Provide exportable training summaries for facilitators.
