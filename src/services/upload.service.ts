import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPPORTED_IMAGE_TYPES } from '@/lib/constants';

const BUCKET_NAME = 'chat-images';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export interface UploadResult {
  url: string;
  path: string;
}

export async function uploadImage(
  supabase: SupabaseClient,
  file: Buffer,
  mimeType: string,
  fileName: string
): Promise<UploadResult> {
  // Validate MIME type
  if (!(SUPPORTED_IMAGE_TYPES as readonly string[]).includes(mimeType)) {
    throw new UploadError(
      `Unsupported image format: ${mimeType}. Supported: PNG, JPEG, GIF, WebP.`,
      400
    );
  }

  // Validate file size
  if (file.byteLength > MAX_FILE_SIZE) {
    throw new UploadError(
      `File too large. Maximum size is 10 MB.`,
      400
    );
  }

  // Generate unique storage path
  const ext = fileName.split('.').pop() || 'png';
  const storagePath = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new UploadError(`Storage upload failed: ${error.message}`, 500);
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath);

  return {
    url: urlData.publicUrl,
    path: storagePath,
  };
}

export class UploadError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'UploadError';
    this.statusCode = statusCode;
  }
}
