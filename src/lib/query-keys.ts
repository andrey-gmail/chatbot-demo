// TanStack Query key factory

export const queryKeys = {
  chats: {
    all: ['chats'] as const,
    detail: (id: string) => ['chats', id] as const,
    messages: (chatId: string) => ['chats', chatId, 'messages'] as const,
    documents: (chatId: string) => ['chats', chatId, 'documents'] as const,
  },
  auth: {
    me: ['auth', 'me'] as const,
  },
} as const;
