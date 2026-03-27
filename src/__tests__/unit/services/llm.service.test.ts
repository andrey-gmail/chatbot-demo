import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildMessages, streamCompletion } from '@/services/llm.service';
import type { AssembledContext } from '@/services/message.service';

// Shared mock client instance so the same object is returned every time
const mockCreate = vi.fn();
const mockClientInstance = {
  chat: {
    completions: {
      create: mockCreate,
    },
  },
};

vi.mock('@/lib/openai/client', () => ({
  getOpenAIClient: vi.fn(() => mockClientInstance),
}));

describe('llm.service', () => {
  describe('buildMessages', () => {
    it('builds messages with system prompt and conversation history', () => {
      const context: AssembledContext = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' },
        ],
        documentContext: null,
        documentsTruncated: false,
      };

      const result = buildMessages(context);

      expect(result).toHaveLength(4); // system + 3 conversation messages
      expect(result[0].role).toBe('system');
      expect(result[1]).toEqual({ role: 'user', content: 'Hello' });
      expect(result[2]).toEqual({ role: 'assistant', content: 'Hi there!' });
      expect(result[3]).toEqual({ role: 'user', content: 'How are you?' });
    });

    it('includes document context in system message', () => {
      const context: AssembledContext = {
        messages: [{ role: 'user', content: 'What does the doc say?' }],
        documentContext: 'This is the document content.',
        documentsTruncated: false,
      };

      const result = buildMessages(context);

      expect(result[0].role).toBe('system');
      expect(result[0].content).toContain('This is the document content.');
    });

    it('skips system role messages from conversation history', () => {
      const context: AssembledContext = {
        messages: [
          { role: 'system', content: 'Old system msg' },
          { role: 'user', content: 'Hello' },
        ],
        documentContext: null,
        documentsTruncated: false,
      };

      const result = buildMessages(context);

      // Should have system prompt + user message only (old system msg skipped)
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('system');
      expect(result[1]).toEqual({ role: 'user', content: 'Hello' });
    });
  });

  describe('streamCompletion', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('yields tokens from the OpenAI stream', async () => {
      const mockChunks = [
        { choices: [{ delta: { content: 'Hello' } }] },
        { choices: [{ delta: { content: ' world' } }] },
        { choices: [{ delta: { content: '!' } }] },
        { choices: [{ delta: {} }] }, // final chunk with no content
      ];

      // Create an async iterable from the mock chunks
      const asyncIterable = {
        async *[Symbol.asyncIterator]() {
          for (const chunk of mockChunks) {
            yield chunk;
          }
        },
      };

      mockCreate.mockResolvedValue(asyncIterable);

      const messages = [{ role: 'user' as const, content: 'Hi' }];
      const tokens: string[] = [];

      for await (const token of streamCompletion(messages)) {
        tokens.push(token);
      }

      expect(tokens).toEqual(['Hello', ' world', '!']);
    });

    it('passes model and temperature options', async () => {
      const asyncIterable = {
        async *[Symbol.asyncIterator]() {
          // empty stream
        },
      };

      mockCreate.mockResolvedValue(asyncIterable);

      const messages = [{ role: 'user' as const, content: 'Hi' }];
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of streamCompletion(messages, { model: 'gpt-4o', temperature: 0.5 })) {
        // consume
      }

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          stream: true,
          temperature: 0.5,
        })
      );
    });
  });
});
