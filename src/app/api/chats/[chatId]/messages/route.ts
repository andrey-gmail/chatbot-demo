import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { identifyRequestOwner, AuthError } from '@/lib/auth-helpers';
import type { RequestOwner } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import * as chatService from '@/services/chat.service';
import { ChatServiceError } from '@/services/chat.service';
import * as messageService from '@/services/message.service';
import { MessageServiceError } from '@/services/message.service';
import * as llmService from '@/services/llm.service';
import type { ApiError } from '@/types/api';

const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message content must not be empty'),
  imageUrl: z.string().url().optional(),
});

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

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const owner = await identifyRequestOwner(request);
    const { chatId } = await context.params;
    const supabase = createAdminClient();

    await verifyOwnershipForOwner(supabase, chatId, owner);
    const messages = await messageService.listByChatId(supabase, chatId);

    return NextResponse.json(messages, { status: 200 });
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
    if (err instanceof MessageServiceError) {
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

export async function POST(request: NextRequest, context: RouteContext) {
  const encoder = new TextEncoder();
  let { chatId } = await context.params;
  let newChatId: string | null = null;

  // Validate request body
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
    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    const errorResponse: ApiError = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: parsed.error.flatten().fieldErrors,
      },
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Identify request owner (user or anonymous)
  let owner: RequestOwner;
  try {
    owner = await identifyRequestOwner(request);
  } catch (err) {
    if (err instanceof AuthError) {
      const errorResponse: ApiError = {
        error: { code: 'UNAUTHORIZED', message: err.message },
      };
      return new Response(JSON.stringify(errorResponse), {
        status: err.statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const errorResponse: ApiError = {
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createAdminClient();

  // If chatId is "new", create a new chat first
  try {
    if (chatId === 'new') {
      const title = parsed.data.content.slice(0, 50) || 'New Chat';
      const chat =
        owner.type === 'user'
          ? await chatService.create(supabase, owner.userId, title)
          : await chatService.createAnonymous(supabase, owner.sessionId, title);
      chatId = chat.id;
      newChatId = chat.id;
    } else {
      // Verify ownership of existing chat
      await verifyOwnershipForOwner(supabase, chatId, owner);
    }
  } catch (err) {
    if (err instanceof ChatServiceError) {
      const errorResponse: ApiError = {
        error: { code: err.code, message: err.message },
      };
      return new Response(JSON.stringify(errorResponse), {
        status: err.statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const errorResponse: ApiError = {
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Store user message and start streaming
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Store the user message in DB
        await messageService.create(
          supabase,
          chatId,
          'user',
          parsed.data.content,
          parsed.data.imageUrl
        );

        // Bump chat updated_at
        await supabase
          .from('chats')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', chatId);

        // Assemble conversation context
        const assembledContext = await messageService.assembleContext(supabase, chatId);

        // Build OpenAI messages
        const messages = llmService.buildMessages(assembledContext);

        // If documents were truncated, send a flag to the client
        if (assembledContext.documentsTruncated) {
          const truncationEvent = `data: ${JSON.stringify({ documentsTruncated: true })}\n\n`;
          controller.enqueue(encoder.encode(truncationEvent));
        }

        // Stream completion from OpenAI
        let fullContent = '';
        const tokenStream = llmService.streamCompletion(messages);

        for await (const token of tokenStream) {
          fullContent += token;
          const event = `data: ${JSON.stringify({ token })}\n\n`;
          controller.enqueue(encoder.encode(event));
        }

        // Store the complete assistant message
        await messageService.create(supabase, chatId, 'assistant', fullContent);

        // Bump chat updated_at again after assistant response
        await supabase
          .from('chats')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', chatId);

        // Send done event
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        // Send error event before closing
        const errorMessage =
          err instanceof Error ? err.message : 'An unexpected error occurred';
        const errorEvent = `event: error\ndata: ${JSON.stringify({
          code: 'LLM_ERROR',
          message: errorMessage,
        })}\n\n`;
        controller.enqueue(encoder.encode(errorEvent));
        controller.close();
      }
    },
  });

  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  };

  if (newChatId) {
    headers['X-Chat-Id'] = newChatId;
  }

  return new Response(stream, { headers });
}
