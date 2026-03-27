'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

export type ChatSyncEventType = 'chat:created' | 'chat:deleted' | 'chat:renamed';

export interface ChatSyncEvent {
  type: ChatSyncEventType;
  chatId: string;
  title?: string;
}

const CHANNEL_NAME = 'chat-sync';
const POLLING_INTERVAL_MS = 30_000;

/**
 * Broadcasts a chat sync event to other tabs.
 * Safe to call outside of React — uses a short-lived BroadcastChannel.
 */
export function broadcastChatEvent(event: ChatSyncEvent): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(event);
    channel.close();
  } catch {
    // BroadcastChannel not available or failed — silently ignore
  }
}

/**
 * Hook that listens for cross-tab chat sync events via BroadcastChannel.
 * Falls back to polling the chat list every 30s if BroadcastChannel is unavailable.
 */
export function useCrossTabSync(): void {
  const queryClient = useQueryClient();
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const hasBroadcastChannel = typeof BroadcastChannel !== 'undefined';

    if (hasBroadcastChannel) {
      try {
        const channel = new BroadcastChannel(CHANNEL_NAME);
        channelRef.current = channel;

        channel.onmessage = (event: MessageEvent<ChatSyncEvent>) => {
          const { type, chatId } = event.data;

          switch (type) {
            case 'chat:created':
            case 'chat:deleted':
            case 'chat:renamed':
              queryClient.invalidateQueries({ queryKey: queryKeys.chats.all });
              break;
          }

          // For delete, also invalidate the specific chat detail/messages
          if (type === 'chat:deleted') {
            queryClient.invalidateQueries({ queryKey: queryKeys.chats.detail(chatId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.chats.messages(chatId) });
          }
        };

        return () => {
          channel.close();
          channelRef.current = null;
        };
      } catch {
        // Fall through to polling fallback
      }
    }

    // Polling fallback for browsers without BroadcastChannel
    const intervalId = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.all });
    }, POLLING_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [queryClient]);
}
