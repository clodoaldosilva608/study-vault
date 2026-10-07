/**
 * Study Vault — Unified API v1 Catch-All Route
 *
 * WHY: On Vercel serverless, each route file becomes a SEPARATE function
 * with its own /tmp. By consolidating ALL API endpoints into ONE catch-all
 * route, every request shares the same function instance and the same /tmp
 * SQLite database. This means folder/file operations persist across requests
 * within a warm session.
 *
 * Routes handled:
 *   auth/login | auth/register | auth/logout | auth/me | auth/change-password
 *   workspaces/me | workspaces/usage
 *   folders (CRUD) | folders/{id}/restore
 *   files (list/upload/CRUD) | files/{id}/download
 *   search | favorites | recent | trash (list/empty/restore)
 *   notes (CRUD)
 *   audit
 *   agent/credentials | agent/tools | agent/invoke
 *   obsidian/import | obsidian/export
 *   setup
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Errors, toHttpError } from '@/lib/domain/errors';
import {
  requireAuth,
  requireRole,
  signSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getAuthContext,
} from '@/lib/infra/auth/session';
import { hashPassword, verifyPassword } from '@/lib/infra/auth/password';
import { ensureSeedUser } from '@/lib/infra/auth/seed';
import { agentService } from '@/lib/agent/service';
import { TOOL_REGISTRY, listToolManifest } from '@/lib/agent/registry';
import { workspaceService } from '@/lib/services/workspace';
import { folderService } from '@/lib/services/folder';
import { fileService } from '@/lib/services/file';
import { favoriteService, recentService } from '@/lib/services/favorite';
import { noteService } from '@/lib/services/note';
import { audit } from '@/lib/infra/audit/audit';
import { storage } from '@/lib/infra/storage/adapter';
import {
  AUDIT_ACTION,
  AUDIT_OUTCOME,
  ROLE,
} from '@/lib/domain/constants';
import { generateRequestKey } from '@/lib/infra/auth/api-key';
import { validate, paginated } from '@/lib/api/handler';
import {
  registerSchema,
  loginSchema,
  createFolderSchema,
  renameFolderSchema,
  moveFolderSchema,
  moveFileSchema,
  renameFileSchema,
  createNoteSchema,
  updateNoteSchema,
  searchSchema,
  agentIssueCredentialSchema,
  agentInvokeToolSchema,
} from '@/lib/schemas';

// ---- Helpers ----

function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function fail(err: unknown) {
  const { statusCode, body } = toHttpError(err);
  return NextResponse.json({ ok: false, ...body }, { status: statusCode });
}

function pag(items: unknown[], total: number, page: number, pageSize: number) {
  return ok({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

async function getBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// ---- Main dispatcher ----

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return dispatch(req, await ctx.params, 'GET');
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return dispatch(req, await ctx.params, 'POST');
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return dispatch(req, await ctx.params, 'PATCH');
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return dispatch(req, await ctx.params, 'DELETE');
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return dispatch(req, await ctx.params, 'PUT');
}

// Force dynamic — never cache API responses
export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutes for migrate endpoint

// Cache: only run ensureSeedUser once per warm instance
let _seeded = false;

async function dispatch(req: NextRequest, params: { path: string[] }, method: string) {
  try {
    // Only run seed check once per warm instance (not on every request!)
    if (!_seeded) {
      await ensureSeedUser();
      _seeded = true;
    }

    return await routeRequest(req, params.path, method);
  } catch (err) {
    return fail(err);
  }
}

async function routeRequest(req: NextRequest, p: string[], method: string) {
    const url = new URL(req.url);
    const q = url.searchParams;

    // ---- AUTH ----
    if (p[0] === 'auth') {
      if (p[1] === 'login' && method === 'POST') return handleLogin(req);
      if (p[1] === 'register' && method === 'POST') return handleRegister(req);
      if (p[1] === 'logout' && method === 'POST') return handleLogout();
      if (p[1] === 'me' && method === 'GET') return handleMe();
      if (p[1] === 'change-password' && method === 'POST') return handleChangePassword(req);
    }

    // ---- WORKSPACES ----
    if (p[0] === 'workspaces') {
      if (p[1] === 'me' && method === 'GET') return handleWorkspaceMe();
      if (p[1] === 'usage' && method === 'GET') return handleUsage();
    }

    // ---- FOLDERS ----
    if (p[0] === 'folders') {
      if (!p[1] && method === 'GET') return handleListFolders(q);
      if (!p[1] && method === 'POST') return handleCreateFolder(req);
      if (p[1] && !p[2] && method === 'GET') return handleGetFolder(p[1]);
      if (p[1] && !p[2] && method === 'PATCH') return handleUpdateFolder(req, p[1]);
      if (p[1] && !p[2] && method === 'DELETE') return handleDeleteFolder(p[1]);
      if (p[1] && p[2] === 'restore' && method === 'POST') return handleRestoreFolder(p[1]);
    }

    // ---- FILES ----
    if (p[0] === 'files') {
      if (!p[1] && method === 'GET') return handleListFiles(q);
      if (p[1] === 'upload' && method === 'POST') return handleUploadFile(req);
      if (p[1] && !p[2] && method === 'GET') return handleGetFile(p[1]);
      if (p[1] && !p[2] && method === 'PATCH') return handleUpdateFile(req, p[1]);
      if (p[1] && !p[2] && method === 'DELETE') return handleDeleteFile(p[1], q);
      if (p[1] && p[2] === 'download' && method === 'GET') return handleDownloadFile(p[1]);
      if (p[1] && p[2] === 'view' && method === 'GET') return handleViewFile(p[1]);
    }

    // ---- SEARCH ----
    if (p[0] === 'search' && method === 'GET') return handleSearch(q);

    // ---- FAVORITES ----
    if (p[0] === 'favorites') {
      if (!p[1] && method === 'GET') return handleListFavorites();
      if (!p[1] && method === 'POST') return handleAddFavorite(req);
      if (!p[1] && method === 'DELETE') return handleRemoveFavorite(q);
    }

    // ---- RECENT ----
    if (p[0] === 'recent' && method === 'GET') return handleListRecent(q);

    // ---- TRASH ----
    if (p[0] === 'trash') {
      if (!p[1] && method === 'GET') return handleListTrash(q);
      if (!p[1] && method === 'DELETE') return handleEmptyTrash(q);
      if (p[1] && p[2] === 'restore' && method === 'POST') return handleRestoreFile(p[1]);
    }

    // ---- NOTES ----
    if (p[0] === 'notes') {
      if (!p[1] && method === 'GET') return handleListNotes(q);
      if (!p[1] && method === 'POST') return handleCreateNote(req);
      if (p[1] && !p[2] && method === 'GET') return handleGetNote(p[1]);
      if (p[1] && !p[2] && method === 'PATCH') return handleUpdateNote(req, p[1]);
      if (p[1] && !p[2] && method === 'DELETE') return handleDeleteNote(p[1]);
    }

    // ---- AUDIT ----
    if (p[0] === 'audit' && method === 'GET') return handleListAudit(q);

    // ---- AGENT ----
    if (p[0] === 'agent') {
      if (p[1] === 'credentials' && !p[2] && method === 'GET') return handleListAgentCreds();
      if (p[1] === 'credentials' && !p[2] && method === 'POST') return handleIssueAgentCred(req);
      if (p[1] === 'credentials' && p[2] && method === 'DELETE') return handleRevokeAgentCred(p[2]);
      if (p[1] === 'tools' && method === 'GET') return handleAgentTools(req);
      if (p[1] === 'invoke' && method === 'POST') return handleAgentInvoke(req);
    }

    // ---- OBSIDIAN ----
    if (p[0] === 'obsidian') {
      if (p[1] === 'import' && method === 'POST') return handleObsidianImport(req);
      if (p[1] === 'export' && method === 'GET') return handleObsidianExport(q);
    }

    // ---- SETUP ----
    if (p[0] === 'setup' && method === 'POST') {
      await ensureSeedUser();
      return ok({ setup: true, message: 'Seed ready' });
    }

    return fail(Errors.notFound('API endpoint'));
}

// ============================================================
// AUTH HANDLERS
// ============================================================

async function handleLogin(req: NextRequest) {
  const body = await getBody(req);
  const data = validate(loginSchema, body);

  const user = await db.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });
  if (!user) throw Errors.unauthorized('Invalid credentials');

  const passwordOk = await verifyPassword(data.password, user.passwordHash);
  if (!passwordOk) {
    await audit.record({
      workspaceId: 'unknown',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      action: AUDIT_ACTION.USER_LOGIN,
      requestId: generateRequestKey(),
      outcome: AUDIT_OUTCOME.DENIED,
      metadata: { reason: 'invalid_password' },
    }).catch(() => null);
    throw Errors.unauthorized('Invalid credentials');
  }

  const membership = await db.workspaceMember.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });
  if (!membership) throw Errors.internal('User has no workspace');

  const workspace = await db.workspace.findUnique({
    where: { id: membership.workspaceId },
    select: { id: true, name: true, slug: true, plan: true, storageLimitBytes: true },
  });

  await audit.record({
    workspaceId: membership.workspaceId,
    actorType: 'USER',
    actorId: user.id,
    actorName: user.email,
    action: AUDIT_ACTION.USER_LOGIN,
    requestId: generateRequestKey(),
    metadata: {},
  });

  const token = signSessionToken({ sub: user.id, email: user.email });
  await setSessionCookie(token);

  return ok({
    user: { id: user.id, email: user.email, name: user.name },
    workspace,
    role: membership.role,
  });
}

async function handleRegister(req: NextRequest) {
  const body = await getBody(req);
  const data = validate(registerSchema, body);

  const existing = await db.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });
  if (existing) throw Errors.conflict('Email already registered');

  const passwordHash = await hashPassword(data.password);
  const user = await db.user.create({
    data: {
      email: data.email.toLowerCase(),
      name: data.name || null,
      passwordHash,
    },
  });

  const { workspaceId } = await workspaceService.createPersonalWorkspace({
    ownerId: user.id,
    ownerEmail: user.email,
    name: data.name ? `Personal — ${data.name}` : undefined,
  });

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, slug: true, plan: true, storageLimitBytes: true },
  });

  await audit.record({
    workspaceId,
    actorType: 'USER',
    actorId: user.id,
    actorName: user.email,
    action: AUDIT_ACTION.USER_REGISTER,
    requestId: generateRequestKey(),
    metadata: { email: user.email },
  });

  const token = signSessionToken({ sub: user.id, email: user.email });
  await setSessionCookie(token);

  return ok({
    user: { id: user.id, email: user.email, name: user.name },
    workspace,
    role: 'OWNER',
  }, 201);
}

async function handleLogout() {
  const ctx = await getAuthContext();
  if (ctx) {
    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: ctx.user.id,
      actorName: ctx.user.email,
      action: AUDIT_ACTION.USER_LOGOUT,
      requestId: ctx.requestId,
    });
  }
  await clearSessionCookie();
  return ok({ ok: true });
}

async function handleMe() {
  const ctx = await getAuthContext();
  if (!ctx) return ok({ user: null, workspace: null, role: null });

  const workspace = await db.workspace.findUnique({
    where: { id: ctx.workspaceId },
    select: { id: true, name: true, slug: true, plan: true, storageLimitBytes: true },
  });

  return ok({
    user: ctx.user,
    workspace,
    role: ctx.role,
  });
}

async function handleChangePassword(req: NextRequest) {
  const ctx = await requireAuth();
  const body = await getBody(req);
  const currentPassword = body.currentPassword as string;
  const newPassword = body.newPassword as string;

  if (!currentPassword || !newPassword) throw Errors.badRequest('Missing fields');
  if (newPassword.length < 8) throw Errors.badRequest('Password too short');
  if (newPassword === currentPassword) throw Errors.badRequest('Must be different');

  const user = await db.user.findUnique({ where: { id: ctx.user.id } });
  if (!user) throw Errors.unauthorized();

  const passwordOk = await verifyPassword(currentPassword, user.passwordHash);
  if (!passwordOk) {
    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      action: AUDIT_ACTION.USER_PASSWORD_CHANGE,
      requestId: ctx.requestId,
      outcome: AUDIT_OUTCOME.DENIED,
      metadata: { reason: 'invalid_current_password' },
    });
    throw Errors.unauthorized('Current password is incorrect');
  }

  const newHash = await hashPassword(newPassword);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  await audit.record({
    workspaceId: ctx.workspaceId,
    actorType: 'USER',
    actorId: user.id,
    actorName: user.email,
    action: AUDIT_ACTION.USER_PASSWORD_CHANGE,
    requestId: ctx.requestId,
    metadata: { password_changed: true },
  });

  await clearSessionCookie();
  return ok({ ok: true, message: 'Password changed. Please sign in again.' });
}

// ============================================================
// WORKSPACE HANDLERS
// ============================================================

async function handleWorkspaceMe() {
  const ctx = await requireAuth();
  const ws = await workspaceService.getMembership(ctx.user.id, ctx.workspaceId);
  return ok({ workspace: ws.workspace, role: ws.role });
}

async function handleUsage() {
  const ctx = await requireAuth();
  const usage = await workspaceService.getUsage(ctx);
  return ok(usage);
}

// ============================================================
// FOLDER HANDLERS
// ============================================================

async function handleListFolders(q: URLSearchParams) {
  const ctx = await requireAuth();
  const parentId = q.get('parentId');
  const includeDeleted = q.get('includeDeleted') === 'true';
  const page = Number(q.get('page') || '1');
  const pageSize = Number(q.get('pageSize') || '100');
  const { items, total } = await folderService.list(ctx, {
    parentId: parentId === 'null' ? null : parentId ?? undefined,
    includeDeleted,
    page,
    pageSize,
  });
  return pag(items, total, page, pageSize);
}

async function handleCreateFolder(req: NextRequest) {
  const ctx = await requireAuth();
  const body = await getBody(req);
  const data = validate(createFolderSchema, body);
  const folder = await folderService.create(ctx, {
    name: data.name,
    parentId: data.parentId ?? null,
  });
  return ok(folder, 201);
}

async function handleGetFolder(id: string) {
  const ctx = await requireAuth();
  return ok(await folderService.get(ctx, id));
}

async function handleUpdateFolder(req: NextRequest, id: string) {
  const ctx = await requireAuth();
  const body = await getBody(req);
  if (typeof body.name === 'string') {
    const data = validate(renameFolderSchema, body);
    return ok(await folderService.rename(ctx, id, data.name));
  }
  if ('parentId' in body) {
    const data = validate(moveFolderSchema, body);
    await folderService.move(ctx, id, data.parentId ?? null);
    return ok({ ok: true });
  }
  throw Errors.badRequest('Nothing to update');
}

async function handleDeleteFolder(id: string) {
  const ctx = await requireAuth();
  await folderService.softDelete(ctx, id);
  return ok({ ok: true });
}

async function handleRestoreFolder(id: string) {
  const ctx = await requireAuth();
  await folderService.restore(ctx, id);
  return ok({ ok: true });
}

// ============================================================
// FILE HANDLERS
// ============================================================

async function handleListFiles(q: URLSearchParams) {
  const ctx = await requireAuth();
  const folderId = q.get('folderId');
  const includeDeleted = q.get('includeDeleted') === 'true';
  const favoriteOnly = q.get('favorite') === 'true';
  const extension = q.get('extension') || undefined;
  const mimeType = q.get('mimeType') || undefined;
  const page = Number(q.get('page') || '1');
  const pageSize = Number(q.get('pageSize') || '50');
  const { items, total } = await fileService.list(ctx, {
    folderId: folderId === 'null' ? null : folderId ?? undefined,
    includeDeleted,
    favoriteOnly,
    extension,
    mimeType,
    page,
    pageSize,
  });
  return pag(items, total, page, pageSize);
}

async function handleUploadFile(req: NextRequest) {
  const ctx = await requireAuth();
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const folderIdRaw = formData.get('folderId') as string | null;
  if (!file) throw Errors.badRequest('No file provided');
  const folderId = folderIdRaw && folderIdRaw !== 'null' ? folderIdRaw : null;
  const bytes = Buffer.from(await file.arrayBuffer());
  const created = await fileService.upload(ctx, {
    name: file.name,
    folderId,
    bytes,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
  });
  return ok({ file: created }, 201);
}

async function handleGetFile(id: string) {
  const ctx = await requireAuth();
  return ok(await fileService.get(ctx, id));
}

async function handleUpdateFile(req: NextRequest, id: string) {
  const ctx = await requireAuth();
  const body = await getBody(req);
  if (typeof body.name === 'string') {
    const data = validate(renameFileSchema, body);
    return ok(await fileService.rename(ctx, id, data.name));
  }
  if ('folderId' in body) {
    const data = validate(moveFileSchema, body);
    return ok(await fileService.move(ctx, id, data.folderId ?? null));
  }
  throw Errors.badRequest('Nothing to update');
}

async function handleDeleteFile(id: string, q: URLSearchParams) {
  const ctx = await requireAuth();
  const permanent = q.get('permanent') === 'true';
  if (permanent) {
    await fileService.purge(ctx, id);
  } else {
    await fileService.softDelete(ctx, id);
  }
  return ok({ ok: true });
}

async function handleDownloadFile(id: string) {
  const ctx = await requireAuth();
  const { buffer, file } = await fileService.getDownloadBuffer(ctx, id);
  const contentType = file.mimeType || 'application/octet-stream';
  const filename = encodeURIComponent(file.name);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-disposition': `attachment; filename="${filename}"`,
      'content-length': String(buffer.length),
      'cache-control': 'private, no-store',
    },
  });
}

/**
 * View endpoint — returns the file with Content-Disposition: inline
 * so the browser DISPLAYS it (PDF in iframe, image in img tag, etc.)
 * instead of forcing a download.
 */
