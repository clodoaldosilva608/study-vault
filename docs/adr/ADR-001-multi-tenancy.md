# ADR-001 — Multi-Tenancy via Workspace Abstraction

**Status:** Accepted
**Date:** 2026-10-06

## Context

Study Vault starts as a personal study tool, but the specification requires it to be SaaS-ready from day one. Modeling the system as `user → files` (a per-user ownership model) would force a painful rewrite when teams, workspaces, and sharing are introduced.

## Decision

Every domain resource (folders, files, notes, audit logs, agent credentials) carries `workspace_id`. Users are linked to workspaces through a `WorkspaceMember` join table with a role (Owner / Admin / Member / Viewer). Authorization checks **always** resolve through `workspace_membership` — never through direct `user_id` ownership on the resource itself.

The first workspace for a new user is a "personal workspace" auto-created on signup, owned by them.

## Consequences

- Database schema is slightly larger upfront (one extra join table) but stays stable as SaaS features are layered in.
- RLS policies (when migrating to Postgres + Supabase) follow the pattern: `workspace_member(workspace_id, user_id) AND resource.workspace_id = workspace_id`.
- Sharing, teams, and organizations can be added later as new workspace types without touching resource tables.
- All API routes receive `workspaceId` from the resolved membership context, never from the client request body (prevents IDOR).

## Alternatives Considered

- **Direct user ownership** — simpler schema, but blocks SaaS evolution. Rejected.
- **Org-first model** — adds an extra layer (Org → Workspace → Resources) that the MVP doesn't need yet. Deferred to V3.
