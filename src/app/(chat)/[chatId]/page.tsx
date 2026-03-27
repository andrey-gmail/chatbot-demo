'use client';

import { use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MessageList } from '@/components/chat/message-list';
import { MessageInput } from '@/components/chat/message-input';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { useMessages } from '@/hooks/use-messages';
import { useSendMessage } from '@/hooks/use-send-message';
import { useDocuments } from '@/hooks/use-documents';
import { useAuth } from '@/hooks/use-auth';
import { useAnonymous } from '@/hooks/use-anonymous';

interface ChatPageProps {
  params: Promise<{ chatId: string }>;
}

export default function ChatPage({ params }: ChatPageProps) {
  const { chatId } = use(params);
  const router = useRouter();
  const { data: messages = [], isLoading } = useMessages(chatId);
  const { sendMessage, isStreaming, streamingContent } = useSendMessage(chatId);
  const { documents, invalidate: invalidateDocuments } = useDocuments(chatId);
  const { isAuthenticated } = useAuth();
  const { canAsk, incrementCount, questionCount, maxQuestions } = useAnonymous();

  const anonymousLimitReached = !isAuthenticated && !canAsk();

  const handleSend = useCallback(
    async (content: string, imageUrl?: string) => {
      if (!isAuthenticated && !canAsk()) {
        return;
      }

      try {
        const newChatId = await sendMessage({ content, imageUrl });

        if (!isAuthenticated) {
          incrementCount();
        }

        if (newChatId) {
          router.replace(`/${newChatId}`);
        }
      } catch {
        toast.error('Failed to send message. Please try again.');
      }
    },
    [sendMessage, router, isAuthenticated, canAsk, incrementCount]
  );

  return (
    <ErrorBoundary>
      <div className="flex h-full flex-col">
        {/* Anonymous question counter */}
        {!isAuthenticated && !anonymousLimitReached && (
          <div className="bg-muted/50 border-b px-4 py-2 text-center">
            <p className="text-xs text-muted-foreground">
              {maxQuestions - questionCount} free question{maxQuestions - questionCount !== 1 ? 's' : ''} remaining
            </p>
          </div>
        )}
        <MessageList
          messages={messages}
          isLoading={isLoading}
          isStreaming={isStreaming}
          streamingContent={streamingContent}
        />
        <MessageInput
          onSend={handleSend}
          disabled={isStreaming}
          anonymousLimitReached={anonymousLimitReached}
          chatId={chatId}
          documents={documents}
          onDocumentUploadComplete={invalidateDocuments}
        />
      </div>
    </ErrorBoundary>
  );
}
