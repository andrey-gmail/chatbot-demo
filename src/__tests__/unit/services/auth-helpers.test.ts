import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { setAuthCookies, clearAuthCookies, AuthError } from '@/lib/auth-helpers';

// Mock the supabase admin module for authenticateRequest tests
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
    },
  })),
}));

describe('auth-helpers', () => {
  describe('setAuthCookies', () => {
    it('sets access_token and refresh_token cookies', () => {
      const response = NextResponse.json({ ok: true });
      const session = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
      };

      const result = setAuthCookies(response, session);

      const cookies = result.cookies.getAll();
      const accessCookie = cookies.find((c) => c.name === 'access_token');
      const refreshCookie = cookies.find((c) => c.name === 'refresh_token');

      expect(accessCookie).toBeDefined();
      expect(accessCookie!.value).toBe('test-access-token');
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie!.value).toBe('test-refresh-token');
    });
  });

  describe('clearAuthCookies', () => {
    it('clears both cookies by setting empty value and maxAge 0', () => {
      const response = NextResponse.json({ ok: true });
      const result = clearAuthCookies(response);

      const cookies = result.cookies.getAll();
      const accessCookie = cookies.find((c) => c.name === 'access_token');
      const refreshCookie = cookies.find((c) => c.name === 'refresh_token');

      expect(accessCookie).toBeDefined();
      expect(accessCookie!.value).toBe('');
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie!.value).toBe('');
    });
  });

  describe('AuthError', () => {
    it('creates error with default 401 status', () => {
      const err = new AuthError('Unauthorized');
      expect(err.message).toBe('Unauthorized');
      expect(err.statusCode).toBe(401);
      expect(err.name).toBe('AuthError');
    });

    it('creates error with custom status code', () => {
      const err = new AuthError('Forbidden', 403);
      expect(err.statusCode).toBe(403);
    });
  });
});
