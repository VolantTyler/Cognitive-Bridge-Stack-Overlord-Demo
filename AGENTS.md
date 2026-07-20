# AGENTS.md

## Cursor Cloud specific instructions

Cognitive Bridge is a single-page **Vite + React 19 + TypeScript** web app (an AI Studio applet) that maps a user's OCEAN personality traits to AI steering directives. It uses the **Gemini API** (`@google/genai`) for chat and **Firebase** (Firestore/Auth/Analytics) for persistence. Standard commands live in `package.json` `scripts`.

### Services
There is one primary service: the Vite dev web app. A secondary Python script (`scripts/agent_eval.py` + `requirements.txt`) exists only for the CI "Psychometric Agent Evaluation" workflow and is not part of the local dev loop.

### Running / building / linting / testing
- Dev server: `npm run dev` (serves on port 3000, host `0.0.0.0`).
- Lint: `npm run lint` (this is `tsc --noEmit`, a typecheck — there is no ESLint).
- Build: `npm run build`.
- Tests: `npm run test` (Vitest).

### Non-obvious caveats
- The Vitest suite includes an opt-in LIVE Firestore integration test (`src/components/__tests__/FeedbackRules.integration.test.ts`). Normal `npm test` runs skip it. Run `npm run test:firestore:live` only after Firestore and its rules are configured in the isolated `stack-overlord-demo-cog-bridge` sandbox.
- The live integration test writes a real document to the sandbox `feedback` collection. Its global teardown (`src/test/globalSetup.ts`) explicitly scopes deletion to `stack-overlord-demo-cog-bridge`; never change it to target the original production project.
- **Vertex AI & Firebase Functions** handle the AI chat features (the Mirror diagnostic chat and the Playground/Bridge comparison) in the web application. When running locally via Firebase emulators, the Cloud Function proxy expects Application Default Credentials (ADC) configured in the local shell.
- **`GEMINI_API_KEY`** is only required if running the offline psychometric agent evaluation script (`scripts/agent_eval.py`). Set it in a `.env.local` file at the repo root (`GEMINI_API_KEY="..."`). Without it, running the python script will raise a configuration error.
- You can exercise the core flow end-to-end in the UI **without** running the Firebase Functions or having Google Cloud access: on "The Mirror", use a "pre-calibrated test profile" preset button to set OCEAN scores, then proceed to "The Tailor" (directive mapping) and "The Bridge". Only the live chat sessions require the backend function running.
