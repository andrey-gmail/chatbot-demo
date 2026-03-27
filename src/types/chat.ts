// Domain types for chat functionality

export interface StreamingState {
  isStreaming: boolean;
  content: string;
  chatId: string | null;
}

export interface AnonymousSession {
  id: string;
  questionCount: number;
}

export interface CrossTabEvent {
  type: 'chat:created' | 'chat:deleted' | 'chat:renamed';
  chatId: string;
  title?: string;
}
