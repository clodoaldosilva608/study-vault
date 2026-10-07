import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';
import { randomBytes, createHash } from 'crypto';
import { Errors } from '@/lib/domain/errors';

/**
 * Storage adapter interface — abstracts the file storage backend.
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

  getSignedUrl(storagePath: string, ttlSeconds?: number): Promise<string>;
}

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Supabase Storage adapter — stores files in Supabase Storage bucket.
 * This is PERSISTENT across serverless instances, unlike the local FS adapter.
 *
 * Uses the Supabase REST API directly (no SDK needed).
 * The storagePath is just the object key within the bucket.
 */
class SupabaseStorageAdapter implements IStorageAdapter {
  private supabaseUrl: string;
  private serviceKey: string;
  private bucket: string;

  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL || 'https://knqvhmowhbremhboqdip.supabase.co';
    this.serviceKey = process.env.SUPABASE_SERVICE_KEY || '';
    this.bucket = process.env.SUPABASE_BUCKET || 'study-vault-files';

    if (!this.serviceKey) {
      console.warn('[storage] SUPABASE_SERVICE_KEY not set — falling back to local FS');
    }
  }

  private get isConfigured(): boolean {
    return !!this.serviceKey;
  }

  async save(
    workspaceId: string,
    fileId: string,
    bytes: Buffer | NodeJS.ReadableStream,
    originalName: string,
  ): Promise<{ storagePath: string; sizeBytes: number; checksum: string }> {
    // Sanitize filename
    const ext = path.extname(originalName).toLowerCase().slice(0, 16);
    const safeExt = /^[\w.-]+$/.test(ext) ? ext : '';
    const random = randomBytes(8).toString('hex');
    const filename = `${fileId}-${random}${safeExt}`;
    const objectKey = `${workspaceId}/files/${fileId}/${filename}`;

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

    const checksum = sha256(buffer);

    if (this.isConfigured) {
      // Upload to Supabase Storage
      const res = await fetch(
        `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${objectKey}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.serviceKey}`,
            'Content-Type': 'application/octet-stream',
            'x-upsert': 'true',
          },
          body: buffer,
        },
      );
      if (!res.ok) {
        const errText = await res.text();
        console.error('[storage] Supabase upload failed:', res.status, errText);
        throw Errors.internal(`Storage upload failed: ${res.status}`);
      }
    } else {
      // Fallback: local filesystem
      const STORAGE_ROOT = process.env.VERCEL ? '/tmp/study-vault-storage' : '/home/z/my-project/storage';
      const absPath = path.join(STORAGE_ROOT, objectKey);
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      await fs.writeFile(absPath, buffer);
    }

    return {
      storagePath: objectKey,
      sizeBytes: buffer.length,
      checksum,
    };
  }

  async read(storagePath: string): Promise<Buffer> {
    if (this.isConfigured) {
      // Download from Supabase Storage
      const res = await fetch(
        `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${storagePath}`,
        {
          headers: { Authorization: `Bearer ${this.serviceKey}` },
        },
      );
      if (!res.ok) {
        throw Errors.notFound('File content');
      }
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } else {
      // Fallback: local filesystem
      const STORAGE_ROOT = process.env.VERCEL ? '/tmp/study-vault-storage' : '/home/z/my-project/storage';
      const absPath = path.join(STORAGE_ROOT, storagePath);
      try {
        return await fs.readFile(absPath);
      } catch {
        throw Errors.notFound('File content');
      }
    }
  }

  async delete(storagePath: string): Promise<void> {
    if (this.isConfigured) {
      try {
        await fetch(
          `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${storagePath}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${this.serviceKey}` },
          },
        );
      } catch {
        // ignore
      }
    } else {
      const STORAGE_ROOT = process.env.VERCEL ? '/tmp/study-vault-storage' : '/home/z/my-project/storage';
      const absPath = path.join(STORAGE_ROOT, storagePath);
      try {
        await fs.rm(path.dirname(absPath), { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }

  async exists(storagePath: string): Promise<boolean> {
    if (this.isConfigured) {
      const res = await fetch(
        `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${storagePath}`,
        {
          method: 'HEAD',
          headers: { Authorization: `Bearer ${this.serviceKey}` },
        },
      );
      return res.ok;
    } else {
      const STORAGE_ROOT = process.env.VERCEL ? '/tmp/study-vault-storage' : '/home/z/my-project/storage';
      try {
        await fs.access(path.join(STORAGE_ROOT, storagePath));
        return true;
      } catch {
        return false;
      }
    }
  }

  async getSignedUrl(storagePath: string): Promise<string> {
    const id = path.basename(path.dirname(storagePath));
    return `/api/v1/files/${id}/download`;
  }
}

// Singleton — uses Supabase Storage with local FS fallback
export const storage: IStorageAdapter = new SupabaseStorageAdapter();
