import { createHash, randomBytes } from 'crypto';

/**
 * Hash a plaintext API key with SHA-256. The plaintext is never stored.
 * Returns the hex digest.
 */
export function hashApiKey(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

/**
 * Format: `sva_<workspaceShortId>_<randomSecret>`
 * - `sva` prefix identifies Study Vault Agent tokens
 * - workspaceShortId (8 chars) helps identify the workspace at a glance
 * - randomSecret is 32 hex chars (128 bits of entropy)
 */
export function generateApiKey(workspaceId: string): {
  plain: string;
  hash: string;
  prefix: string;
} {
  const shortId = workspaceId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).padEnd(8, 'x');
  const secret = randomBytes(16).toString('hex');
  const plain = `sva_${shortId}_${secret}`;
  const hash = hashApiKey(plain);
  const prefix = plain.slice(0, 12);
  return { plain, hash, prefix };
}

export function generateRequestKey(): string {
  return randomBytes(12).toString('hex');
}

export function generateIdempotencyKey(): string {
  return randomBytes(16).toString('hex');
}
