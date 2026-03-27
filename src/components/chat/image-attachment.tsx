'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageAttachmentProps {
  file: File;
  onRemove: () => void;
}

export function ImageAttachment({ file, onRemove }: ImageAttachmentProps) {
  const previewUrl = URL.createObjectURL(file);

  return (
    <div className="relative inline-block group">
      <img
        src={previewUrl}
        alt={`Preview: ${file.name}`}
        className="h-20 w-20 rounded-lg object-cover border border-border"
        onLoad={() => URL.revokeObjectURL(previewUrl)}
      />
      <Button
        type="button"
        variant="destructive"
        size="icon"
        className="absolute -top-2 -right-2 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onRemove}
        aria-label="Remove image"
      >
        <X className="h-3 w-3" />
      </Button>
      <span className="sr-only">Attached: {file.name}</span>
    </div>
  );
}
