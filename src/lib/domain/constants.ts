// Shared types & constants for the Study Vault domain.

export const ROLE = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
} as const;

export type Role = typeof ROLE[keyof typeof ROLE];

export const ROLE_HIERARCHY: Record<Role, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

export const PLAN = {
  FREE: 'FREE',
  PRO: 'PRO',
  PREMIUM: 'PREMIUM',
} as const;

export const PLAN_STORAGE: Record<string, number> = {
  // MVP: limited to 1 GB to fit SQLite INT (32-bit max ~2.1 GB).
  // Migrating to Postgres + BIGINT unlocks the full PRO/PREMIUM tiers.
  FREE: 1 * 1024 * 1024 * 1024, // 1 GB (MVP)
  PRO: 1 * 1024 * 1024 * 1024, // placeholder until BIGINT migration
  PREMIUM: 1 * 1024 * 1024 * 1024, // placeholder until BIGINT migration
};

// ---- JARVIS / Agent scopes ----

export const AGENT_SCOPE = {
  FILES_READ: 'jarvis.files.read',
  FILES_WRITE: 'jarvis.files.write',
  FILES_DELETE: 'jarvis.files.delete',
  FOLDERS_READ: 'jarvis.folders.read',
  FOLDERS_CREATE: 'jarvis.folders.create',
  FOLDERS_DELETE: 'jarvis.folders.delete',
  NOTES_READ: 'jarvis.notes.read',
  NOTES_WRITE: 'jarvis.notes.write',
  RECENT_READ: 'jarvis.recent.read',
  FAVORITES_READ: 'jarvis.favorites.read',
  STUDY_READ: 'jarvis.study.read',
  STUDY_WRITE: 'jarvis.study.write',
  STUDY_SYNC: 'jarvis.study.sync',
} as const;

export type AgentScope = typeof AGENT_SCOPE[keyof typeof AGENT_SCOPE];

export const DEFAULT_AGENT_SCOPES: AgentScope[] = [
  AGENT_SCOPE.FILES_READ,
  AGENT_SCOPE.FOLDERS_READ,
  AGENT_SCOPE.NOTES_READ,
  AGENT_SCOPE.RECENT_READ,
  AGENT_SCOPE.FAVORITES_READ,
  AGENT_SCOPE.STUDY_READ,
];

// ---- Audit actions ----

export const AUDIT_ACTION = {
  UPLOAD_FILE: 'UPLOAD_FILE',
  DOWNLOAD_FILE: 'DOWNLOAD_FILE',
  UPDATE_FILE: 'UPDATE_FILE',
  MOVE_FILE: 'MOVE_FILE',
  DELETE_FILE: 'DELETE_FILE',
  RESTORE_FILE: 'RESTORE_FILE',
  PURGE_FILE: 'PURGE_FILE',
  CREATE_FOLDER: 'CREATE_FOLDER',
  UPDATE_FOLDER: 'UPDATE_FOLDER',
  MOVE_FOLDER: 'MOVE_FOLDER',
  DELETE_FOLDER: 'DELETE_FOLDER',
  RESTORE_FOLDER: 'RESTORE_FOLDER',
  CREATE_NOTE: 'CREATE_NOTE',
  UPDATE_NOTE: 'UPDATE_NOTE',
  DELETE_NOTE: 'DELETE_NOTE',
  FAVORITE_ADD: 'FAVORITE_ADD',
  FAVORITE_REMOVE: 'FAVORITE_REMOVE',
  WORKSPACE_CREATE: 'WORKSPACE_CREATE',
  MEMBER_ROLE_CHANGE: 'MEMBER_ROLE_CHANGE',
  USER_REGISTER: 'USER_REGISTER',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  AGENT_CREDENTIAL_ISSUE: 'AGENT_CREDENTIAL_ISSUE',
  AGENT_CREDENTIAL_REVOKE: 'AGENT_CREDENTIAL_REVOKE',
  JARVIS_SEARCH_FILES: 'JARVIS_SEARCH_FILES',
  JARVIS_GET_FILE: 'JARVIS_GET_FILE',
  JARVIS_LIST_FOLDER: 'JARVIS_LIST_FOLDER',
  JARVIS_SEARCH_NOTES: 'JARVIS_SEARCH_NOTES',
  JARVIS_GET_NOTE: 'JARVIS_GET_NOTE',
  JARVIS_CREATE_NOTE: 'JARVIS_CREATE_NOTE',
  JARVIS_CREATE_FOLDER: 'JARVIS_CREATE_FOLDER',
  JARVIS_GET_RECENT: 'JARVIS_GET_RECENT',
  JARVIS_GET_FAVORITES: 'JARVIS_GET_FAVORITES',
} as const;

export type AuditAction = typeof AUDIT_ACTION[keyof typeof AUDIT_ACTION];

export const AUDIT_OUTCOME = {
  SUCCESS: 'SUCCESS',
  DENIED: 'DENIED',
  ERROR: 'ERROR',
} as const;

export const RESOURCE_TYPE = {
  FILE: 'FILE',
  FOLDER: 'FOLDER',
  NOTE: 'NOTE',
  WORKSPACE: 'WORKSPACE',
  MEMBER: 'MEMBER',
  AGENT: 'AGENT',
} as const;

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB per file in MVP

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 100,
} as const;
