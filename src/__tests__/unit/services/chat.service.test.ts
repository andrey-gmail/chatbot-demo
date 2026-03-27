import { describe, it, expect, vi } from 'vitest';
import * as chatService from '@/services/chat.service';
import { ChatServiceError } from '@/services/chat.service';

// Helper to create a chainable mock for Supabase query builder
function createChainMock(resolvedValue: { data: unknown; error: unknown }) {
  const mock: Record<string, ReturnType<typeof vi.fn>> = {};
  mock.single = vi.fn().mockResolvedValue(resolvedValue);
  mock.select = vi.fn(() => mock);
  mock.eq = vi.fn(() => mock);
  mock.order = vi.fn(() => mock);
  mock.insert = vi.fn(() => mock);
  mock.update = vi.fn(() => mock);
  mock.delete = vi.fn(() => mock);

  // For terminal calls that don't chain to single()
  // Override the resolved value for non-single terminal calls
  mock.order.mockResolvedValue(resolvedValue);

  return mock;
}

function createMockSupabase(chainMock: ReturnType<typeof createChainMock>) {
  return {
    from: vi.fn(() => chainMock),
  } as unknown as Parameters<typeof chatService.listByUser>[0];
}

describe('chat.service', () => {
  describe('listByUser', () => {
    it('returns chats ordered by updated_at DESC', async () => {
      const mockChats = [
        { id: 'chat-2', user_id: 'user-1', title: 'Second', updated_at: '2024-01-02T00:00:00Z' },
        { id: 'chat-1', user_id: 'user-1', title: 'First', updated_at: '2024-01-01T00:00:00Z' },
      ];
      const chain = createChainMock({ data: mockChats, error: null });
      const supabase = createMockSupabase(chain);

      const result = await chatService.listByUser(supabase, 'user-1');

      expect(result).toEqual(mockChats);
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(chain.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    });

    it('throws ChatServiceError on database error', async () => {
      const chain = createChainMock({ data: null, error: { message: 'db error' } });
      const supabase = createMockSupabase(chain);

      await expect(chatService.listByUser(supabase, 'user-1')).rejects.toThrow(ChatServiceError);
      await expect(chatService.listByUser(supabase, 'user-1')).rejects.toThrow('Failed to fetch chats');
    });
  });

  describe('listByAnonymousSession', () => {
    it('returns chats for anonymous session', async () => {
      const mockChats = [
        { id: 'chat-1', anonymous_session_id: 'anon-1', title: 'Anon Chat' },
      ];
      const chain = createChainMock({ data: mockChats, error: null });
      const supabase = createMockSupabase(chain);

      const result = await chatService.listByAnonymousSession(supabase, 'anon-1');

      expect(result).toEqual(mockChats);
      expect(chain.eq).toHaveBeenCalledWith('anonymous_session_id', 'anon-1');
    });
  });

  describe('getById', () => {
    it('returns chat with messages', async () => {
      const mockChat = { id: 'chat-1', user_id: 'user-1', title: 'Test Chat' };
      const mockMessages = [
        { id: 'msg-1', chat_id: 'chat-1', role: 'user', content: 'Hello' },
        { id: 'msg-2', chat_id: 'chat-1', role: 'assistant', content: 'Hi there' },
      ];

      // Need two separate chain mocks: one for chats, one for messages
      let callCount = 0;
      const chatChain = createChainMock({ data: mockChat, error: null });
      const msgChain = createChainMock({ data: mockMessages, error: null });

      const supabase = {
        from: vi.fn((table: string) => {
          if (table === 'chats') return chatChain;
          return msgChain;
        }),
      } as unknown as Parameters<typeof chatService.getById>[0];

      const result = await chatService.getById(supabase, 'chat-1');

      expect(result.id).toBe('chat-1');
      expect(result.messages).toEqual(mockMessages);
    });

    it('throws NOT_FOUND when chat does not exist', async () => {
      const chain = createChainMock({ data: null, error: { message: 'not found' } });
      const supabase = createMockSupabase(chain);

      try {
        await chatService.getById(supabase, 'nonexistent');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ChatServiceError);
        expect((err as ChatServiceError).code).toBe('NOT_FOUND');
        expect((err as ChatServiceError).statusCode).toBe(404);
      }
    });
  });

  describe('create', () => {
    it('creates chat with default title', async () => {
      const mockChat = { id: 'chat-new', user_id: 'user-1', title: 'New Chat' };
      const chain = createChainMock({ data: mockChat, error: null });
      const supabase = createMockSupabase(chain);

      const result = await chatService.create(supabase, 'user-1');

      expect(result).toEqual(mockChat);
      expect(chain.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        title: 'New Chat',
      });
    });

    it('creates chat with custom title', async () => {
      const mockChat = { id: 'chat-new', user_id: 'user-1', title: 'My Chat' };
      const chain = createChainMock({ data: mockChat, error: null });
      const supabase = createMockSupabase(chain);

      const result = await chatService.create(supabase, 'user-1', 'My Chat');

      expect(result).toEqual(mockChat);
      expect(chain.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        title: 'My Chat',
      });
    });

    it('throws on database error', async () => {
      const chain = createChainMock({ data: null, error: { message: 'insert failed' } });
      const supabase = createMockSupabase(chain);

      await expect(chatService.create(supabase, 'user-1')).rejects.toThrow('Failed to create chat');
    });
  });

  describe('createAnonymous', () => {
    it('creates chat with anonymous session id', async () => {
      const mockChat = { id: 'chat-anon', anonymous_session_id: 'anon-1', title: 'New Chat' };
      const chain = createChainMock({ data: mockChat, error: null });
      const supabase = createMockSupabase(chain);

      const result = await chatService.createAnonymous(supabase, 'anon-1');

      expect(result).toEqual(mockChat);
      expect(chain.insert).toHaveBeenCalledWith({
        anonymous_session_id: 'anon-1',
        title: 'New Chat',
      });
    });
  });

  describe('rename', () => {
    it('updates chat title and returns updated chat', async () => {
      const mockChat = { id: 'chat-1', title: 'Renamed Chat' };
      const chain = createChainMock({ data: mockChat, error: null });
      const supabase = createMockSupabase(chain);

      const result = await chatService.rename(supabase, 'chat-1', 'Renamed Chat');

      expect(result).toEqual(mockChat);
      expect(chain.update).toHaveBeenCalledWith({ title: 'Renamed Chat' });
      expect(chain.eq).toHaveBeenCalledWith('id', 'chat-1');
    });

    it('throws on database error', async () => {
      const chain = createChainMock({ data: null, error: { message: 'update failed' } });
      const supabase = createMockSupabase(chain);

      await expect(chatService.rename(supabase, 'chat-1', 'New Title')).rejects.toThrow('Failed to rename chat');
    });
  });

  describe('deleteChat', () => {
    it('deletes chat successfully', async () => {
      const chain = createChainMock({ data: null, error: null });
      // For delete, the terminal call is eq, not single
      chain.eq.mockResolvedValue({ data: null, error: null });
      const supabase = createMockSupabase(chain);

      await expect(chatService.deleteChat(supabase, 'chat-1')).resolves.toBeUndefined();
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', 'chat-1');
    });

    it('throws on database error', async () => {
      const chain = createChainMock({ data: null, error: null });
      chain.eq.mockResolvedValue({ data: null, error: { message: 'delete failed' } });
      const supabase = createMockSupabase(chain);

      await expect(chatService.deleteChat(supabase, 'chat-1')).rejects.toThrow('Failed to delete chat');
    });
  });

  describe('verifyOwnership', () => {
    it('returns chat when user owns it', async () => {
      const mockChat = { id: 'chat-1', user_id: 'user-1', title: 'My Chat' };
      const chain = createChainMock({ data: mockChat, error: null });
      const supabase = createMockSupabase(chain);

      const result = await chatService.verifyOwnership(supabase, 'chat-1', 'user-1');

      expect(result).toEqual(mockChat);
    });

    it('throws NOT_FOUND when chat does not exist', async () => {
      const chain = createChainMock({ data: null, error: { message: 'not found' } });
      const supabase = createMockSupabase(chain);

      try {
        await chatService.verifyOwnership(supabase, 'nonexistent', 'user-1');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ChatServiceError);
        expect((err as ChatServiceError).code).toBe('NOT_FOUND');
      }
    });

    it('throws FORBIDDEN when user does not own chat', async () => {
      const mockChat = { id: 'chat-1', user_id: 'other-user', title: 'Not Mine' };
      const chain = createChainMock({ data: mockChat, error: null });
      const supabase = createMockSupabase(chain);

      try {
        await chatService.verifyOwnership(supabase, 'chat-1', 'user-1');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ChatServiceError);
        expect((err as ChatServiceError).code).toBe('FORBIDDEN');
        expect((err as ChatServiceError).statusCode).toBe(403);
      }
    });
  });

  describe('verifyAnonymousOwnership', () => {
    it('returns chat when anonymous session owns it', async () => {
      const mockChat = { id: 'chat-1', anonymous_session_id: 'anon-1', title: 'Anon Chat' };
      const chain = createChainMock({ data: mockChat, error: null });
      const supabase = createMockSupabase(chain);

      const result = await chatService.verifyAnonymousOwnership(supabase, 'chat-1', 'anon-1');
      expect(result).toEqual(mockChat);
    });

    it('throws FORBIDDEN when anonymous session does not own chat', async () => {
      const mockChat = { id: 'chat-1', anonymous_session_id: 'other-anon', title: 'Not Mine' };
      const chain = createChainMock({ data: mockChat, error: null });
      const supabase = createMockSupabase(chain);

      try {
        await chatService.verifyAnonymousOwnership(supabase, 'chat-1', 'anon-1');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ChatServiceError);
        expect((err as ChatServiceError).code).toBe('FORBIDDEN');
      }
    });

    it('throws NOT_FOUND when chat does not exist', async () => {
      const chain = createChainMock({ data: null, error: { message: 'not found' } });
      const supabase = createMockSupabase(chain);

      try {
        await chatService.verifyAnonymousOwnership(supabase, 'nonexistent', 'anon-1');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ChatServiceError);
        expect((err as ChatServiceError).code).toBe('NOT_FOUND');
      }
    });
  });

  describe('migrateAnonymousChats', () => {
    it('migrates anonymous chats to user and returns count', async () => {
      const mockData = [{ id: 'chat-1' }, { id: 'chat-2' }];
      const chain = createChainMock({ data: mockData, error: null });
      // For migrate, the terminal call is select after eq
      chain.select.mockResolvedValue({ data: mockData, error: null });
      const supabase = createMockSupabase(chain);

      const count = await chatService.migrateAnonymousChats(supabase, 'user-1', 'anon-1');

      expect(count).toBe(2);
      expect(chain.update).toHaveBeenCalledWith({ user_id: 'user-1', anonymous_session_id: null });
      expect(chain.eq).toHaveBeenCalledWith('anonymous_session_id', 'anon-1');
    });

    it('throws on database error', async () => {
      const chain = createChainMock({ data: null, error: null });
      chain.select.mockResolvedValue({ data: null, error: { message: 'update failed' } });
      const supabase = createMockSupabase(chain);

      await expect(
        chatService.migrateAnonymousChats(supabase, 'user-1', 'anon-1')
      ).rejects.toThrow('Failed to migrate anonymous chats');
    });
  });
});
