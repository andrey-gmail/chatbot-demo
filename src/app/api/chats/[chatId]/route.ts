import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, identifyRequestOwner, AuthError } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import * as chatService from '@/services/chat.service';
import { ChatServiceError } from '@/services/chat.service';
import type { ApiError } from '@/types/api';

const renameChatSchema = z.object({
  title: z.string().min(1, 'Title must not be empty'),
});

type RouteContext = { params: Promise<{ chatId: string }> };

async function verifyOwnershipForOwner(
  supabase: ReturnType<typeof createAdminClient>,
  chatId: string,
  owner: { type: 'user'; userId: string } | { type: 'anonymous'; sessionId: string }
) {
  if (owner.type === 'user') {
    return chatService.verifyOwnership(supabase, chatId, owner.userId);
  }
  return chatService.verifyAnonymousOwnership(supabase, chatId, owner.sessionId);
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const owner = await identifyRequestOwner(request);
    const { chatId } = await context.params;
    const supabase = createAdminClient();

    await verifyOwnershipForOwner(supabase, chatId, owner);
    const chat = await chatService.getById(supabase, chatId);

    return NextResponse.json(chat, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      const errorResponse: ApiError = {
        error: { code: 'UNAUTHORIZED', message: err.message },
      };
      return NextResponse.json(errorResponse, { status: err.statusCode });
    }
    if (err instanceof ChatServiceError) {
      const errorResponse: ApiError = {
        error: { code: err.code, message: err.message },
      };
      return NextResponse.json(errorResponse, { status: err.statusCode });
    }
    const errorResponse: ApiError = {
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    // Rename requires authentication — anonymous users can't rename
    const user = await authenticateRequest(request);
    const { chatId } = await context.params;

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

    const parsed = renameChatSchema.safeParse(body);

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
    await chatService.verifyOwnership(supabase, chatId, user.id);
    const chat = await chatService.rename(supabase, chatId, parsed.data.title);

    return NextResponse.json(chat, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      const errorResponse: ApiError = {
        error: { code: 'UNAUTHORIZED', message: err.message },
      };
      return NextResponse.json(errorResponse, { status: err.statusCode });
    }
    if (err instanceof ChatServiceError) {
      const errorResponse: ApiError = {
        error: { code: err.code, message: err.message },
      };
      return NextResponse.json(errorResponse, { status: err.statusCode });
    }
    const errorResponse: ApiError = {
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    // Delete requires authentication — anonymous users can't delete
    const user = await authenticateRequest(request);
    const { chatId } = await context.params;
    const supabase = createAdminClient();

    await chatService.verifyOwnership(supabase, chatId, user.id);
    await chatService.deleteChat(supabase, chatId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      const errorResponse: ApiError = {
        error: { code: 'UNAUTHORIZED', message: err.message },
      };
      return NextResponse.json(errorResponse, { status: err.statusCode });
    }
    if (err instanceof ChatServiceError) {
      const errorResponse: ApiError = {
        error: { code: err.code, message: err.message },
      };
      return NextResponse.json(errorResponse, { status: err.statusCode });
    }
    const errorResponse: ApiError = {
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
