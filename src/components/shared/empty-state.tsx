'use client';

import { MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({
  title = 'No conversations yet',
  description = 'Start a new chat to begin your conversation with the AI assistant.',
  actionLabel = 'New Chat',
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        {icon ?? <MessageSquarePlus className="h-8 w-8 text-muted-foreground" />}
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-[280px]">
          {description}
        </p>
      </div>
      {onAction && (
        <Button onClick={onAction} className="mt-2">
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