async function handleViewFile(id: string) {
  const ctx = await requireAuth();
  const { buffer, file } = await fileService.getDownloadBuffer(ctx, id);
  const contentType = file.mimeType || 'application/octet-stream';
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-disposition': 'inline',
      'content-length': String(buffer.length),
      'cache-control': 'private, max-age=60',
    },
  });
}

// ============================================================
// SEARCH
// ============================================================

async function handleSearch(q: URLSearchParams) {
  const ctx = await requireAuth();
  const data = validate(searchSchema, {
    query: q.get('query') || '',
    folderId: q.get('folderId'),
    extension: q.get('extension') || undefined,
    mimeType: q.get('mimeType') || undefined,
    page: q.get('page') || undefined,
    pageSize: q.get('pageSize') || undefined,
  });
  const { items, total } = await fileService.search(ctx, {
    query: data.query,
    folderId: data.folderId ?? null,
    extension: data.extension,
    mimeType: data.mimeType,
    page: data.page,
    pageSize: data.pageSize,
  });
  return pag(items, total, data.page ?? 1, data.pageSize ?? 25);
}

// ============================================================
// FAVORITES
// ============================================================

async function handleListFavorites() {
  const ctx = await requireAuth();
  const items = await favoriteService.list(ctx);
  return ok({ items });
}

