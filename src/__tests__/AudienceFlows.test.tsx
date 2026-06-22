/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import App from '../App';

// Setup Mocks before importing firebase functions
vi.mock('../services/firebase', () => ({
  auth: {
    currentUser: null,
  },
  db: {},
  googleProvider: {},
  logAnalyticsEvent: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    // Start as local guest (unauthenticated)
    callback(null);
    return () => {};
  }),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
}));

vi.mock('../services/gemini', () => ({
  chatWithGeminiStream: vi.fn(async function* (messages: any) {
    // If it's the 5th message or contains the JSON_SCORES trigger
    const isFifthQuestion = messages.length >= 9; // 5 user messages + 4 model messages
    if (isFifthQuestion) {
      yield 'Diagnostic finished.\nJSON_SCORES:\n{\n  "openness": 75,\n  "conscientiousness": 75,\n  "extroversion": 75,\n  "agreeableness": 75,\n  "neuroticism": 75\n}\n';
    } else {
      yield 'That is interesting. Let\'s continue. (Question 2/5)';
    }
  }),
}));

describe('Audience Flow Integration Tests (Adult vs Child Modes)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders default Adult mode and allows switching to K-12 Child mode', async () => {
    render(<App />);

    // Should default to Adult mode Mirror page
    expect(screen.getByText('Make Your AI Fit You')).toBeInTheDocument();
    expect(screen.getByText(/architecture of your mind/i)).toBeInTheDocument();
    expect(screen.getByText('High Extroversion and Neuroticism')).toBeInTheDocument();

    // Toggle to Child Mode
    const childToggleBtn = screen.getByRole('button', { name: /K-12 Child Mode/i });
    fireEvent.click(childToggleBtn);

    // Verify it changed to Kid's Mirror
    await waitFor(() => {
      expect(screen.getByText('Make Your AI Help You Play & Learn')).toBeInTheDocument();
      expect(screen.getByText(/learn how you think and play/i)).toBeInTheDocument();
      expect(screen.getByText('Super Energetic & Easily Worried')).toBeInTheDocument();
    });

    // Toggle back to Adult Mode
    const adultToggleBtn = screen.getByRole('button', { name: /Adult Mode/i });
    fireEvent.click(adultToggleBtn);
    await waitFor(() => {
      expect(screen.getByText('Make Your AI Fit You')).toBeInTheDocument();
    });
  });

  it('completes the diagnostic and proceeds through the full flow in Adult mode', async () => {
    render(<App />);

    // Click a preset button to instantly calculate scores and proceed
    const presetBtn = screen.getByText('High Extroversion and Neuroticism');
    fireEvent.click(presetBtn);

    // Verify calibration is complete and proceed button appears
    await waitFor(() => {
      expect(screen.getByText('Personality mapping calculated. Ready to proceed.')).toBeInTheDocument();
    });

    const proceedBtn = screen.getByRole('button', { name: /Proceed to Phase 2/i });
    fireEvent.click(proceedBtn);

    // Verify Tailor page is displayed
    await waitFor(() => {
      expect(screen.getByText('The "Tailor" Synthesis')).toBeInTheDocument();
      expect(screen.getByText('Initialize Aligned Agent')).toBeInTheDocument();
    });

    // Click "Initialize Aligned Agent" to go to phase 3 (Playground)
    const initAgentBtn = screen.getByRole('button', { name: /Initialize Aligned Agent/i });
    fireEvent.click(initAgentBtn);

    // Verify Playground page is displayed
    await waitFor(() => {
      expect(screen.getByText('Interfacing with Aligned Intelligence')).toBeInTheDocument();
    });
  });

  it('allows switching between Adult and Child mode independently maintaining separate progress states', async () => {
    render(<App />);

    // 1. Complete Adult mode via preset
    fireEvent.click(screen.getByText('High Extroversion and Neuroticism'));
    await waitFor(() => {
      expect(screen.getByText('Proceed to Phase 2: The Tailor')).toBeInTheDocument();
    });

    // 2. Switch to Child mode (where diagnostic has not started yet)
    fireEvent.click(screen.getByRole('button', { name: /K-12 Child Mode/i }));
    await waitFor(() => {
      expect(screen.getByText('Make Your AI Help You Play & Learn')).toBeInTheDocument();
      expect(screen.queryByText('Proceed to Phase 2: The Tailor')).toBeNull(); // Child mode is still on Mirror phase 1
    });

    // 3. Switch back to Adult mode and confirm it is still on the completed phase
    fireEvent.click(screen.getByRole('button', { name: /Adult Mode/i }));
    await waitFor(() => {
      expect(screen.getByText('Proceed to Phase 2: The Tailor')).toBeInTheDocument();
    });
  });

  it('resets profiles independently and displays confirmation warning', async () => {
    render(<App />);

    // Start a chat diagnostic in Adult mode to show "Reset Chat" button
    const input = screen.getByPlaceholderText('Respond to the scenario...');
    fireEvent.change(input, { target: { value: 'I would dirty-hack it.' } });
    
    const sendButton = screen.getByRole('button', { name: '' }); // the submit button is a Send icon
    fireEvent.click(sendButton);

    // Reset Chat button should now be visible in the card header
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Reset Chat/i })).toBeInTheDocument();
    });

    // Click Reset Chat
    fireEvent.click(screen.getByRole('button', { name: /Reset Chat/i }));

    // Verify warning modal is shown
    await waitFor(() => {
      expect(screen.getByText('Irreversible Profile Reset')).toBeInTheDocument();
      expect(screen.getByText(/permanently delete your responses/i)).toBeInTheDocument();
    });

    // Click Cancel in modal
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    await waitFor(() => {
      expect(screen.queryByText('Irreversible Profile Reset')).toBeNull();
    });

    // Click Reset Chat again and confirm
    fireEvent.click(screen.getByRole('button', { name: /Reset Chat/i }));
    await waitFor(() => {
      expect(screen.getByText('Irreversible Profile Reset')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Yes, Reset Profile/i }));

    // Verify diagnostic was reset (input and state cleared)
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Reset Chat/i })).toBeNull();
    });
  });

  it('handles answering questions, switching profile types, and resetting profiles independently without cross-contamination', async () => {
    render(<App />);

    // 1. In Adult Mode, answer a question
    const adultInput = screen.getByPlaceholderText('Respond to the scenario...');
    fireEvent.change(adultInput, { target: { value: 'I prefer logical structures and maps.' } });
    const sendButton = screen.getByRole('button', { name: '' });
    fireEvent.click(sendButton);

    // Verify Adult Mode shows the response
    await waitFor(() => {
      expect(screen.getByText('I prefer logical structures and maps.')).toBeInTheDocument();
      expect(screen.getByText(/That is interesting/i)).toBeInTheDocument();
    });

    // 2. Switch to K-12 Child Mode
    fireEvent.click(screen.getByRole('button', { name: /K-12 Child Mode/i }));
    await waitFor(() => {
      expect(screen.getByText('Make Your AI Help You Play & Learn')).toBeInTheDocument();
      // Verify Child Mode does not show the Adult user's response
      expect(screen.queryByText('I prefer logical structures and maps.')).toBeNull();
    });

    // 3. In Child Mode, answer a question
    const childInput = screen.getByPlaceholderText('Respond to the scenario...');
    fireEvent.change(childInput, { target: { value: 'I like building block castles!' } });
    const childSendButton = screen.getByRole('button', { name: '' });
    fireEvent.click(childSendButton);

    // Verify Child Mode shows the child response
    await waitFor(() => {
      expect(screen.getByText('I like building block castles!')).toBeInTheDocument();
    });

    // 4. Switch back to Adult Mode
    fireEvent.click(screen.getByRole('button', { name: /Adult Mode/i }));
    await waitFor(() => {
      expect(screen.getByText('Make Your AI Fit You')).toBeInTheDocument();
      // Verify Adult Mode still has the adult response and NOT the child response
      expect(screen.getByText('I prefer logical structures and maps.')).toBeInTheDocument();
      expect(screen.queryByText('I like building block castles!')).toBeNull();
    });

    // 5. Reset Adult Mode profile
    fireEvent.click(screen.getByRole('button', { name: /Reset Chat/i }));
    await waitFor(() => {
      expect(screen.getByText('Irreversible Profile Reset')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Yes, Reset Profile/i }));

    // Verify Adult Mode is reset
    await waitFor(() => {
      expect(screen.queryByText('I prefer logical structures and maps.')).toBeNull();
    });

    // 6. Switch back to Child Mode and verify it is NOT affected by the Adult reset
    fireEvent.click(screen.getByRole('button', { name: /K-12 Child Mode/i }));
    await waitFor(() => {
      expect(screen.getByText('I like building block castles!')).toBeInTheDocument();
    });

    // 7. Reset Child Mode profile
    fireEvent.click(screen.getByRole('button', { name: /Reset Chat/i }));
    await waitFor(() => {
      expect(screen.getByText('Irreversible Profile Reset')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Yes, Reset Profile/i }));

    // Verify Child Mode is reset
    await waitFor(() => {
      expect(screen.queryByText('I like building block castles!')).toBeNull();
    });
  });
});

