'use client';

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { Message } from '@/types/database';

interface SendMessagePayload {
  content: string;
  imageUrl?: string;
}

interface UseSendMessageReturn {
  sendMessage: (payload: SendMessagePayload) => Promise<string | null>;
  isStreaming: boolean;
  streamingContent: string;
}

function parseSSEChunk(chunk: string): { tokens: string; done: boolean; error?: string } {
  let tokens = '';
  let done = false;
  let error: string | undefined;

  const lines = chunk.split('\n');
  for (const line of lines) {
    if (line.startsWith('event: error')) {
      // Next data line will contain the error
      continue;
    }
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') {
        done = true;
        continue;
      }
      try {
        const parsed = JSON.parse(data);
        if (parsed.token) {
          tokens += parsed.token;
        }
        if (parsed.code && parsed.message) {
          error = parsed.message;
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }

  return { tokens, done, error };
}

export function useSendMessage(chatId: string): UseSendMessageReturn {
  const queryClient = useQueryClient();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  const sendMessage = useCallback(
    async (payload: SendMessagePayload) => {
      setIsStreaming(true);
      setStreamingContent('');

      // Optimistically add user message to cache
      const userMessage: Message = {
        id: `temp-user-${Date.now()}`,
        chat_id: chatId === 'new' ? '' : chatId,
        role: 'user',
        content: payload.content,
        image_url: payload.imageUrl ?? null,
        created_at: new Date().toISOString(),
      };

      const targetChatId = chatId === 'new' ? chatId : chatId;
      if (targetChatId !== 'new') {
        queryClient.setQueryData<Message[]>(
          queryKeys.chats.messages(targetChatId),
          (old) => [...(old ?? []), userMessage]
        );
      }

      let newChatId: string | null = null;

      try {
        const response = await fetch(`/api/chats/${chatId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        // Check for new chat ID in headers
        newChatId = response.headers.get('X-Chat-Id');

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error?.message ?? 'Failed to send message');
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const { tokens, done: streamDone, error } = parseSSEChunk(chunk);

          if (error) {
            throw new Error(error);
          }

          if (tokens) {
            fullContent += tokens;
            setStreamingContent(fullContent);

            // Update cache with streaming assistant message
            const effectiveChatId = newChatId ?? chatId;
            if (effectiveChatId !== 'new') {
              queryClient.setQueryData<Message[]>(
                queryKeys.chats.messages(effectiveChatId),
                (old) => {
                  const messages = old ?? [];
                  const streamingMsg: Message = {
                    id: 'streaming',
                    chat_id: effectiveChatId,
                    role: 'assistant',
                    content: fullContent,
                    image_url: null,
                    created_at: new Date().toISOString(),
                  };
                  // Replace existing streaming message or append
                  const withoutStreaming = messages.filter((m) => m.id !== 'streaming');
                  return [...withoutStreaming, streamingMsg];
                }
              );
            }
          }

          if (streamDone) break;
        }

        // Invalidate queries to get fresh data from server
        const effectiveChatId = newChatId ?? chatId;
        if (effectiveChatId !== 'new') {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.chats.messages(effectiveChatId),
          });
        }
        await queryClient.invalidateQueries({
          queryKey: queryKeys.chats.all,
        });
      } finally {
        setIsStreaming(false);
        setStreamingContent('');
      }

      return newChatId;
    },
    [chatId, queryClient]
  ) as (payload: SendMessagePayload) => Promise<string | null>;

  return { sendMessage, isStreaming, streamingContent };
}
