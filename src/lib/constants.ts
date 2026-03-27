// App-wide constants

export const MAX_ANONYMOUS_QUESTIONS = 3;

export const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const;

export const SUPPORTED_DOCUMENT_TYPES = ['pdf', 'txt', 'md'] as const;

export const BROADCAST_CHANNEL_NAME = 'chat-sync';

export const POLLING_INTERVAL = 30_000;

export const MAX_CONTEXT_TOKENS = 100_000;

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20 MB
