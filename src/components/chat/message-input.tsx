'use client';

import { useState, useRef, useCallback } from 'react';
import { Send, Paperclip } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ImageAttachment } from '@/components/chat/image-attachment';
import { DocumentAttachment } from '@/components/chat/document-attachment';
import { SUPPORTED_IMAGE_TYPES } from '@/lib/constants';
import type { Document } from '@/types/database';
import { cn } from '@/lib/utils';

interface MessageInputProps {
  onSend: (content: string, imageUrl?: string) => void;
  disabled?: boolean;
  className?: string;
  /** Whether the anonymous question limit has been reached */
  anonymousLimitReached?: boolean;
  /** Chat ID for document uploads */
  chatId?: string;
  /** Documents attached to this chat */
  documents?: Document[];
  /** Callback when a document upload completes */
  onDocumentUploadComplete?: () => void;
}

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/uploads/images', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message ?? 'Image upload failed');
  }

  const data = await res.json();
  return data.url;
}

export function MessageInput({ onSend, disabled, className, anonymousLimitReached, chatId, documents, onDocumentUploadComplete }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSetImage = useCallback((file: File) => {
    setImageError(null);
    if (!(SUPPORTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      const msg = 'Unsupported format. Please use PNG, JPEG, GIF, or WebP.';
      setImageError(msg);
      toast.error(msg);
      return;
    }
    setImageFile(file);
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) validateAndSetImage(file);
          return;
        }
      }
    },
    [validateAndSetImage]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSetImage(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [validateAndSetImage]
  );

  const handleSubmit = useCallback(async () => {
    const trimmed = content.trim();
    if ((!trimmed && !imageFile) || disabled || isUploading || anonymousLimitReached) return;

    let imageUrl: string | undefined;

    if (imageFile) {
      try {
        setIsUploading(true);
        imageUrl = await uploadImage(imageFile);
      } catch (err) {
        setImageError(
          err instanceof Error ? err.message : 'Image upload failed'
        );
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    onSend(trimmed || '(image)', imageUrl);
    setContent('');
    setImageFile(null);
    setImageError(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [content, imageFile, disabled, isUploading, onSend, anonymousLimitReached]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  const isBusy = disabled || isUploading;
  const canSend = (content.trim() || imageFile) && !isBusy && !anonymousLimitReached;

  return (
    <div className={cn('border-t bg-background p-4', className)}>
      <div className="max-w-3xl mx-auto">
        {/* Anonymous limit reached banner */}
        {anonymousLimitReached && (
          <div className="mb-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-center" role="alert">
            <p className="text-sm font-medium text-foreground mb-2">
              You&apos;ve used all 3 free questions
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Sign up for a free account to continue chatting
            </p>
            <div className="flex items-center justify-center gap-2">
              <Link href="/signup">
                <Button size="sm">Sign up free</Button>
              </Link>
              <Link href="/login">
                <Button size="sm" variant="outline">Log in</Button>
              </Link>
            </div>
          </div>
        )}

        {/* Image preview */}
        {imageFile && (
          <div className="mb-2 px-2">
            <ImageAttachment
              file={imageFile}
              onRemove={() => {
                setImageFile(null);
                setImageError(null);
              }}
            />
          </div>
        )}

        {/* Error message */}
        {imageError && (
          <p className="text-xs text-destructive mb-2 px-2" role="alert">
            {imageError}
          </p>
        )}

        <div className="relative flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={handleFileChange}
            aria-label="Attach image"
          />

          {/* Attach image button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-xl h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy || anonymousLimitReached}
            aria-label="Attach image"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          {/* Attach document button */}
          {chatId && chatId !== 'new' && onDocumentUploadComplete && (
            <DocumentAttachment
              chatId={chatId}
              documents={documents ?? []}
              onUploadComplete={onDocumentUploadComplete}
              disabled={isBusy || anonymousLimitReached}
            />
          )}

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onPaste={handlePaste}
            placeholder={
              anonymousLimitReached
                ? 'Sign up to continue chatting…'
                : isBusy
                  ? 'Waiting…'
                  : 'Type a message…'
            }
            disabled={isBusy || anonymousLimitReached}
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50 max-h-[200px]"
          />

          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!canSend}
            className="shrink-0 rounded-xl h-8 w-8"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
