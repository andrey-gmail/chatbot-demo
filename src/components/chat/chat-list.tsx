'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { useChats, useRenameChat, useDeleteChat } from '@/hooks/use-chats';
import { ChatItem } from '@/components/chat/chat-item';
import { EmptyState } from '@/components/shared/empty-state';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatListSkeleton } from '@/components/shared/skeleton-loader';

interface ChatListProps {
  onNewChat: () => void;
  onChatSelect?: () => void;
}

export function ChatList({ onNewChat, onChatSelect }: ChatListProps) {
  const params = useParams();
  const activeChatId = params?.chatId as string | undefined;

  const { data: chats, isLoading, error } = useChats();
  const renameMutation = useRenameChat();
  const deleteMutation = useDeleteChat();

  // Toast for mutation errors — must be before any early returns
  useEffect(() => {
    if (renameMutation.isError) {
      toast.error('Failed to rename chat');
    }
  }, [renameMutation.isError]);

  useEffect(() => {
    if (deleteMutation.isError) {
      toast.error('Failed to delete chat');
    }
  }, [deleteMutation.isError]);

  const handleRename = (chatId: string, title: string) => {
    renameMutation.mutate({ chatId, title });
  };

  const handleDelete = (chatId: string) => {
    deleteMutation.mutate(chatId);
  };

  if (isLoading) {
    return <ChatListSkeleton />;
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">
        Failed to load chats. Please try again.
      </div>
    );
  }

  if (!chats || chats.length === 0) {
    return (
      <EmptyState
        title="No conversations yet"
        description="Start a new chat to begin your conversation."
        actionLabel="New Chat"
        onAction={onNewChat}
      />
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-1 p-2">
        {chats.map((chat) => (
          <ChatItem
            key={chat.id}
            chat={chat}
            isActive={chat.id === activeChatId}
            onRename={handleRename}
            onDelete={handleDelete}
            isRenaming={
              renameMutation.isPending &&
              renameMutation.variables?.chatId === chat.id
            }
            isDeleting={
              deleteMutation.isPending &&
              deleteMutation.variables === chat.id
            }
          />
        ))}
      </div>
    </ScrollArea>
  );
}
