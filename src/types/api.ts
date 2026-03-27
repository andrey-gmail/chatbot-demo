// API request/response types

import type { Chat, Message, User } from './database';

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface SignupRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateChatRequest {
  title?: string;
}

export interface RenameChatRequest {
  title: string;
}

export interface SendMessageRequest {
  content: string;
  imageUrl?: string;
}

export type ChatListResponse = Chat[];

export type ChatDetailResponse = Chat & { messages: Message[] };

export interface AuthResponse {
  user: User;
  session: {
    access_token: string;
    refresh_token: string;
  };
}
