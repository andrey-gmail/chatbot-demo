import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { setAuthCookies } from '@/lib/auth-helpers';
import * as authService from '@/services/auth.service';
import type { ApiError } from '@/types/api';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refresh_token')?.value;

    if (!refreshToken) {
      const errorResponse: ApiError = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing refresh token',
        },
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    const supabase = createAdminClient();
    const result = await authService.refreshSession(supabase, refreshToken);

    const response = NextResponse.json(
      { user: result.user },
      { status: 200 }
    );

    return setAuthCookies(response, result.session);
  } catch (err) {
    const errorResponse: ApiError = {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Failed to refresh session',
      },
    };
    return NextResponse.json(errorResponse, { status: 401 });
  }
}
