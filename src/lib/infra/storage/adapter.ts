import { promises as fs } from 'fs';
import path from 'path';
import { randomBytes, createHash } from 'crypto';
import { Errors } from '@/lib/domain/errors';

const STORAGE_ROOT =
  process.env.STORAGE_ROOT ||
  (process.env.VERCEL ? '/tmp/study-vault-storage' : '/home/z/my-project/storage');

/**
 * Storage adapter interface — abstracts the file storage backend.
 * Swap implementations (LocalFsStorageAdapter → SupabaseStorageAdapter) without touching domain code.
 */
export interface IStorageAdapter {
  save(
    workspaceId: string,
    fileId: string,
    bytes: Buffer | NodeJS.ReadableStream,
    originalName: string,
  ): Promise<{ storagePath: string; sizeBytes: number; checksum: string }>;

  read(storagePath: string): Promise<Buffer>;

  delete(storagePath: string): Promise<void>;

  exists(storagePath: string): Promise<boolean>;

  /**
   * Returns a signed URL or, in the local adapter, a server-relative path
   * the caller can use to fetch the file via a dedicated endpoint.
   */
  getSignedUrl(storagePath: string, ttlSeconds?: number): Promise<string>;
}

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Local filesystem adapter. Layout:
 *   {STORAGE_ROOT}/{workspaceId}/files/{fileId}/{filename}
 *
 * The filename is sanitized and prefixed with a random token to prevent
 * collisions and traversal attacks. The client NEVER controls the final path.
 */
export class LocalFsStorageAdapter implements IStorageAdapter {
  constructor(private root: string = STORAGE_ROOT) {}

  private resolvePath(storagePath: string): string {
    const abs = path.join(this.root, storagePath);
    const normalizedRoot = path.resolve(this.root);
    const normalizedAbs = path.resolve(abs);
    if (!normalizedAbs.startsWith(normalizedRoot)) {
      throw Errors.badRequest('Invalid storage path');
    }
    return normalizedAbs;
  }

  async save(
    workspaceId: string,
    fileId: string,
    bytes: Buffer | NodeJS.ReadableStream,
    originalName: string,
  ): Promise<{ storagePath: string; sizeBytes: number; checksum: string }> {
    // Sanitize filename — keep extension only, generate random suffix
    const ext = path.extname(originalName).toLowerCase().slice(0, 16);
    const safeExt = /^[\w.-]+$/.test(ext) ? ext : '';
    const random = randomBytes(8).toString('hex');
    const filename = `${fileId}-${random}${safeExt}`;

    const relPath = path.join(workspaceId, 'files', fileId, filename);
    const absPath = this.resolvePath(relPath);

    await fs.mkdir(path.dirname(absPath), { recursive: true });

    let buffer: Buffer;
    if (Buffer.isBuffer(bytes)) {
      buffer = bytes;
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of bytes as NodeJS.ReadableStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      buffer = Buffer.concat(chunks);
    }

    await fs.writeFile(absPath, buffer);

    const checksum = sha256(buffer);
    return {
      storagePath: relPath,
      sizeBytes: buffer.length,
      checksum,
    };
  }

  async read(storagePath: string): Promise<Buffer> {
    const absPath = this.resolvePath(storagePath);
    try {
      return await fs.readFile(absPath);
    } catch {
      throw Errors.notFound('File content');
    }
  }

  async delete(storagePath: string): Promise<void> {
    const absPath = this.resolvePath(storagePath);
    try {
      await fs.rm(path.dirname(absPath), { recursive: true, force: true });
    } catch {
      // ignore — already gone
    }
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(storagePath));
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(storagePath: string): Promise<string> {
    // Local adapter returns a relative download path; the API route signs it
    // server-side using the auth context.
    const id = path.basename(path.dirname(storagePath));
    return `/api/v1/files/${id}/download`;
  }
}

// Singleton — swap implementation here when migrating to Supabase.
export const storage: IStorageAdapter = new LocalFsStorageAdapter();