async function handleAddFavorite(req: NextRequest) {
  const ctx = await requireAuth();
  const body = await getBody(req);
  const fileId = body.fileId as string;
  if (!fileId) throw Errors.badRequest('fileId required');
  return ok(await favoriteService.add(ctx, fileId));
}

async function handleRemoveFavorite(q: URLSearchParams) {
  const ctx = await requireAuth();
  const fileId = q.get('fileId');
  if (!fileId) throw Errors.badRequest('fileId required');
  await favoriteService.remove(ctx, fileId);
  return ok({ ok: true });
}

// ============================================================
// RECENT
// ============================================================

async function handleListRecent(q: URLSearchParams) {
  const ctx = await requireAuth();
  const page = Number(q.get('page') || '1');
  const pageSize = Number(q.get('pageSize') || '25');
  const { items, total } = await recentService.list(ctx, { page, pageSize });
  return pag(items, total, page, pageSize);
}

// ============================================================
// TRASH
// ============================================================

async function handleListTrash(q: URLSearchParams) {
  const ctx = await requireAuth();
  const page = Number(q.get('page') || '1');
  const pageSize = Number(q.get('pageSize') || '50');
  const { items: files, total } = await fileService.list(ctx, {
    includeDeleted: true,
    page,
    pageSize,
  });
  const deletedFiles = files.filter((f: any) => f.deletedAt);
  return pag(deletedFiles, deletedFiles.length, page, pageSize);
}

