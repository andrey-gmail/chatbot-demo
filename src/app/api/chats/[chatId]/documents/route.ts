import { NextRequest, NextResponse } from 'next/server';
import { identifyRequestOwner, AuthError } from '@/lib/auth-helpers';
import type { RequestOwner } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import * as chatService from '@/services/chat.service';
import { ChatServiceError } from '@/services/chat.service';
import * as documentService from '@/services/document.service';
import { DocumentServiceError } from '@/services/document.service';
import { MAX_DOCUMENT_SIZE } from '@/lib/constants';
import type { ApiError } from '@/types/api';

type RouteContext = { params: Promise<{ chatId: string }> };

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

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const owner = await identifyRequestOwner(request);
    const { chatId } = await context.params;
    const supabase = createAdminClient();

    await verifyOwnershipForOwner(supabase, chatId, owner);

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      const errorResponse: ApiError = {
        error: { code: 'VALIDATION_ERROR', message: 'No document file provided' },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (buffer.byteLength > MAX_DOCUMENT_SIZE) {
      const errorResponse: ApiError = {
        error: { code: 'VALIDATION_ERROR', message: 'File too large. Maximum size is 20 MB.' },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const doc = await documentService.upload(supabase, chatId, buffer, file.name);

    return NextResponse.json(doc, { status: 201 });
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
    console.error('Document upload error:', err);
    const errorResponse: ApiError = {
      error: { code: 'INTERNAL_ERROR', message: 'Failed to upload document' },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const owner = await identifyRequestOwner(request);
    const { chatId } = await context.params;
    const supabase = createAdminClient();

    await verifyOwnershipForOwner(supabase, chatId, owner);
    const documents = await documentService.listByChatId(supabase, chatId);

    return NextResponse.json(documents, { status: 200 });
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
