// Database row types matching the Supabase PostgreSQL schema

export type MessageRole = 'user' | 'assistant' | 'system';

export type DocumentStatus = 'processing' | 'ready' | 'failed';

export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Chat {
  id: string;
  user_id: string | null;
  anonymous_session_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: MessageRole;
  content: string;
  image_url: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  chat_id: string;
  file_name: string;
  file_type: string;
  extracted_text: string;
  token_count: number;
  storage_path: string;
  status: DocumentStatus;
  created_at: string;
}
