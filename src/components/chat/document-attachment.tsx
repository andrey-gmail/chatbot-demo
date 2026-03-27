'use client';

import { useState, useRef, useCallback } from 'react';
import { FileText, Upload, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SUPPORTED_DOCUMENT_TYPES } from '@/lib/constants';
import type { Document, DocumentStatus } from '@/types/database';
import { cn } from '@/lib/utils';

interface DocumentAttachmentProps {
  chatId: string;
  documents: Document[];
  onUploadComplete: () => void;
  disabled?: boolean;
}

const ACCEPT_STRING = SUPPORTED_DOCUMENT_TYPES.map((t) => `.${t}`).join(',');

function StatusBadge({ status }: { status: DocumentStatus }) {
  switch (status) {
    case 'processing':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing
        </span>
      );
    case 'ready':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
          <CheckCircle2 className="h-3 w-3" />
          Ready
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
          <AlertCircle className="h-3 w-3" />
          Failed
        </span>
      );
  }
}

export function DocumentAttachment({
  chatId,
  documents,
  onUploadComplete,
  disabled,
}: DocumentAttachmentProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showDocuments, setShowDocuments] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploadError(null);

      // Client-side validation
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!(SUPPORTED_DOCUMENT_TYPES as readonly string[]).includes(ext)) {
        setUploadError('Unsupported format. Please use PDF, TXT, or MD.');
        return;
      }

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`/api/chats/${chatId}/documents`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message ?? 'Document upload failed');
        }

        onUploadComplete();
        setShowDocuments(true);
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : 'Document upload failed'
        );
      } finally {
        setIsUploading(false);
      }
    },
    [chatId, onUploadComplete]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [handleUpload]
  );

  const handleDelete = useCallback(
    async (docId: string) => {
      try {
        const res = await fetch(`/api/chats/${chatId}/documents/${docId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message ?? 'Failed to delete document');
        }
        onUploadComplete();
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : 'Failed to delete document'
        );
      }
    },
    [chatId, onUploadComplete]
  );

  return (
    <div>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_STRING}
        className="hidden"
        onChange={handleFileChange}
        aria-label="Attach document"
      />

      {/* Upload button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 rounded-xl h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isUploading}
        aria-label="Attach document"
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
      </Button>

      {/* Document list toggle (only show if there are documents) */}
      {documents.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground h-6 px-2"
          onClick={() => setShowDocuments(!showDocuments)}
        >
          {documents.length} doc{documents.length !== 1 ? 's' : ''}
        </Button>
      )}

      {/* Error message */}
      {uploadError && (
        <p className="text-xs text-destructive mt-1" role="alert">
          {uploadError}
        </p>
      )}

      {/* Document list panel */}
      {showDocuments && documents.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 mx-2 rounded-lg border bg-background shadow-lg p-3 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-muted-foreground">
              Attached Documents
            </h4>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => setShowDocuments(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <ul className="space-y-1.5">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-2 text-sm rounded-md px-2 py-1.5 hover:bg-muted/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-xs">{doc.file_name}</span>
                  <StatusBadge status={doc.status} />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 hover:text-destructive"
                  onClick={() => handleDelete(doc.id)}
                  aria-label={`Remove ${doc.file_name}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