async function handleEmptyTrash(q: URLSearchParams) {
  const ctx = await requireAuth();
  if (q.get('empty') === 'true') {
    await fileService.emptyTrash(ctx);
    return ok({ ok: true });
  }
  return ok({ ok: false, message: 'Use ?empty=true to empty trash' });
}

async function handleRestoreFile(id: string) {
  const ctx = await requireAuth();
  await fileService.restore(ctx, id);
  return ok({ ok: true });
}

// ============================================================
// NOTES
// ============================================================

async function handleListNotes(q: URLSearchParams) {
  const ctx = await requireAuth();
  const folderId = q.get('folderId');
  const query = q.get('q') || undefined;
  const includeDeleted = q.get('includeDeleted') === 'true';
  const page = Number(q.get('page') || '1');
  const pageSize = Number(q.get('pageSize') || '25');
  const { items, total } = await noteService.list(ctx, {
    folderId: folderId === 'null' ? null : folderId ?? undefined,
    includeDeleted,
    query,
    page,
    pageSize,
  });
  return pag(items, total, page, pageSize);
}

async function handleCreateNote(req: NextRequest) {
  const ctx = await requireAuth();
  const body = await getBody(req);
  const data = validate(createNoteSchema, body);
  const note = await noteService.create(ctx, {
    title: data.title,
    content: data.content,
    folderId: data.folderId ?? null,
    tags: data.tags,
  });
  return ok({ note }, 201);
}

