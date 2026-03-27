'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { Message } from '@/types/database';
import type { ApiError } from '@/types/api';

async function fetchMessages(chatId: string): Promise<Message[]> {
  const res = await fetch(`/api/chats/${chatId}/messages`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw new Error(err.error.message);
  }
  return res.json();
}

export function useMessages(chatId: string) {
  return useQuery({
    queryKey: queryKeys.chats.messages(chatId),
    queryFn: () => fetchMessages(chatId),
    enabled: !!chatId && chatId !== 'new',
    staleTime: 30 * 1000,
  });
}
