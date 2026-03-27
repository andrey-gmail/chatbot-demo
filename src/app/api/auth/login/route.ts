import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { setAuthCookies } from '@/lib/auth-helpers';
import * as authService from '@/services/auth.service';
import type { ApiError } from '@/types/api';

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
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

    const parsed = loginSchema.safeParse(body);

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

    const { email, password } = parsed.data;
    const supabase = createAdminClient();
    const result = await authService.signIn(supabase, email, password);

    const response = NextResponse.json(
      { user: result.user },
      { status: 200 }
    );

    return setAuthCookies(response, result.session);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid credentials';

    // Always return generic message for auth failures
    const errorResponse: ApiError = {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
      },
    };
    return NextResponse.json(errorResponse, { status: 401 });
  }
}
