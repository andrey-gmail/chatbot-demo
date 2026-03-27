import type { SupabaseClient } from '@supabase/supabase-js';
import type { Document } from '@/types/database';
import { SUPPORTED_DOCUMENT_TYPES } from '@/lib/constants';

const BUCKET_NAME = 'chat-documents';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export class DocumentServiceError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'DocumentServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Estimate token count using chars / 4 heuristic.
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Get file extension from filename, normalized to lowercase.
 */
function getFileType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return ext;
}

/**
 * Validate that the file type is supported.
 */
export function validateFileType(fileName: string): string {
  const fileType = getFileType(fileName);
  if (!(SUPPORTED_DOCUMENT_TYPES as readonly string[]).includes(fileType)) {
    throw new DocumentServiceError(
      `Unsupported document format: .${fileType}. Supported: PDF, TXT, MD.`,
      'VALIDATION_ERROR',
      400
    );
  }
  return fileType;
}

/**
 * Extract text content from a file buffer based on its type.
 */
export async function extractText(
  buffer: Buffer,
  fileType: string
): Promise<string> {
  if (fileType === 'txt' || fileType === 'md') {
    return buffer.toString('utf-8');
  }

  if (fileType === 'pdf') {
    try {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      return result.text;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown PDF parsing error';
      throw new DocumentServiceError(
        `Failed to extract text from PDF: ${message}`,
        'EXTRACTION_ERROR',
        422
      );
    }
  }

  throw new DocumentServiceError(
    `No text extractor for file type: ${fileType}`,
    'EXTRACTION_ERROR',
    422
  );
}


/**
 * Upload a document: store in Supabase Storage, extract text, save record.
 */
export async function upload(
  supabase: SupabaseClient,
  chatId: string,
  buffer: Buffer,
  fileName: string
): Promise<Document> {
  // Validate file type
  const fileType = validateFileType(fileName);

  // Validate file size
  if (buffer.byteLength > MAX_FILE_SIZE) {
    throw new DocumentServiceError(
      'File too large. Maximum size is 20 MB.',
      'VALIDATION_ERROR',
      400
    );
  }

  // Generate storage path
  const storagePath = `${chatId}/${Date.now()}-${crypto.randomUUID()}.${fileType}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: fileType === 'pdf' ? 'application/pdf' : 'text/plain',
      upsert: false,
    });

  if (uploadError) {
    throw new DocumentServiceError(
      `Storage upload failed: ${uploadError.message}`,
      'INTERNAL_ERROR',
      500
    );
  }

  // Insert document record with status 'processing'
  const { data: doc, error: insertError } = await supabase
    .from('documents')
    .insert({
      chat_id: chatId,
      file_name: fileName,
      file_type: fileType,
      storage_path: storagePath,
      status: 'processing',
      extracted_text: '',
      token_count: 0,
    })
    .select()
    .single();

  if (insertError || !doc) {
    // Clean up storage on DB insert failure
    await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
    throw new DocumentServiceError(
      'Failed to create document record',
      'INTERNAL_ERROR',
      500
    );
  }

  // Extract text and update record
  try {
    const text = await extractText(buffer, fileType);
    const tokenCount = estimateTokenCount(text);

    const { data: updated, error: updateError } = await supabase
      .from('documents')
      .update({
        extracted_text: text,
        token_count: tokenCount,
        status: 'ready',
      })
      .eq('id', doc.id)
      .select()
      .single();

    if (updateError || !updated) {
      throw new Error('Failed to update document status');
    }

    return updated as Document;
  } catch (err) {
    // Mark as failed on extraction error
    const errorMessage = err instanceof Error ? err.message : 'Text extraction failed';
    await supabase
      .from('documents')
      .update({ status: 'failed' })
      .eq('id', doc.id);

    throw new DocumentServiceError(
      errorMessage,
      'EXTRACTION_ERROR',
      422
    );
  }
}

/**
 * List all documents for a chat.
 */
export async function listByChatId(
  supabase: SupabaseClient,
  chatId: string
): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new DocumentServiceError(
      'Failed to fetch documents',
      'INTERNAL_ERROR',
      500
    );
  }

  return (data ?? []) as Document[];
}

/**
 * Delete a document record and its storage file.
 */
export async function deleteDocument(
  supabase: SupabaseClient,
  docId: string
): Promise<void> {
  // Fetch the document to get storage path
  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', docId)
    .single();

  if (fetchError || !doc) {
    throw new DocumentServiceError(
      'Document not found',
      'NOT_FOUND',
      404
    );
  }

  // Remove from storage
  if (doc.storage_path) {
    await supabase.storage.from(BUCKET_NAME).remove([doc.storage_path]);
  }

  // Remove DB record
  const { error: deleteError } = await supabase
    .from('documents')
    .delete()
    .eq('id', docId);

  if (deleteError) {
    throw new DocumentServiceError(
      'Failed to delete document',
      'INTERNAL_ERROR',
      500
    );
  }
}

/**
 * Get a single document by ID.
 */
export async function getById(
  supabase: SupabaseClient,
  docId: string
): Promise<Document> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', docId)
    .single();

  if (error || !data) {
    throw new DocumentServiceError(
      'Document not found',
      'NOT_FOUND',
      404
    );
  }

  return data as Document;
}
