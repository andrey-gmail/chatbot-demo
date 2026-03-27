import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, AuthError } from '@/lib/auth-helpers';
import type { ApiError } from '@/types/api';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);

    return NextResponse.json({ user }, { status: 200 });
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
        message: 'Internal server error',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
