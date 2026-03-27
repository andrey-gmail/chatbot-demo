import type { SupabaseClient } from '@supabase/supabase-js';
import type { Message, MessageRole } from '@/types/database';
import { MAX_CONTEXT_TOKENS } from '@/lib/constants';

export class MessageServiceError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'MessageServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export async function create(
  supabase: SupabaseClient,
  chatId: string,
  role: MessageRole,
  content: string,
  imageUrl?: string
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      role,
      content,
      image_url: imageUrl ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new MessageServiceError(
      'Failed to create message',
      'INTERNAL_ERROR',
      500
    );
  }

  return data as Message;
}

export async function listByChatId(
  supabase: SupabaseClient,
  chatId: string
): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new MessageServiceError(
      'Failed to fetch messages',
      'INTERNAL_ERROR',
      500
    );
  }

  return (data ?? []) as Message[];
}

export interface AssembledContext {
  messages: Array<{ role: MessageRole; content: string; imageUrl?: string }>;
  documentContext: string | null;
  /** True when document text was truncated to fit the token budget */
  documentsTruncated: boolean;
}

export async function assembleContext(
  supabase: SupabaseClient,
  chatId: string
): Promise<AssembledContext> {
  // Fetch all messages for the chat
  const messages = await listByChatId(supabase, chatId);

  // Fetch any documents with status 'ready' for context injection
  const { data: documents } = await supabase
    .from('documents')
    .select('extracted_text')
    .eq('chat_id', chatId)
    .eq('status', 'ready');

  let documentContext: string | null = null;
  let documentsTruncated = false;

  if (documents && documents.length > 0) {
    const texts = documents
      .map((doc: { extracted_text: string }) => doc.extracted_text)
      .filter(Boolean);

    const joined = texts.join('\n\n---\n\n');

    // Token budget: estimate tokens as chars / 4
    const estimatedTokens = Math.ceil(joined.length / 4);
    if (estimatedTokens > MAX_CONTEXT_TOKENS) {
      // Truncate to fit within the token budget
      const maxChars = MAX_CONTEXT_TOKENS * 4;
      documentContext = joined.slice(0, maxChars);
      documentsTruncated = true;
    } else {
      documentContext = joined;
    }
  }

  return {
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      imageUrl: m.image_url ?? undefined,
    })),
    documentContext,
    documentsTruncated,
  };
}
