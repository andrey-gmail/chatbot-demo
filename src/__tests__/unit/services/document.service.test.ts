import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateFileType,
  extractText,
  estimateTokenCount,
  DocumentServiceError,
} from '@/services/document.service';
import * as documentService from '@/services/document.service';

// Mock pdf-parse
vi.mock('pdf-parse', () => ({
  PDFParse: class {
    getText() {
      return Promise.resolve({ text: 'Extracted PDF text content' });
    }
  },
}));

describe('document.service', () => {
  describe('validateFileType', () => {
    it('accepts pdf files', () => {
      expect(validateFileType('report.pdf')).toBe('pdf');
    });

    it('accepts txt files', () => {
      expect(validateFileType('notes.txt')).toBe('txt');
    });

    it('accepts md files', () => {
      expect(validateFileType('README.md')).toBe('md');
    });

    it('accepts uppercase extensions', () => {
      expect(validateFileType('REPORT.PDF')).toBe('pdf');
    });

    it('rejects unsupported file types', () => {
      expect(() => validateFileType('image.png')).toThrow(DocumentServiceError);
      expect(() => validateFileType('data.csv')).toThrow(DocumentServiceError);
      expect(() => validateFileType('script.js')).toThrow(DocumentServiceError);
    });

    it('rejects files with no extension', () => {
      expect(() => validateFileType('noextension')).toThrow(DocumentServiceError);
    });
  });

  describe('estimateTokenCount', () => {
    it('estimates tokens as chars / 4', () => {
      expect(estimateTokenCount('abcd')).toBe(1);
      expect(estimateTokenCount('abcde')).toBe(2);
      expect(estimateTokenCount('')).toBe(0);
    });

    it('rounds up for partial tokens', () => {
      expect(estimateTokenCount('ab')).toBe(1); // 2/4 = 0.5 → ceil = 1
    });
  });

  describe('extractText', () => {
    it('extracts text from TXT files', async () => {
      const buffer = Buffer.from('Hello, world!');
      const result = await extractText(buffer, 'txt');
      expect(result).toBe('Hello, world!');
    });

    it('extracts text from MD files', async () => {
      const buffer = Buffer.from('# Heading\n\nSome content');
      const result = await extractText(buffer, 'md');
      expect(result).toBe('# Heading\n\nSome content');
    });

    it('extracts text from PDF files using pdf-parse', async () => {
      const buffer = Buffer.from('fake pdf content');
      const result = await extractText(buffer, 'pdf');
      expect(result).toBe('Extracted PDF text content');
    });

    it('throws for unsupported file types', async () => {
      const buffer = Buffer.from('data');
      await expect(extractText(buffer, 'csv')).rejects.toThrow(DocumentServiceError);
    });
  });

  describe('upload', () => {
    let mockSupabase: ReturnType<typeof createMockSupabase>;

    function createMockSupabase() {
      const storageMock = {
        upload: vi.fn().mockResolvedValue({ error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      };

      const fromChain: Record<string, ReturnType<typeof vi.fn>> = {};
      fromChain.insert = vi.fn(() => fromChain);
      fromChain.select = vi.fn(() => fromChain);
      fromChain.single = vi.fn().mockResolvedValue({
        data: {
          id: 'doc-1',
          chat_id: 'chat-1',
          file_name: 'test.txt',
          file_type: 'txt',
          storage_path: 'chat-1/123.txt',
          status: 'processing',
          extracted_text: '',
          token_count: 0,
          created_at: '2024-01-01T00:00:00Z',
        },
        error: null,
      });
      fromChain.update = vi.fn(() => fromChain);
      fromChain.eq = vi.fn(() => fromChain);

      // For the update call, we need single to return the updated doc
      let singleCallCount = 0;
      fromChain.single = vi.fn(() => {
        singleCallCount++;
        if (singleCallCount === 1) {
          // insert().select().single()
          return Promise.resolve({
            data: {
              id: 'doc-1',
              chat_id: 'chat-1',
              file_name: 'test.txt',
              file_type: 'txt',
              storage_path: 'chat-1/123.txt',
              status: 'processing',
              extracted_text: '',
              token_count: 0,
              created_at: '2024-01-01T00:00:00Z',
            },
            error: null,
          });
        }
        // update().eq().select().single()
        return Promise.resolve({
          data: {
            id: 'doc-1',
            chat_id: 'chat-1',
            file_name: 'test.txt',
            file_type: 'txt',
            storage_path: 'chat-1/123.txt',
            status: 'ready',
            extracted_text: 'Hello, world!',
            token_count: 4,
            created_at: '2024-01-01T00:00:00Z',
          },
          error: null,
        });
      });

      return {
        from: vi.fn(() => fromChain),
        storage: {
          from: vi.fn(() => storageMock),
        },
        _chain: fromChain,
        _storage: storageMock,
      } as unknown as Parameters<typeof documentService.upload>[0] & {
        _chain: typeof fromChain;
        _storage: typeof storageMock;
      };
    }

    beforeEach(() => {
      mockSupabase = createMockSupabase();
    });

    it('uploads a TXT file and returns a ready document', async () => {
      const buffer = Buffer.from('Hello, world!');
      const result = await documentService.upload(mockSupabase, 'chat-1', buffer, 'test.txt');

      expect(result.status).toBe('ready');
      expect(result.file_name).toBe('test.txt');
    });

    it('rejects unsupported file types', async () => {
      const buffer = Buffer.from('data');
      await expect(
        documentService.upload(mockSupabase, 'chat-1', buffer, 'data.csv')
      ).rejects.toThrow(DocumentServiceError);
    });

    it('rejects files exceeding size limit', async () => {
      // Create a buffer larger than 20MB
      const buffer = Buffer.alloc(21 * 1024 * 1024);
      await expect(
        documentService.upload(mockSupabase, 'chat-1', buffer, 'big.txt')
      ).rejects.toThrow('File too large');
    });
  });

  describe('listByChatId', () => {
    it('returns documents for a chat', async () => {
      const mockDocs = [
        { id: 'doc-1', chat_id: 'chat-1', file_name: 'a.txt', status: 'ready' },
      ];
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.order = vi.fn().mockResolvedValue({ data: mockDocs, error: null });

      const supabase = {
        from: vi.fn(() => chain),
      } as unknown as Parameters<typeof documentService.listByChatId>[0];

      const result = await documentService.listByChatId(supabase, 'chat-1');
      expect(result).toEqual(mockDocs);
    });
  });

  describe('deleteDocument', () => {
    it('deletes document record and storage file', async () => {
      const storageMock = {
        remove: vi.fn().mockResolvedValue({ error: null }),
      };

      let callCount = 0;
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.select = vi.fn(() => chain);
      chain.delete = vi.fn(() => chain);
      chain.eq = vi.fn(() => {
        callCount++;
        // First eq chain: select().eq().single() for fetch
        if (callCount === 1) return chain;
        // Second eq: after delete
        if (callCount === 2) return Promise.resolve({ error: null });
        return chain;
      });
      chain.single = vi.fn().mockResolvedValue({
        data: { id: 'doc-1', storage_path: 'chat-1/file.txt', chat_id: 'chat-1' },
        error: null,
      });

      const supabase = {
        from: vi.fn(() => chain),
        storage: { from: vi.fn(() => storageMock) },
      } as unknown as Parameters<typeof documentService.deleteDocument>[0];

      await documentService.deleteDocument(supabase, 'doc-1');
      expect(storageMock.remove).toHaveBeenCalledWith(['chat-1/file.txt']);
    });

    it('throws NOT_FOUND for non-existent document', async () => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } });

      const supabase = {
        from: vi.fn(() => chain),
      } as unknown as Parameters<typeof documentService.deleteDocument>[0];

      await expect(documentService.deleteDocument(supabase, 'nonexistent')).rejects.toThrow(
        'Document not found'
      );
    });
  });
});