async function handleGetNote(id: string) {
  const ctx = await requireAuth();
  return ok(await noteService.get(ctx, id));
}

async function handleUpdateNote(req: NextRequest, id: string) {
  const ctx = await requireAuth();
  const body = await getBody(req);
  const data = validate(updateNoteSchema, body);
  return ok(await noteService.update(ctx, id, data));
}

async function handleDeleteNote(id: string) {
  const ctx = await requireAuth();
  await noteService.softDelete(ctx, id);
  return ok({ ok: true });
}

// ============================================================
// AUDIT
// ============================================================

async function handleListAudit(q: URLSearchParams) {
  const ctx = await requireAuth();
  const page = Number(q.get('page') || '1');
  const pageSize = Number(q.get('pageSize') || '50');
  const action = q.get('action') || undefined;
  const actorType = q.get('actorType') || undefined;
  const { items, total } = await audit.list(ctx.workspaceId, {
    page,
    pageSize,
    action,
    actorType,
  });
  return pag(items, total, page, pageSize);
}

// ============================================================
// AGENT (JARVIS)
// ============================================================

async function handleListAgentCreds() {
  const ctx = await requireAuth();
  const items = await agentService.listCredentials(ctx);
  return ok({ items });
}

async function handleIssueAgentCred(req: NextRequest) {
  const ctx = await requireAuth();
  requireRole(ctx, [ROLE.OWNER, ROLE.ADMIN]);
  const body = await getBody(req);
  const data = validate(agentIssueCredentialSchema, body);
  const { credential, plainToken } = await agentService.issueCredential(ctx, {
    name: data.name,
    scopes: data.scopes,
  });
  return ok({ credential, plainToken }, 201);
}

