export interface ReleaseVersion {
  version: string;
  date: string;
  title: string;
  description: string;
  highlights: string[];
  type: 'major' | 'minor' | 'patch';
}

export const RELEASE_NOTES: ReleaseVersion[] = [
  {
    version: 'v1.5.0',
    date: 'June 22, 2026',
    title: 'Release Notes & Stability improvements',
    type: 'minor',
    description: 'Introducing interactive release notes directly in the platform, along with UI optimizations and performance stability upgrades.',
    highlights: [
      'Added interactive Release Notes timeline modal (accessible via footer version link).',
      'Enhanced theme transitions and typography styling for a more premium visual experience.',
      'Optimized Firebase Firestore streams and user session auto-sync.',
      'Polished modal accessibility and keyboard/Escape navigation behavior.'
    ]
  },
  {
    version: 'v1.4.0',
    date: 'May 18, 2026',
    title: 'Local Inference & Hybrid Execution',
    type: 'minor',
    description: 'We added support for offline execution, allowing developers to run inference through Ollama local instances.',
    highlights: [
      'Integrated Ollama API proxy with support for local models like Llama 3 and Mistral.',
      'Added Local Inference configuration settings for local web developers.',
      'Completed seamless dark/light mode toggle sync persisted in localStorage.',
      'Rebuilt responsiveness for mobile and tablet navigation layouts.'
    ]
  },
  {
    version: 'v1.2.0',
    date: 'April 05, 2026',
    title: 'Cloud Synchronization & Authentication',
    type: 'minor',
    description: 'Secure cloud session management has arrived, allowing users to save and sync profiles and message history.',
    highlights: [
      'Integrated Firebase Auth with Google Single Sign-On (SSO) popup support.',
      'Added Firestore real-time database persistence for guest-to-cloud session migration.',
      'Introduced Feedback capture submission rules and Firebase analytics events.',
      'Created standard integration test suite for automated security and rule verification.'
    ]
  },
  {
    version: 'v1.0.0',
    date: 'March 12, 2026',
    title: 'Cognitive Bridge Initial Launch',
    type: 'major',
    description: 'First public deployment of the Cognitive Bridge AI applet for OCEAN personality steering.',
    highlights: [
      'The Mirror: Diagnostic conversational profiling using Gemini API to identify OCEAN traits.',
      'The Tailor: Dynamic prompt synthesis translating psychological scores into customized AI instructions.',
      'The Bridge: Live parallel chat playground to contrast aligned and unaligned AI agent behaviors.',
      'Engineered core CSS design system with curated gradient palettes and glassmorphic layouts.'
    ]
  }
];
