<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Cognitive Bridge

Cognitive Bridge is a web-based psychometric alignment application designed to calibrate and align an AI assistant's personality and communication style to match a user's unique cognitive profile.

## What This Project Is For

The application allows users to explore and interface with aligned artificial intelligence through three sequential modules:
1. **The Mirror (Psychometric Diagnostic)**: Engages the user in scenario-based stress tests to assess and map their Big Five (OCEAN) personality traits: Openness, Conscientiousness, Extroversion, Agreeableness, and Neuroticism.
2. **The Tailor (Synthesis)**: Synthesizes a customized cognitive profile from the diagnostic results and displays detailed mappings of how the user's personality traits adapt the AI's instruction set.
3. **The Bridge (Interfacing)**: Provides a chat playground allowing the user to communicate with both the aligned model (calibrated to their profile) and an unaligned model side-by-side to experience the difference.

---

## Getting Started & Installation

### Prerequisites
- **Node.js** (v20.x or higher recommended)
- **NPM** (comes with Node.js)
- The isolated `stack-overlord-demo-cog-bridge` Firebase sandbox for optional cloud-backed features
- *(Optional)* A **Google Gemini API Key** (only if running the offline psychometric agent evaluation script)

### Installation Steps

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```
   Open `.env.local` and configure your environment variables:
   ```env
   # Required only if running the psychometric agent evaluation script:
   GEMINI_API_KEY="your-gemini-api-key"

   APP_URL="http://localhost:3000"
   VITE_FIREBASE_API_KEY="your-sandbox-firebase-web-api-key"
   ```

   Firebase client configuration is pinned to the isolated
   `stack-overlord-demo-cog-bridge` project. This demo repository must never be
   configured to use the original Cognitive Bridge production project. Set the
   sandbox Web API key as the `VITE_FIREBASE_API_KEY` GitHub Actions secret for
   Firebase Hosting builds; do not commit it.

3. **Run the Application Locally:**
   ```bash
   npm run dev
   ```
   The application will start running on your local server (usually `http://localhost:3000` or `http://localhost:5173`).

---

## Data & Submission Locations

This project can integrate with **Cloud Firestore** in the isolated Firebase
sandbox to persist user session data and system feedback. Auth and Firestore
must be provisioned in that sandbox before those cloud-backed flows are used;
the Local Guest flow does not require them.

The live Firestore security-rule suite is disabled during normal `npm test`
runs. After Firestore and its rules are configured in the sandbox, run it
explicitly with:

```bash
npm run test:firestore:live
```

## Stack Overlord Deployment Demo

The manually dispatched `Sandbox Deployment Demo` workflow produces factual
GitHub Actions conclusions for Stack Overlord without writing to Firebase. Its
success path verifies that
<https://stack-overlord-demo-cog-bridge.web.app> returns HTTP 200, and its
failure path stops with a clearly labeled intentional error.

The workflow refuses to run outside this sandbox repository, names only the
`stack-overlord-demo-cog-bridge` Firebase project, has no cloud credential, and
never deploys Functions. Run it from `main` only after the Hosting-only safety
patch has been merged and the live Hosting deployment is healthy.

### 1. Mirror Interview Responses & Cognitive Profiles
When a user is logged in (using Google Authentication / Cloud Sync mode), their progress and responses are continuously saved:
- **Location**: Firestore Database -> **`users`** collection
- **Path**: `/users/{userId}` (where `{userId}` is the user's Firebase Auth UID)
- **Stored Fields**:
  - `scores`: The calibrated Big Five (OCEAN) personality scores map:
    - `openness`, `conscientiousness`, `extroversion`, `agreeableness`, `neuroticism` (values 0-100)
  - `mirrorMessages`: An array of messages from the psychometric diagnostic chat history (Mirror module), containing:
    - `role`: `'user'` or `'model'`
    - `content`: The message text (user responses and scenario questions)
  - `playgroundMessages`: Message history from the playground module.
  - `activeModule`: Current progress status (`mirror` | `tailor` | `playground`).
  - `updatedAt`: Timestamp of the last save.

*Note: If the user interacts as a **Local Guest** (not logged in), all session data is stored in the browser's local state and will not be sent to Cloud Firestore.*

### 2. User Feedback Submissions
When a user clicks "Leave Feedback" in the footer and submits the feedback form:
- **Location**: Firestore Database -> **`feedback`** collection
- **Path**: `/feedback/{documentId}` (auto-generated document ID)
- **Stored Fields**:
  - `name`: Name of the sender (defaults to `'Anonymous'` if left blank)
  - `email`: Sender's email address
  - `message`: Sender's feedback message
  - `createdAt`: Server-side Firestore timestamp of when it was submitted
- **Permissions & Security**: As per `firestore.rules`, the `feedback` collection is write-only for the public. Only authenticated Firestore administrators can view or manage these documents (via the Firebase Console).

---

## License

This project is licensed under the Apache-2.0 License.
