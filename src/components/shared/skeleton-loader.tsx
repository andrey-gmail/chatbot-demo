'use client';

import { Skeleton } from '@/components/ui/skeleton';

/** Skeleton for a single chat list item */
function ChatItemSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <Skeleton className="h-4 w-4 rounded" />
      <Skeleton className="h-4 flex-1" />
    </div>
  );
}

/** Skeleton for the full chat list */
export function ChatListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: count }).map((_, i) => (
        <ChatItemSkeleton key={i} />
      ))}
    </div>
  );
}

/** Skeleton for a single message bubble */
function MessageBubbleSkeleton({ isUser }: { isUser: boolean }) {
  return (
    <div className={`flex gap-3 px-4 py-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
      <div className={`space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

/** Skeleton for the message list */
export function MessageListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <MessageBubbleSkeleton key={i} isUser={i % 2 === 0} />
      ))}
    </div>
  );
}

/** Skeleton for the chat header area */
export function ChatHeaderSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3">
      <Skeleton className="h-5 w-40" />
      <div className="ml-auto flex gap-2">
        <Skeleton className="h-8 w-8 rounded" />
      </div>
    </div>
  );
}
