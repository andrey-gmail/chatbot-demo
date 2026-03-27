import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authService from '@/services/auth.service';

// Helper to create a mock Supabase client
function createMockSupabase(overrides: Record<string, unknown> = {}) {
  return {
    auth: {
      admin: {
        createUser: vi.fn(),
        deleteUser: vi.fn(),
        signOut: vi.fn(),
      },
      signInWithPassword: vi.fn(),
      getUser: vi.fn(),
      refreshSession: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
    ...overrides,
  } as unknown as Parameters<typeof authService.signUp>[0];
}

describe('auth.service', () => {
  describe('signUp', () => {
    it('creates user and returns auth response', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00Z',
      };
      const mockSession = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      };

      const supabase = createMockSupabase();
      (supabase.auth.admin.createUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      (supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await authService.signUp(supabase, 'test@example.com', 'password123');

      expect(result.user.id).toBe('user-123');
      expect(result.user.email).toBe('test@example.com');
      expect(result.session.access_token).toBe('access-token');
      expect(result.session.refresh_token).toBe('refresh-token');
    });

    it('throws when auth creation fails', async () => {
      const supabase = createMockSupabase();
      (supabase.auth.admin.createUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: null },
        error: { message: 'Email already exists' },
      });

      await expect(
        authService.signUp(supabase, 'test@example.com', 'password123')
      ).rejects.toThrow('Email already exists');
    });

    it('cleans up auth user if public.users insert fails', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00Z',
      };

      const insertMock = vi.fn().mockResolvedValue({ error: { message: 'insert failed' } });
      const supabase = createMockSupabase({
        from: vi.fn(() => ({ insert: insertMock })),
      });
      (supabase.auth.admin.createUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      await expect(
        authService.signUp(supabase, 'test@example.com', 'password123')
      ).rejects.toThrow('Failed to create user record');

      expect(supabase.auth.admin.deleteUser).toHaveBeenCalledWith('user-123');
    });
  });

  describe('signIn', () => {
    it('returns auth response on valid credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      const mockSession = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      };

      const supabase = createMockSupabase();
      (supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await authService.signIn(supabase, 'test@example.com', 'password123');

      expect(result.user.id).toBe('user-123');
      expect(result.session.access_token).toBe('access-token');
    });

    it('throws generic error on invalid credentials without leaking email existence', async () => {
      const supabase = createMockSupabase();
      (supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      await expect(
        authService.signIn(supabase, 'nonexistent@example.com', 'wrong')
      ).rejects.toThrow('Invalid email or password');
    });

    it('throws same generic error for wrong password on existing email', async () => {
      const supabase = createMockSupabase();
      (supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      await expect(
        authService.signIn(supabase, 'existing@example.com', 'wrongpassword')
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('signOut', () => {
    it('signs out user successfully', async () => {
      const supabase = createMockSupabase();
      (supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });
      (supabase.auth.admin.signOut as ReturnType<typeof vi.fn>).mockResolvedValue({
        error: null,
      });

      await expect(authService.signOut(supabase, 'valid-token')).resolves.toBeUndefined();
      expect(supabase.auth.admin.signOut).toHaveBeenCalledWith('user-123');
    });

    it('throws on invalid token', async () => {
      const supabase = createMockSupabase();
      (supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: null },
        error: { message: 'invalid token' },
      });

      await expect(authService.signOut(supabase, 'bad-token')).rejects.toThrow('Invalid session');
    });
  });

  describe('getUser', () => {
    it('returns user from public.users table', async () => {
      const mockAuthUser = {
        id: 'user-123',
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00Z',
      };
      const mockPublicUser = {
        id: 'user-123',
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      const singleMock = vi.fn().mockResolvedValue({ data: mockPublicUser, error: null });
      const eqMock = vi.fn(() => ({ single: singleMock }));
      const selectMock = vi.fn(() => ({ eq: eqMock }));
      const supabase = createMockSupabase({
        from: vi.fn(() => ({ select: selectMock })),
      });
      (supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      });

      const result = await authService.getUser(supabase, 'valid-token');

      expect(result.id).toBe('user-123');
      expect(result.updated_at).toBe('2024-01-02T00:00:00Z');
    });

    it('throws on invalid token', async () => {
      const supabase = createMockSupabase();
      (supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: null },
        error: { message: 'invalid' },
      });

      await expect(authService.getUser(supabase, 'bad-token')).rejects.toThrow(
        'Invalid or expired token'
      );
    });
  });

  describe('refreshSession', () => {
    it('returns new auth response', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      const mockSession = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      };

      const supabase = createMockSupabase();
      (supabase.auth.refreshSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await authService.refreshSession(supabase, 'old-refresh-token');

      expect(result.session.access_token).toBe('new-access-token');
      expect(result.session.refresh_token).toBe('new-refresh-token');
    });

    it('throws on invalid refresh token', async () => {
      const supabase = createMockSupabase();
      (supabase.auth.refreshSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'invalid refresh token' },
      });

      await expect(
        authService.refreshSession(supabase, 'bad-token')
      ).rejects.toThrow('Failed to refresh session');
    });
  });

  describe('migrateAnonymousChats', () => {
    it('updates chats and returns count', async () => {
      const selectMock = vi.fn().mockResolvedValue({
        data: [{ id: 'chat-1' }, { id: 'chat-2' }],
        error: null,
      });
      const eqMock = vi.fn(() => ({ select: selectMock }));
      const updateMock = vi.fn(() => ({ eq: eqMock }));
      const supabase = createMockSupabase({
        from: vi.fn(() => ({ update: updateMock })),
      });

      const count = await authService.migrateAnonymousChats(supabase, 'user-123', 'anon-session');

      expect(count).toBe(2);
      expect(updateMock).toHaveBeenCalledWith({
        user_id: 'user-123',
        anonymous_session_id: null,
      });
    });

    it('throws on database error', async () => {
      const selectMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'db error' },
      });
      const eqMock = vi.fn(() => ({ select: selectMock }));
      const updateMock = vi.fn(() => ({ eq: eqMock }));
      const supabase = createMockSupabase({
        from: vi.fn(() => ({ update: updateMock })),
      });

      await expect(
        authService.migrateAnonymousChats(supabase, 'user-123', 'anon-session')
      ).rejects.toThrow('Failed to migrate anonymous chats');
    });
  });
});
