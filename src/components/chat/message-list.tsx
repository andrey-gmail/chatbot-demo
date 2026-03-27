'use client';

import { useEffect, useRef } from 'react';
import { MessageItem } from './message-item';
import { StreamingIndicator } from './streaming-indicator';
import { MessageListSkeleton } from '@/components/shared/skeleton-loader';
import { EmptyState } from '@/components/shared/empty-state';
import { MessageSquare } from 'lucide-react';
import type { Message } from '@/types/database';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
}

export function MessageList({
  messages,
  isLoading,
  isStreaming,
  streamingContent,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  if (isLoading) {
    return <MessageListSkeleton />;
  }

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <EmptyState
          title="Start a conversation"
          description="Send a message to begin chatting with the AI assistant."
          icon={<MessageSquare className="h-8 w-8 text-muted-foreground" />}
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto scroll-smooth">
      <div className="max-w-3xl mx-auto py-4">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}

        {/* Show streaming indicator when waiting for first token */}
        {isStreaming && !streamingContent && (
          <div className="flex gap-3 px-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <span className="text-xs">AI</span>
            </div>
            <StreamingIndicator />
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
