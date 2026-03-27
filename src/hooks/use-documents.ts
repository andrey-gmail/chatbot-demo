'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { Document } from '@/types/database';

export function useDocuments(chatId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<Document[]>({
    queryKey: queryKeys.chats.documents(chatId),
    queryFn: async () => {
      if (chatId === 'new') return [];
      const res = await fetch(`/api/chats/${chatId}/documents`, {
        credentials: 'include',
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: chatId !== 'new',
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.chats.documents(chatId),
    });
  };

  return {
    documents: query.data ?? [],
    isLoading: query.isLoading,
    invalidate,
  };
}
