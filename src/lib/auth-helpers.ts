import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { User } from '@/types/database';

export async function authenticateRequest(request: NextRequest): Promise<User> {
  const token = request.cookies.get('access_token')?.value;

  if (!token) {
    throw new AuthError('Missing authentication token', 401);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new AuthError('Invalid or expired token', 401);
  }

  return {
    id: data.user.id,
    email: data.user.email ?? '',
    created_at: data.user.created_at,
    updated_at: data.user.updated_at ?? data.user.created_at,
  };
}

export function setAuthCookies(
  response: NextResponse,
  session: { access_token: string; refresh_token: string }
): NextResponse {
  const isProduction = process.env.NODE_ENV === 'production';

  response.cookies.set('access_token', session.access_token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 3600, // 1 hour
  });

  response.cookies.set('refresh_token', session.refresh_token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 604800, // 7 days
  });

  return response;
}

export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.set('access_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  response.cookies.set('refresh_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}

export class AuthError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

/**
 * Identifies the request owner — either an authenticated user or an anonymous session.
 * Returns { type: 'user', userId } or { type: 'anonymous', sessionId }.
 * Throws AuthError if neither is present.
 */
export type RequestOwner =
  | { type: 'user'; userId: string }
  | { type: 'anonymous'; sessionId: string };

export async function identifyRequestOwner(
  request: NextRequest
): Promise<RequestOwner> {
  const token = request.cookies.get('access_token')?.value;

  if (token) {
    const user = await authenticateRequest(request);
    return { type: 'user', userId: user.id };
  }

  const anonymousSessionId = request.cookies.get('anonymous_session')?.value;
  if (anonymousSessionId) {
    return { type: 'anonymous', sessionId: anonymousSessionId };
  }

  throw new AuthError('Authentication required', 401);
}
