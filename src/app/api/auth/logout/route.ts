import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateRequest, clearAuthCookies, AuthError } from '@/lib/auth-helpers';
import * as authService from '@/services/auth.service';
import type { ApiError } from '@/types/api';

export async function POST(request: NextRequest) {
  try {
    await authenticateRequest(request);

    const token = request.cookies.get('access_token')!.value;
    const supabase = createAdminClient();
    await authService.signOut(supabase, token);

    const response = NextResponse.json(
      { message: 'Logged out successfully' },
      { status: 200 }
    );

    return clearAuthCookies(response);
  } catch (err) {
    if (err instanceof AuthError) {
      const errorResponse: ApiError = {
        error: {
          code: 'UNAUTHORIZED',
          message: err.message,
        },
      };
      return NextResponse.json(errorResponse, { status: err.statusCode });
    }

    const errorResponse: ApiError = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to sign out',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