async function handleRevokeAgentCred(id: string) {
  const ctx = await requireAuth();
  requireRole(ctx, [ROLE.OWNER, ROLE.ADMIN]);
  await agentService.revokeCredential(ctx, id);
  return ok({ ok: true });
}

async function handleAgentTools(req: NextRequest) {
  const agent = await agentService.authenticate(req.headers.get('authorization'));
  return ok({
    agent: {
      name: agent.name,
      scopes: agent.scopes,
      workspaceId: agent.workspaceId,
    },
    tools: listToolManifest(),
  });
}

async function handleAgentInvoke(req: NextRequest) {
  const agent = await agentService.authenticate(req.headers.get('authorization'));
  const body = await getBody(req);
  const data = validate(agentInvokeToolSchema, body);

  const tool = TOOL_REGISTRY[data.tool];
  if (!tool) throw Errors.notFound(`Tool '${data.tool}'`);

  const hasScope = tool.requiredScopes.some((s) => agent.scopes.includes(s));
  if (!hasScope) {
    await agentService.recordAgentAction(agent, `JARVIS_${data.tool.toUpperCase()}`, {
      outcome: 'DENIED',
      metadata: { requiredScopes: tool.requiredScopes, agentScopes: agent.scopes },
    });
    throw Errors.forbidden(
      `Agent is missing one of required scopes: ${tool.requiredScopes.join(', ')}`,
    );
  }

  const result = await tool.handler({ agent }, data.args);
  return ok(result);
}

