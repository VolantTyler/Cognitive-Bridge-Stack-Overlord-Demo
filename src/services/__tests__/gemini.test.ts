import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Import the module after mocking
import {
  parseModelName,
  getDynamicModelFallbacks,
  isTransientError,
  chatWithGemini,
  chatWithGeminiStream,
  activeModelsCache
} from '../gemini';

describe('Gemini Service Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    activeModelsCache.length = 0;
  });

  describe('parseModelName', () => {
    it('correctly parses model parameters', () => {
      expect(parseModelName('gemini-3.5-flash')).toEqual({
        name: 'gemini-3.5-flash',
        version: 3.5,
        isPro: false,
        isFlash: true,
        isLite: false,
        isPreview: false
      });

      expect(parseModelName('models/gemini-3.1-pro-preview')).toEqual({
        name: 'models/gemini-3.1-pro-preview',
        version: 3.1,
        isPro: true,
        isFlash: false,
        isLite: false,
        isPreview: true
      });

      expect(parseModelName('gemini-2.5-flash-lite')).toEqual({
        name: 'gemini-2.5-flash-lite',
        version: 2.5,
        isPro: false,
        isFlash: false,
        isLite: true,
        isPreview: false
      });
    });
  });

  describe('isTransientError', () => {
    it('correctly identifies transient (503 / Unavailable / High Demand) errors', () => {
      expect(isTransientError({ code: 503 })).toBe(true);
      expect(isTransientError({ status: 503 })).toBe(true);
      expect(isTransientError({ error: { code: 503 } })).toBe(true);
      expect(isTransientError({ error: { message: '{"code": 503, "status": "UNAVAILABLE"}' } })).toBe(true);
      expect(isTransientError(new Error('This model is currently experiencing high demand.'))).toBe(true);
      expect(isTransientError(new Error('service unavailable'))).toBe(true);
      expect(isTransientError(new Error('Some generic 400 Bad Request error'))).toBe(false);
      expect(isTransientError(null)).toBe(false);
    });
  });

  describe('getDynamicModelFallbacks', () => {
    it('returns static fallback hierarchy when activeModelsCache is empty', () => {
      const fallbacks = getDynamicModelFallbacks('gemini-3-flash-preview');
      expect(fallbacks[0]).toBe('gemini-3-flash-preview');
      expect(fallbacks.length).toBeGreaterThan(1);
      expect(fallbacks).toContain('gemini-2.5-flash');
      expect(fallbacks).toContain('gemini-1.5-flash');
    });
  });

  describe('chatWithGemini', () => {
    it('returns response successfully on first attempt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'Hello!' })
      });

      const response = await chatWithGemini([{ role: 'user', content: 'Hi' }]);
      expect(response).toBe('Hello!');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('handles HTTP error gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      const response = await chatWithGemini([{ role: 'user', content: 'Hi' }]);
      expect(response).toBe('I encountered an error connecting to the intelligence bridge.');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('chatWithGeminiStream', () => {
    it('yields chunks successfully', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"text":"Part 1, "}\n'));
          controller.enqueue(new TextEncoder().encode('data: {"text":"Part 2."}\n'));
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n'));
          controller.close();
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream
      });

      const stream = chatWithGeminiStream([{ role: 'user', content: 'Hi' }]);
      const chunks: string[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Part 1, ', 'Part 2.']);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('handles stream errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      const stream = chatWithGeminiStream([{ role: 'user', content: 'Hi' }]);
      const chunks: string[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks[chunks.length - 1]).toContain('Error connecting to the stream.');
    });
  });
});
