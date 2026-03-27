import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

function createRequest(path: string, hasAccessToken = false, hasAnonymousSession = false): NextRequest {
  const url = new URL(path, 'http://localhost:3000');
  const req = new NextRequest(url);
  if (hasAccessToken) {
    req.cookies.set('access_token', 'some-token-value');
  }
  if (hasAnonymousSession) {
    req.cookies.set('anonymous_session', 'anon-session-id');
  }
  return req;
}

describe('middleware', () => {
  describe('authenticated users on auth pages', () => {
    it('redirects authenticated user from /login to /', () => {
      const res = middleware(createRequest('/login', true));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get('location')!).pathname).toBe('/');
    });

    it('redirects authenticated user from /signup to /', () => {
      const res = middleware(createRequest('/signup', true));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get('location')!).pathname).toBe('/');
    });
  });

  describe('unauthenticated users', () => {
    it('allows access to /login', () => {
      const res = middleware(createRequest('/login'));
      expect(res.status).toBe(200);
    });

    it('allows access to /signup', () => {
      const res = middleware(createRequest('/signup'));
      expect(res.status).toBe(200);
    });

    it('allows access to root /', () => {
      const res = middleware(createRequest('/'));
      expect(res.status).toBe(200);
    });

    it('allows access to chat pages (anonymous access)', () => {
      const res = middleware(createRequest('/some-chat-id'));
      expect(res.status).toBe(200);
    });
  });

  describe('authenticated users on normal pages', () => {
    it('allows access to root /', () => {
      const res = middleware(createRequest('/', true));
      expect(res.status).toBe(200);
    });

    it('allows access to chat pages', () => {
      const res = middleware(createRequest('/some-chat-id', true));
      expect(res.status).toBe(200);
    });
  });

  describe('anonymous session cookie', () => {
    it('sets anonymous_session cookie for unauthenticated users without one', () => {
      const res = middleware(createRequest('/'));
      expect(res.status).toBe(200);
      const setCookie = res.headers.getSetCookie();
      const anonCookie = setCookie.find((c) => c.startsWith('anonymous_session='));
      expect(anonCookie).toBeDefined();
      // Should not be empty
      expect(anonCookie).not.toContain('anonymous_session=;');
    });

    it('does not set anonymous_session cookie if already present', () => {
      const res = middleware(createRequest('/', false, true));
      expect(res.status).toBe(200);
      const setCookie = res.headers.getSetCookie();
      const anonCookie = setCookie.find((c) => c.startsWith('anonymous_session='));
      expect(anonCookie).toBeUndefined();
    });

    it('does not set anonymous_session cookie for authenticated users', () => {
      const res = middleware(createRequest('/', true));
      expect(res.status).toBe(200);
      const setCookie = res.headers.getSetCookie();
      const anonCookie = setCookie.find((c) => c.startsWith('anonymous_session='));
      expect(anonCookie).toBeUndefined();
    });
  });
});
