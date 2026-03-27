import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { broadcastChatEvent, useCrossTabSync } from '@/hooks/use-cross-tab-sync';
import type { ChatSyncEvent } from '@/hooks/use-cross-tab-sync';

// --- helpers ---

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient };
}

// Minimal BroadcastChannel mock
class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  closed = false;

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown) {
    // Deliver to all OTHER instances with the same channel name
    for (const instance of MockBroadcastChannel.instances) {
      if (instance !== this && instance.name === this.name && !instance.closed && instance.onmessage) {
        instance.onmessage(new MessageEvent('message', { data }));
      }
    }
  }

  close() {
    this.closed = true;
    const idx = MockBroadcastChannel.instances.indexOf(this);
    if (idx !== -1) MockBroadcastChannel.instances.splice(idx, 1);
  }
}

describe('use-cross-tab-sync', () => {
  let originalBroadcastChannel: typeof globalThis.BroadcastChannel;

  beforeEach(() => {
    originalBroadcastChannel = globalThis.BroadcastChannel;
    // Install mock
    (globalThis as Record<string, unknown>).BroadcastChannel = MockBroadcastChannel;
    MockBroadcastChannel.instances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).BroadcastChannel = originalBroadcastChannel;
    vi.useRealTimers();
  });

  describe('broadcastChatEvent', () => {
    it('posts a message to the chat-sync channel', () => {
      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      // Start a listener via the hook
      const { unmount } = renderHook(() => useCrossTabSync(), { wrapper });

      const event: ChatSyncEvent = { type: 'chat:created', chatId: '123' };
      broadcastChatEvent(event);

      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['chats'] })
      );

      unmount();
    });

    it('does nothing when BroadcastChannel is unavailable', () => {
      (globalThis as Record<string, unknown>).BroadcastChannel = undefined;
      // Should not throw
      expect(() => broadcastChatEvent({ type: 'chat:created', chatId: '1' })).not.toThrow();
    });
  });

  describe('useCrossTabSync — BroadcastChannel path', () => {
    it('invalidates chat list on chat:created event', () => {
      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { unmount } = renderHook(() => useCrossTabSync(), { wrapper });

      broadcastChatEvent({ type: 'chat:created', chatId: 'abc' });

      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['chats'] })
      );
      unmount();
    });

    it('invalidates chat list and detail on chat:deleted event', () => {
      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { unmount } = renderHook(() => useCrossTabSync(), { wrapper });

      broadcastChatEvent({ type: 'chat:deleted', chatId: 'xyz' });

      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['chats'] })
      );
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['chats', 'xyz'] })
      );
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['chats', 'xyz', 'messages'] })
      );
      unmount();
    });

    it('invalidates chat list on chat:renamed event', () => {
      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { unmount } = renderHook(() => useCrossTabSync(), { wrapper });

      broadcastChatEvent({ type: 'chat:renamed', chatId: 'r1', title: 'New Title' });

      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['chats'] })
      );
      unmount();
    });

    it('cleans up channel on unmount', () => {
      const { wrapper } = createWrapper();
      const { unmount } = renderHook(() => useCrossTabSync(), { wrapper });

      // One instance from the hook
      expect(MockBroadcastChannel.instances.length).toBe(1);

      unmount();

      expect(MockBroadcastChannel.instances.length).toBe(0);
    });
  });

  describe('useCrossTabSync — polling fallback', () => {
    it('polls every 30s when BroadcastChannel is unavailable', () => {
      (globalThis as Record<string, unknown>).BroadcastChannel = undefined;

      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { unmount } = renderHook(() => useCrossTabSync(), { wrapper });

      expect(invalidateSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(30_000);
      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['chats'] })
      );

      vi.advanceTimersByTime(30_000);
      expect(invalidateSpy).toHaveBeenCalledTimes(2);

      unmount();
    });

    it('stops polling on unmount', () => {
      (globalThis as Record<string, unknown>).BroadcastChannel = undefined;

      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { unmount } = renderHook(() => useCrossTabSync(), { wrapper });

      unmount();

      vi.advanceTimersByTime(60_000);
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });
});
