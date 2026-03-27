import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { setAuthCookies } from '@/lib/auth-helpers';
import * as authService from '@/services/auth.service';
import * as chatService from '@/services/chat.service';
import type { ApiError } from '@/types/api';

const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  anonymousSessionId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      const errorResponse: ApiError = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid JSON body',
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      const errorResponse: ApiError = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors,
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { email, password, anonymousSessionId } = parsed.data;
    const supabase = createAdminClient();
    const result = await authService.signUp(supabase, email, password);

    // Migrate anonymous chats to the new user account
    if (anonymousSessionId) {
      try {
        await chatService.migrateAnonymousChats(
          supabase,
          result.user.id,
          anonymousSessionId
        );
      } catch {
        // Migration failure shouldn't block signup — chats can be migrated later
        console.error('Failed to migrate anonymous chats during signup');
      }
    }

    // Also check for anonymous_session cookie as fallback
    if (!anonymousSessionId) {
      const cookieSessionId = request.cookies.get('anonymous_session')?.value;
      if (cookieSessionId) {
        try {
          await chatService.migrateAnonymousChats(
            supabase,
            result.user.id,
            cookieSessionId
          );
        } catch {
          console.error('Failed to migrate anonymous chats from cookie during signup');
        }
      }
    }

    const response = NextResponse.json(
      { user: result.user },
      { status: 201 }
    );

    // Clear the anonymous session cookie after signup
    response.cookies.set('anonymous_session', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return setAuthCookies(response, result.session);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';

    // Check for duplicate email
    if (message.includes('already') || message.includes('duplicate')) {
      const errorResponse: ApiError = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'An account with this email already exists',
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const errorResponse: ApiError = {
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
