import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FeedbackModal from '../FeedbackModal';

// Mock firestore functions
const mockAddDoc = vi.fn((_ref?: any, _data?: any) => Promise.resolve({ id: 'mock-doc-id' }));
const mockCollection = vi.fn((_db?: any, _path?: string) => 'mock-collection-ref');
const mockServerTimestamp = vi.fn(() => 'mock-timestamp-value');

vi.mock('firebase/firestore', () => ({
  collection: (db: any, path: string) => mockCollection(db, path),
  addDoc: (reference: any, data: any) => mockAddDoc(reference, data),
  serverTimestamp: () => mockServerTimestamp(),
}));

// Mock firebase config/db initialization
vi.mock('../../services/firebase', () => ({
  db: 'mock-db-instance',
}));

describe('FeedbackModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<FeedbackModal isOpen={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly when isOpen is true', () => {
    render(<FeedbackModal isOpen={true} onClose={() => {}} />);
    
    expect(screen.getByText('Send Feedback')).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Message/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('calls onClose when close button or cancel is clicked', () => {
    const handleClose = vi.fn();
    render(<FeedbackModal isOpen={true} onClose={handleClose} />);
    
    // Close button (X)
    const closeBtn = screen.getByLabelText(/Close feedback modal/i);
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Cancel button
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('calls onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(<FeedbackModal isOpen={true} onClose={handleClose} />);
    
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('shows error if required fields are missing', async () => {
    render(<FeedbackModal isOpen={true} onClose={() => {}} />);
    
    const form = screen.getByTestId('feedback-form');
    fireEvent.submit(form);

    // Should display validation error
    expect(screen.getByTestId('error-banner')).toBeInTheDocument();
    expect(screen.getByText('Please fill in all required fields.')).toBeInTheDocument();
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('shows error for invalid email formats', async () => {
    render(<FeedbackModal isOpen={true} onClose={() => {}} />);
    
    const emailInput = screen.getByLabelText(/Email Address/i);
    const messageInput = screen.getByLabelText(/Message/i);
    const form = screen.getByTestId('feedback-form');

    // Type invalid email
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.change(messageInput, { target: { value: 'This is a great app!' } });
    fireEvent.submit(form);

    expect(screen.getByTestId('error-banner')).toBeInTheDocument();
    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('submits successfully when fields are filled and valid', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'mock-doc-id' });
    const handleClose = vi.fn();
    
    render(<FeedbackModal isOpen={true} onClose={handleClose} />);
    
    const nameInput = screen.getByLabelText(/Name/i);
    const emailInput = screen.getByLabelText(/Email Address/i);
    const messageInput = screen.getByLabelText(/Message/i);
    const form = screen.getByTestId('feedback-form');

    fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });
    fireEvent.change(emailInput, { target: { value: 'jane@example.com' } });
    fireEvent.change(messageInput, { target: { value: 'Amazing experience!' } });

    fireEvent.submit(form);

    // Should show loading state
    expect(screen.getByText('Sending...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockCollection).toHaveBeenCalledWith('mock-db-instance', 'feedback');
      expect(mockAddDoc).toHaveBeenCalledWith('mock-collection-ref', {
        name: 'Jane Doe',
        email: 'jane@example.com',
        message: 'Amazing experience!',
        createdAt: 'mock-timestamp-value',
      });
    });

    // Success view should be shown
    await waitFor(() => {
      expect(screen.getByTestId('success-view')).toBeInTheDocument();
      expect(screen.getByText('Thank you!')).toBeInTheDocument();
    });

    // Clicking close on success view triggers onClose
    const closeSuccessBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeSuccessBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('submits successfully as anonymous if name is empty', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'mock-doc-id' });
    
    render(<FeedbackModal isOpen={true} onClose={() => {}} />);
    
    const emailInput = screen.getByLabelText(/Email Address/i);
    const messageInput = screen.getByLabelText(/Message/i);
    const form = screen.getByTestId('feedback-form');

    fireEvent.change(emailInput, { target: { value: 'anonymous@example.com' } });
    fireEvent.change(messageInput, { target: { value: 'Hello' } });

    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalledWith('mock-collection-ref', {
        name: 'Anonymous',
        email: 'anonymous@example.com',
        message: 'Hello',
        createdAt: 'mock-timestamp-value',
      });
    });
  });

  it('displays error if Firestore write fails', async () => {
    mockAddDoc.mockRejectedValueOnce(new Error('Firebase network error'));
    
    render(<FeedbackModal isOpen={true} onClose={() => {}} />);
    
    const emailInput = screen.getByLabelText(/Email Address/i);
    const messageInput = screen.getByLabelText(/Message/i);
    const form = screen.getByTestId('feedback-form');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(messageInput, { target: { value: 'Hello' } });

    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByTestId('error-banner')).toBeInTheDocument();
      expect(screen.getByText('Firebase network error')).toBeInTheDocument();
    });
  });
});