// ============================================================
// OBSIDIAN
// ============================================================

async function handleObsidianImport(req: NextRequest) {
  const ctx = await requireAuth();
  const body = await getBody(req);
  const files = (body.files as any[]) || [];
  if (!files.length) throw Errors.badRequest('No files to import');

  const rootFolder = await findOrCreateFolder(ctx, 'Obsidian Import', null);

  let imported = 0;
  let skipped = 0;
  const errors: { name: string; error: string }[] = [];

  for (const file of files) {
    try {
      let parentFolderId: string | null = rootFolder.id;
      if (file.folderPath) {
        const parts = file.folderPath.split('/').filter(Boolean);
        for (const part of parts) {
          const f = await findOrCreateFolder(ctx, part, parentFolderId);
          parentFolderId = f.id;
        }
      }
      const title = file.name.replace(/\.md$/i, '');
      const existing = await db.note.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          folderId: parentFolderId,
          title,
          deletedAt: null,
        },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      await noteService.create(ctx, {
        title,
        content: file.content || '',
        folderId: parentFolderId,
      });
      imported += 1;
    } catch (err) {
      errors.push({
        name: file.name,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  return ok({ imported, skipped, errors });
}

async function handleObsidianExport(q: URLSearchParams) {
  const ctx = await requireAuth();
  const folderId = q.get('folderId');
  const notes = await db.note.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      ...(folderId && folderId !== 'null' ? { folderId } : {}),
    },
    include: { folder: true },
  });
  const vault = notes.map((note) => ({
    name: `${note.title}.md`,
    content: note.content,
    folderPath: note.folder?.path?.replace(/^\//, '').replace(/\/$/, '') || '',
  }));
  return ok({ vault, count: vault.length });
}

async function findOrCreateFolder(
  ctx: Awaited<ReturnType<typeof requireAuth>>,
  name: string,
  parentId: string | null,
) {
  const existing = await db.folder.findFirst({
    where: { workspaceId: ctx.workspaceId, parentId, name, deletedAt: null },
  });
  if (existing) return existing;
  return folderService.create(ctx, { name, parentId });
}
