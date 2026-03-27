import { NextRequest, NextResponse } from 'next/server';
import { identifyRequestOwner, AuthError } from '@/lib/auth-helpers';
import type { RequestOwner } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import * as chatService from '@/services/chat.service';
import { ChatServiceError } from '@/services/chat.service';
import * as documentService from '@/services/document.service';
import { DocumentServiceError } from '@/services/document.service';
import type { ApiError } from '@/types/api';

type RouteContext = { params: Promise<{ chatId: string; docId: string }> };

async function verifyOwnershipForOwner(
  supabase: ReturnType<typeof createAdminClient>,
  chatId: string,
  owner: RequestOwner
) {
  if (owner.type === 'user') {
    return chatService.verifyOwnership(supabase, chatId, owner.userId);
  }
  return chatService.verifyAnonymousOwnership(supabase, chatId, owner.sessionId);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const owner = await identifyRequestOwner(request);
    const { chatId, docId } = await context.params;
    const supabase = createAdminClient();

    await verifyOwnershipForOwner(supabase, chatId, owner);

    // Verify the document belongs to this chat
    const doc = await documentService.getById(supabase, docId);
    if (doc.chat_id !== chatId) {
      const errorResponse: ApiError = {
        error: { code: 'NOT_FOUND', message: 'Document not found in this chat' },
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    await documentService.deleteDocument(supabase, docId);

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
    if (err instanceof DocumentServiceError) {
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
