'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { broadcastChatEvent } from '@/hooks/use-cross-tab-sync';
import type { Chat } from '@/types/database';
import type { ApiError } from '@/types/api';

async function fetchChats(): Promise<Chat[]> {
  const res = await fetch('/api/chats', { credentials: 'include' });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw new Error(err.error.message);
  }
  return res.json();
}

async function createChat(title?: string): Promise<Chat> {
  const res = await fetch('/api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw new Error(err.error.message);
  }
  return res.json();
}

async function renameChat({ chatId, title }: { chatId: string; title: string }): Promise<Chat> {
  const res = await fetch(`/api/chats/${chatId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw new Error(err.error.message);
  }
  return res.json();
}

async function deleteChat(chatId: string): Promise<void> {
  const res = await fetch(`/api/chats/${chatId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw new Error(err.error.message);
  }
}

export function useChats() {
  return useQuery({
    queryKey: queryKeys.chats.all,
    queryFn: fetchChats,
    staleTime: 30 * 1000,
  });
}

export function useCreateChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title?: string) => createChat(title),
    onSuccess: (newChat) => {
      queryClient.setQueryData<Chat[]>(queryKeys.chats.all, (old) =>
        old ? [newChat, ...old] : [newChat]
      );
      broadcastChatEvent({ type: 'chat:created', chatId: newChat.id, title: newChat.title });
    },
  });
}

export function useRenameChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: renameChat,
    onSuccess: (updatedChat) => {
      queryClient.setQueryData<Chat[]>(queryKeys.chats.all, (old) =>
        old
          ? old.map((c) => (c.id === updatedChat.id ? updatedChat : c))
          : []
      );
      broadcastChatEvent({ type: 'chat:renamed', chatId: updatedChat.id, title: updatedChat.title });
    },
  });
}

export function useDeleteChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteChat,
    onSuccess: (_data, chatId) => {
      queryClient.setQueryData<Chat[]>(queryKeys.chats.all, (old) =>
        old ? old.filter((c) => c.id !== chatId) : []
      );
      broadcastChatEvent({ type: 'chat:deleted', chatId });
    },
  });
}
