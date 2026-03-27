import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { getOpenAIClient } from '@/lib/openai/client';
import type { AssembledContext } from '@/services/message.service';

const SYSTEM_PROMPT = `You are a helpful AI assistant. Answer questions clearly and concisely. When appropriate, use markdown formatting for code blocks, lists, and headings.`;

const DEFAULT_MODEL = 'gpt-4o-mini';

export interface StreamCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export function buildMessages(context: AssembledContext): ChatCompletionMessageParam[] {
  const messages: ChatCompletionMessageParam[] = [];

  // System message with optional document context
  let systemContent = SYSTEM_PROMPT;
  if (context.documentContext) {
    systemContent += `\n\nThe user has uploaded documents. Use the following document content as context when answering:\n\n${context.documentContext}`;
    if (context.documentsTruncated) {
      systemContent += `\n\n[Note: The document content was truncated to fit within the context window. Some information may be missing.]`;
    }
  }
  messages.push({ role: 'system', content: systemContent });

  // Conversation history
  for (const msg of context.messages) {
    if (msg.role === 'system') continue;
    messages.push({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    });
  }

  return messages;
}

export async function* streamCompletion(
  messages: ChatCompletionMessageParam[],
  options?: StreamCompletionOptions
): AsyncGenerator<string, void, unknown> {
  const client = getOpenAIClient();

  const stream = await client.chat.completions.create({
    model: options?.model ?? DEFAULT_MODEL,
    messages,
    stream: true,
    temperature: options?.temperature ?? 0.7,
    ...(options?.maxTokens ? { max_tokens: options.maxTokens } : {}),
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}
