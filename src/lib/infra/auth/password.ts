import bcrypt from 'bcryptjs';

/**
 * Password hashing utilities — extracted to avoid circular dependencies
 * between session.ts and seed.ts.
 */

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
