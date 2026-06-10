import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockGenerateContent, mockGenerateContentStream, mockListModels } = vi.hoisted(() => {
  return {
    mockGenerateContent: vi.fn(),
    mockGenerateContentStream: vi.fn(),
    mockListModels: vi.fn(),
  };
});

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: mockGenerateContent,
        generateContentStream: mockGenerateContentStream,
        list: mockListModels,
      };
    }
  };
});

// Import the module after mocking
import {
  parseModelName,
  getDynamicModelFallbacks,
  isTransientError,
  chatWithGemini,
  chatWithGeminiStream,
  activeModelsCache,
  refreshActiveModelsList
} from '../gemini';

describe('Gemini Service Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the cache for each test
    activeModelsCache.length = 0;
    mockListModels.mockResolvedValue([]);
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

    it('returns dynamic fallback list when activeModelsCache is populated', () => {
      // Simulate populated cache
      activeModelsCache.push(
        'models/gemini-3.5-flash',
        'models/gemini-3.1-pro-preview',
        'models/gemini-3-flash-preview',
        'models/gemini-2.5-flash',
        'models/gemini-2.5-pro',
        'models/gemini-1.5-flash'
      );

      const fallbacks = getDynamicModelFallbacks('gemini-3-flash-preview');
      // Should include the requested model first
      expect(fallbacks[0]).toBe('gemini-3-flash-preview');
      // For a flash model, fallback should prioritize newer flash models under it, then pro/lite models
      // We filter out versions higher than requested (so no 3.5-flash)
      // Ordered: gemini-3-flash-preview (requested), gemini-2.5-flash, gemini-1.5-flash, gemini-2.5-pro, etc.
      expect(fallbacks).toContain('gemini-2.5-flash');
      expect(fallbacks).toContain('gemini-1.5-flash');
      expect(fallbacks.indexOf('gemini-2.5-flash')).toBeLessThan(fallbacks.indexOf('gemini-1.5-flash'));
    });
  });

  describe('chatWithGemini', () => {
    it('returns response successfully on first attempt', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: 'Hello!' });

      const response = await chatWithGemini([{ role: 'user', content: 'Hi' }]);
      expect(response).toBe('Hello!');
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('retries on transient error and succeeds', async () => {
      // First attempt fails with 503, second succeeds
      mockGenerateContent
        .mockRejectedValueOnce({ code: 503, message: 'Unavailable' })
        .mockResolvedValueOnce({ text: 'Succeeded after retry!' });

      const response = await chatWithGemini([{ role: 'user', content: 'Hi' }]);
      expect(response).toBe('Succeeded after retry!');
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('falls back to next model when all retries fail', async () => {
      // First model (primary): 2 failed attempts
      mockGenerateContent
        .mockRejectedValueOnce({ code: 503, message: 'Unavailable' })
        .mockRejectedValueOnce({ code: 503, message: 'Unavailable' })
        // Second model (fallback): succeeds on first attempt
        .mockResolvedValueOnce({ text: 'Fallback model succeeded!' });

      const response = await chatWithGemini([{ role: 'user', content: 'Hi' }], undefined, 'gemini-3-flash-preview');
      expect(response).toBe('Fallback model succeeded!');
      // Expect 3 calls total (2 for primary model, 1 for first fallback model)
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });
  });

  describe('chatWithGeminiStream', () => {
    it('yields chunks successfully', async () => {
      // Mock stream iterator
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { text: 'Part 1, ' };
          yield { text: 'Part 2.' };
        }
      };
      mockGenerateContentStream.mockResolvedValueOnce(mockStream);

      const stream = chatWithGeminiStream([{ role: 'user', content: 'Hi' }]);
      const chunks: string[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Part 1, ', 'Part 2.']);
      expect(mockGenerateContentStream).toHaveBeenCalledTimes(1);
    });

    it('retries on pre-stream transient error and succeeds', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { text: 'Success!' };
        }
      };

      mockGenerateContentStream
        .mockRejectedValueOnce({ code: 503, message: 'Unavailable' })
        .mockResolvedValueOnce(mockStream);

      const stream = chatWithGeminiStream([{ role: 'user', content: 'Hi' }]);
      const chunks: string[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Success!']);
      expect(mockGenerateContentStream).toHaveBeenCalledTimes(2);
    });

    it('falls back to next model on pre-stream failure', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { text: 'Fallback success!' };
        }
      };

      mockGenerateContentStream
        .mockRejectedValueOnce({ code: 503, message: 'Unavailable' })
        .mockRejectedValueOnce({ code: 503, message: 'Unavailable' })
        .mockResolvedValueOnce(mockStream);

      const stream = chatWithGeminiStream([{ role: 'user', content: 'Hi' }], undefined, 'gemini-3-flash-preview');
      const chunks: string[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Fallback success!']);
      expect(mockGenerateContentStream).toHaveBeenCalledTimes(3);
    });

    it('aborts retry/fallback if error occurs mid-stream', async () => {
      // Mock stream that throws mid-stream
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { text: 'Part 1' };
          throw new Error('Mid-stream connection loss');
        }
      };
      mockGenerateContentStream.mockResolvedValueOnce(mockStream);

      const stream = chatWithGeminiStream([{ role: 'user', content: 'Hi' }]);
      const chunks: string[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Should yield the first chunk and then the error notification, but not retry from the start
      expect(chunks[0]).toBe('Part 1');
      expect(chunks[chunks.length - 1]).toContain('Stream interrupted');
      expect(mockGenerateContentStream).toHaveBeenCalledTimes(1);
    });
  });
});
