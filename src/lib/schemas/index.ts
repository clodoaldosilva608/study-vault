import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120).optional(),
});

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

export const createFolderSchema = z.object({
  name: z.string().min(1).max(200),
  parentId: z.string().cuid().optional().nullable(),
});

export const renameFolderSchema = z.object({
  name: z.string().min(1).max(200),
});

export const moveFolderSchema = z.object({
  parentId: z.string().cuid().optional().nullable(),
});

export const moveFileSchema = z.object({
  folderId: z.string().cuid().optional().nullable(),
});

export const renameFileSchema = z.object({
  name: z.string().min(1).max(200),
});

export const createNoteSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().max(500_000).optional().default(''),
  folderId: z.string().cuid().optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().max(500_000).optional(),
  folderId: z.string().cuid().optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const searchSchema = z.object({
  query: z.string().min(1).max(200),
  folderId: z.string().cuid().optional().nullable(),
  extension: z.string().max(20).optional(),
  mimeType: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const agentIssueCredentialSchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(z.string()).optional(),
});

export const agentInvokeToolSchema = z.object({
  tool: z.string().min(1).max(60),
  args: z.record(z.unknown()).default({}),
  idempotencyKey: z.string().max(120).optional(),
});

export const obsidianImportSchema = z.object({
  files: z.array(
    z.object({
      name: z.string().min(1).max(255),
      content: z.string().max(2_000_000),
      folderPath: z.string().max(500).optional(),
    }),
  ).min(1).max(100),
});
