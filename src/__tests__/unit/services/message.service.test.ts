import { describe, it, expect, vi } from 'vitest';
import * as messageService from '@/services/message.service';
import { MessageServiceError } from '@/services/message.service';

function createChainMock(resolvedValue: { data: unknown; error: unknown }) {
  const mock: Record<string, ReturnType<typeof vi.fn>> = {};
  mock.single = vi.fn().mockResolvedValue(resolvedValue);
  mock.select = vi.fn(() => mock);
  mock.eq = vi.fn(() => mock);
  mock.order = vi.fn(() => mock);
  mock.insert = vi.fn(() => mock);

  // Terminal calls that don't chain to single()
  mock.order.mockResolvedValue(resolvedValue);

  return mock;
}

function createMockSupabase(chainMock: ReturnType<typeof createChainMock>) {
  return {
    from: vi.fn(() => chainMock),
  } as unknown as Parameters<typeof messageService.create>[0];
}

describe('message.service', () => {
  describe('create', () => {
    it('creates a user message', async () => {
      const mockMessage = {
        id: 'msg-1',
        chat_id: 'chat-1',
        role: 'user',
        content: 'Hello',
        image_url: null,
        created_at: '2024-01-01T00:00:00Z',
      };
      const chain = createChainMock({ data: mockMessage, error: null });
      const supabase = createMockSupabase(chain);

      const result = await messageService.create(supabase, 'chat-1', 'user', 'Hello');

      expect(result).toEqual(mockMessage);
      expect(chain.insert).toHaveBeenCalledWith({
        chat_id: 'chat-1',
        role: 'user',
        content: 'Hello',
        image_url: null,
      });
    });

    it('creates a message with image URL', async () => {
      const mockMessage = {
        id: 'msg-2',
        chat_id: 'chat-1',
        role: 'user',
        content: 'Look at this',
        image_url: 'https://example.com/img.png',
        created_at: '2024-01-01T00:00:00Z',
      };
      const chain = createChainMock({ data: mockMessage, error: null });
      const supabase = createMockSupabase(chain);

      const result = await messageService.create(
        supabase, 'chat-1', 'user', 'Look at this', 'https://example.com/img.png'
      );

      expect(result).toEqual(mockMessage);
      expect(chain.insert).toHaveBeenCalledWith({
        chat_id: 'chat-1',
        role: 'user',
        content: 'Look at this',
        image_url: 'https://example.com/img.png',
      });
    });

    it('throws MessageServiceError on database error', async () => {
      const chain = createChainMock({ data: null, error: { message: 'insert failed' } });
      const supabase = createMockSupabase(chain);

      await expect(
        messageService.create(supabase, 'chat-1', 'user', 'Hello')
      ).rejects.toThrow(MessageServiceError);
      await expect(
        messageService.create(supabase, 'chat-1', 'user', 'Hello')
      ).rejects.toThrow('Failed to create message');
    });
  });

  describe('listByChatId', () => {
    it('returns messages in chronological order', async () => {
      const mockMessages = [
        { id: 'msg-1', chat_id: 'chat-1', role: 'user', content: 'Hi', created_at: '2024-01-01T00:00:00Z' },
        { id: 'msg-2', chat_id: 'chat-1', role: 'assistant', content: 'Hello!', created_at: '2024-01-01T00:00:01Z' },
      ];
      const chain = createChainMock({ data: mockMessages, error: null });
      const supabase = createMockSupabase(chain);

      const result = await messageService.listByChatId(supabase, 'chat-1');

      expect(result).toEqual(mockMessages);
      expect(chain.eq).toHaveBeenCalledWith('chat_id', 'chat-1');
      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: true });
    });

    it('returns empty array when no messages exist', async () => {
      const chain = createChainMock({ data: [], error: null });
      const supabase = createMockSupabase(chain);

      const result = await messageService.listByChatId(supabase, 'chat-1');

      expect(result).toEqual([]);
    });

    it('throws MessageServiceError on database error', async () => {
      const chain = createChainMock({ data: null, error: { message: 'query failed' } });
      const supabase = createMockSupabase(chain);

      await expect(
        messageService.listByChatId(supabase, 'chat-1')
      ).rejects.toThrow('Failed to fetch messages');
    });
  });

  describe('assembleContext', () => {
    it('assembles messages and document context', async () => {
      const mockMessages = [
        { id: 'msg-1', chat_id: 'chat-1', role: 'user', content: 'What is this?', image_url: null, created_at: '2024-01-01T00:00:00Z' },
        { id: 'msg-2', chat_id: 'chat-1', role: 'assistant', content: 'It is a test.', image_url: null, created_at: '2024-01-01T00:00:01Z' },
      ];
      const mockDocuments = [
        { extracted_text: 'Document content here' },
      ];

      const supabase = {
        from: vi.fn((table: string) => {
          if (table === 'messages') {
            const chain = createChainMock({ data: mockMessages, error: null });
            return chain;
          }
          // documents table
          const docChain: Record<string, ReturnType<typeof vi.fn>> = {};
          docChain.select = vi.fn(() => docChain);
          docChain.eq = vi.fn(() => docChain);
          // Last eq call resolves
          let eqCallCount = 0;
          docChain.eq = vi.fn(() => {
            eqCallCount++;
            if (eqCallCount >= 2) {
              return Promise.resolve({ data: mockDocuments, error: null });
            }
            return docChain;
          });
          return docChain;
        }),
      } as unknown as Parameters<typeof messageService.assembleContext>[0];

      const result = await messageService.assembleContext(supabase, 'chat-1');

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toBe('What is this?');
      expect(result.documentContext).toBe('Document content here');
      expect(result.documentsTruncated).toBe(false);
    });

    it('returns null documentContext when no documents exist', async () => {
      const mockMessages = [
        { id: 'msg-1', chat_id: 'chat-1', role: 'user', content: 'Hello', image_url: null, created_at: '2024-01-01T00:00:00Z' },
      ];

      const supabase = {
        from: vi.fn((table: string) => {
          if (table === 'messages') {
            return createChainMock({ data: mockMessages, error: null });
          }
          const docChain: Record<string, ReturnType<typeof vi.fn>> = {};
          docChain.select = vi.fn(() => docChain);
          let eqCallCount = 0;
          docChain.eq = vi.fn(() => {
            eqCallCount++;
            if (eqCallCount >= 2) {
              return Promise.resolve({ data: [], error: null });
            }
            return docChain;
          });
          return docChain;
        }),
      } as unknown as Parameters<typeof messageService.assembleContext>[0];

      const result = await messageService.assembleContext(supabase, 'chat-1');

      expect(result.messages).toHaveLength(1);
      expect(result.documentContext).toBeNull();
      expect(result.documentsTruncated).toBe(false);
    });
  });
});
