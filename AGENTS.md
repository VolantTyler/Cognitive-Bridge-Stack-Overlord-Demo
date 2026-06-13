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
- **The Vitest suite includes a LIVE Firestore integration test** (`src/components/__tests__/FeedbackRules.integration.test.ts`). It connects to the real Firebase project using the public config hardcoded in `src/services/firebase.ts`, so it **requires network access** and is not hermetic.
- That integration test writes a real document to the `feedback` collection. The Vitest global teardown (`src/test/globalSetup.ts`) tries to delete it with `npx firebase-tools firestore:delete`, which **fails with "Failed to authenticate, have you run firebase login?"** unless firebase-tools is authenticated. This prints a noisy error after the results but does **not** fail the run — `npm run test` still exits 0 with all tests passing. Ignore the teardown error unless you have Firebase credentials.
- **`GEMINI_API_KEY` is required for the AI chat features** (the Mirror diagnostic chat and the Playground/Bridge comparison). It is read from `process.env.GEMINI_API_KEY` (injected by Vite's `define`). Set it in a `.env.local` file at the repo root (`GEMINI_API_KEY="..."`). Without it, chat calls return a generic error string, but the rest of the app still works.
- You can exercise the core flow end-to-end **without** a Gemini key: on "The Mirror", use a "pre-calibrated test profile" preset button to set OCEAN scores, then proceed to "The Tailor" (directive mapping) and "The Bridge". Only the live chat boxes need the key.
- HMR can be disabled via the `DISABLE_HMR=true` env var (used by AI Studio); leave it unset for normal local development with hot reload.
