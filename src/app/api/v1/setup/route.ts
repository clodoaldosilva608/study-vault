import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';

const execAsync = promisify(exec);

const SETUP_LOCK_FILE = '/tmp/.study-vault-setup-done';
const SETUP_LOCK_FILE_DEV = '/home/z/my-project/db/.setup-done';

/**
 * Idempotent setup endpoint — applies the Prisma schema to the SQLite DB.
 * Designed to be called:
 *   1. After every Vercel deployment (via post-deploy hook).
 *   2. As a fallback on cold starts.
 *
 * On Vercel serverless, /tmp is ephemeral — each cold start needs to re-run
 * the schema push. We use a sentinel file to skip within the same warm instance.
 */
export async function POST(_req: NextRequest) {
  const isVercel = !!process.env.VERCEL;
  const lockFile = isVercel ? SETUP_LOCK_FILE : SETUP_LOCK_FILE_DEV;

  try {
    await fs.access(lockFile);
    return NextResponse.json({
      ok: true,
      data: { skipped: true, message: 'Setup already done in this instance' },
    });
  } catch {
    // not done yet — proceed
  }

  try {
    const dbDir = isVercel ? '/tmp' : '/home/z/my-project/db';
    await fs.mkdir(dbDir, { recursive: true });

    const { stdout, stderr } = await execAsync(
      'bun run db:push --skip-generate --accept-data-loss',
      {
        cwd: isVercel ? '/var/task' : '/home/z/my-project',
        timeout: 60_000,
        env: {
          ...process.env,
          DATABASE_URL:
            process.env.DATABASE_URL ||
            (isVercel ? 'file:/tmp/study-vault.db' : process.env.DATABASE_URL!),
        },
      },
    );

    await fs.writeFile(lockFile, new Date().toISOString());

    return NextResponse.json({
      ok: true,
      data: {
        setup: true,
        message: 'Schema applied successfully',
        stdout: stdout.slice(-500),
        stderr: stderr.slice(-500),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[setup] failed', message);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'SETUP_FAILED',
          message,
          details: { hint: 'Try running prisma db push manually' },
        },
      },
      { status: 500 },
    );
  }
}
