# Study Vault — Architecture

> Personal knowledge & study infrastructure platform. Multi-tenant SaaS-ready from day one, with a secure API/Tools layer designed for the JARVIS AI assistant.

## 1. High-Level Architecture

```
                         ┌──────────────────────────┐
                         │          USUÁRIO         │
                         │ PC / Notebook / Mobile   │
                         └────────────┬─────────────┘
                                      │ HTTPS (PWA)
                                      ▼
                         ┌──────────────────────────┐
                         │       STUDY VAULT        │
                         │    Next.js 16 (App Router)│
                         └────────────┬─────────────┘
                                      │
                         ┌────────────▼─────────────┐
                         │     Application Layer    │
                         │  Auth / API v1 / Domain  │
                         │   (Route Handlers + svc) │
                         └────────────┬─────────────┘
                                      │
              ┌───────────────────────┼────────────────────────┐
              │                       │                        │
              ▼                       ▼                        ▼
       Authentication            Domain Services         JARVIS Tool Layer
       (NextAuth + bcrypt)       (workspaces, files,    (/api/v1/agent/*)
                                 folders, notes, ...)
                                      │
                         ┌────────────▼─────────────┐
                         │      Prisma + SQLite     │
                         │   (Postgres-compatible   │
                         │    schema, RLS-ready)     │
                         └────────────┬─────────────┘
                                      │
                    ┌─────────────────┼──────────────────┐
                    │                 │                  │
                    ▼                 ▼                  ▼
                 Files             Metadata          Audit Logs
              (local FS adapter)

      ┌───────────────────────────────┐
      │            JARVIS             │
      │       AI Assistant             │
      └───────────────┬───────────────┘
                      │ HTTPS + Agent API Key
                      ▼
              ┌───────────────┐
              │ /api/v1/agent/ │  → scope check → audit → domain svc
              └───────────────┘
```

## 2. Layered Architecture

| Layer | Responsibility | Location |
|---|---|---|
| **Presentation** | React Server + Client Components, single-page UI at `/` | `src/app/`, `src/components/` |
| **API v1** | Versioned REST endpoints, input validation, response shaping | `src/app/api/v1/` |
| **JARVIS Agent Layer** | Agent auth, scope enforcement, tool registry, audit | `src/lib/agent/` |
| **Domain Services** | Pure business logic (workspace, folders, files, ...) | `src/lib/services/` |
| **Infrastructure** | Prisma, storage adapter, audit, auth, rate limit | `src/lib/infra/` |
| **Database** | Multi-tenant relational schema, RLS-ready | `prisma/schema.prisma` |

## 3. Multi-Tenancy Model

```
User ──< WorkspaceMember >── Workspace ──< Folders / Files / Notes / ... >
                                  │
                                  ├── Plan
                                  ├── Subscription (future)
                                  ├── AgentCredentials
                                  ├── AuditLogs
                                  └── UsageCounter
```

Every domain resource carries `workspace_id`. **Authorization is always workspace-scoped** — never `user_id = auth.uid()`. The user must be an active member of the workspace with a role ≥ the resource's required permission.

## 4. Roles & Permissions

| Role | Files | Folders | Notes | Members | Settings | Agent |
|---|---|---|---|---|---|---|
| Owner | full | full | full | full | full | manage |
| Admin | full | full | full | invite | full | manage |
| Member | CRUD own | CRUD own | CRUD own | read | read | use |
| Viewer | read | read | read | — | — | — |

Permission strings follow the pattern `<resource>.<action>` (e.g. `files.create`, `workspace.manage`). Granular permission tables will be added when the SaaS module lands.

## 5. JARVIS Integration

JARVIS never touches the database, storage, or service-role keys. It authenticates via:

1. **Agent API Key** — `sva_<workspaceId>_<randomSecret>`, stored hashed.
2. **Scopes** — `jarvis.files.read`, `jarvis.notes.read`, `jarvis.folders.read`, etc. (write/delete scopes off by default).
3. **Per-call audit** — every tool call writes to `audit_logs` with `actor_type=AGENT`, the agent name, scopes used, and request ID.
4. **Idempotency** — `create_folder`, `create_note` accept `Idempotency-Key` header to dedupe retries.

## 6. Storage Strategy

Files live on the local filesystem under `storage/{workspaceId}/files/{fileId}/{filename}`. The path is **always** generated server-side — the client never controls the final path. The interface (`IStorageAdapter`) abstracts writes/reads so we can swap to Supabase Storage or S3 later without touching domain code.

## 7. Single-Page App Strategy

The hosted preview exposes only `/`. We therefore render the entire dashboard experience as a client-side SPA on `/`:

- Auth state is managed by a Zustand store backed by `/api/v1/auth/me`.
- When unauthenticated → show Login / Register views.
- When authenticated → show dashboard with sidebar (Dashboard, Files, Favorites, Recent, Trash, Search, Notes, Obsidian, Audit, JARVIS Tools, Settings).
- API routes under `/api/v1/*` are full server-side route handlers — invisible routing constraint is only on user-visible pages.

## 8. PWA

- `public/manifest.json` — name, icons, theme color, standalone display.
- `public/sw.js` — service worker with cache-first for assets, network-first for HTML.
- App is installable, supports offline shell (no fake offline for storage).

## 9. Roadmap Post-MVP

V1.1 — UX polish, advanced preview, better search
V1.2 — Obsidian sync engine (devices, conflicts, resolver)
V1.3 — Full-text search, document extraction
V1.4 — Embeddings, semantic search, RAG
V2 — JARVIS study assistant, question generation, revision planning
V3 — SaaS billing (Stripe/Kiwify), plans, quotas, teams, sharing
