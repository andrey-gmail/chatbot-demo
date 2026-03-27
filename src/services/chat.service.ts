import type { SupabaseClient } from '@supabase/supabase-js';
import type { Chat, Message } from '@/types/database';

export class ChatServiceError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'ChatServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export async function listByUser(
  supabase: SupabaseClient,
  userId: string
): Promise<Chat[]> {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new ChatServiceError(
      'Failed to fetch chats',
      'INTERNAL_ERROR',
      500
    );
  }

  return data as Chat[];
}

export async function listByAnonymousSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<Chat[]> {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('anonymous_session_id', sessionId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new ChatServiceError(
      'Failed to fetch chats',
      'INTERNAL_ERROR',
      500
    );
  }

  return data as Chat[];
}

export async function getById(
  supabase: SupabaseClient,
  chatId: string
): Promise<Chat & { messages: Message[] }> {
  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .single();

  if (chatError || !chat) {
    throw new ChatServiceError('Chat not found', 'NOT_FOUND', 404);
  }

  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  if (messagesError) {
    throw new ChatServiceError(
      'Failed to fetch messages',
      'INTERNAL_ERROR',
      500
    );
  }

  return { ...(chat as Chat), messages: (messages ?? []) as Message[] };
}

export async function create(
  supabase: SupabaseClient,
  userId: string,
  title?: string
): Promise<Chat> {
  const { data, error } = await supabase
    .from('chats')
    .insert({
      user_id: userId,
      title: title ?? 'New Chat',
    })
    .select()
    .single();

  if (error) {
    throw new ChatServiceError(
      'Failed to create chat',
      'INTERNAL_ERROR',
      500
    );
  }

  return data as Chat;
}

export async function createAnonymous(
  supabase: SupabaseClient,
  sessionId: string,
  title?: string
): Promise<Chat> {
  const { data, error } = await supabase
    .from('chats')
    .insert({
      anonymous_session_id: sessionId,
      title: title ?? 'New Chat',
    })
    .select()
    .single();

  if (error) {
    throw new ChatServiceError(
      'Failed to create chat',
      'INTERNAL_ERROR',
      500
    );
  }

  return data as Chat;
}

export async function rename(
  supabase: SupabaseClient,
  chatId: string,
  title: string
): Promise<Chat> {
  const { data, error } = await supabase
    .from('chats')
    .update({ title })
    .eq('id', chatId)
    .select()
    .single();

  if (error) {
    throw new ChatServiceError(
      'Failed to rename chat',
      'INTERNAL_ERROR',
      500
    );
  }

  return data as Chat;
}

export async function deleteChat(
  supabase: SupabaseClient,
  chatId: string
): Promise<void> {
  const { error } = await supabase
    .from('chats')
    .delete()
    .eq('id', chatId);

  if (error) {
    throw new ChatServiceError(
      'Failed to delete chat',
      'INTERNAL_ERROR',
      500
    );
  }
}

export async function verifyOwnership(
  supabase: SupabaseClient,
  chatId: string,
  userId: string
): Promise<Chat> {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .single();

  if (error || !data) {
    throw new ChatServiceError('Chat not found', 'NOT_FOUND', 404);
  }

  const chat = data as Chat;

  if (chat.user_id !== userId) {
    throw new ChatServiceError(
      'You do not have access to this chat',
      'FORBIDDEN',
      403
    );
  }

  return chat;
}

/**
 * Verify that a chat belongs to the given anonymous session.
 */
export async function verifyAnonymousOwnership(
  supabase: SupabaseClient,
  chatId: string,
  sessionId: string
): Promise<Chat> {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .single();

  if (error || !data) {
    throw new ChatServiceError('Chat not found', 'NOT_FOUND', 404);
  }

  const chat = data as Chat;

  if (chat.anonymous_session_id !== sessionId) {
    throw new ChatServiceError(
      'You do not have access to this chat',
      'FORBIDDEN',
      403
    );
  }

  return chat;
}

/**
 * Migrate all anonymous chats to a user account.
 */
export async function migrateAnonymousChats(
  supabase: SupabaseClient,
  userId: string,
  anonymousSessionId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('chats')
    .update({ user_id: userId, anonymous_session_id: null })
    .eq('anonymous_session_id', anonymousSessionId)
    .select('id');

  if (error) {
    throw new ChatServiceError(
      'Failed to migrate anonymous chats',
      'INTERNAL_ERROR',
      500
    );
  }

  return data?.length ?? 0;
}
