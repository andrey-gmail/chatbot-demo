import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { identifyRequestOwner, AuthError } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import * as chatService from '@/services/chat.service';
import { ChatServiceError } from '@/services/chat.service';
import type { ApiError } from '@/types/api';

const createChatSchema = z.object({
  title: z.string().min(1, 'Title must not be empty').optional(),
});

export async function GET(request: NextRequest) {
  try {
    const owner = await identifyRequestOwner(request);
    const supabase = createAdminClient();

    const chats =
      owner.type === 'user'
        ? await chatService.listByUser(supabase, owner.userId)
        : await chatService.listByAnonymousSession(supabase, owner.sessionId);

    return NextResponse.json(chats, { status: 200 });
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

    if (err instanceof ChatServiceError) {
      const errorResponse: ApiError = {
        error: {
          code: err.code,
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

export async function POST(request: NextRequest) {
  try {
    const owner = await identifyRequestOwner(request);

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

    const parsed = createChatSchema.safeParse(body);

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

    const supabase = createAdminClient();

    const chat =
      owner.type === 'user'
        ? await chatService.create(supabase, owner.userId, parsed.data.title)
        : await chatService.createAnonymous(supabase, owner.sessionId, parsed.data.title);

    return NextResponse.json(chat, { status: 201 });
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

    if (err instanceof ChatServiceError) {
      const errorResponse: ApiError = {
        error: {
          code: err.code,
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
