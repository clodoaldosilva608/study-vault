# Study Vault

> Personal knowledge & study infrastructure platform. Multi-tenant SaaS-ready from day one, with a secure API/Tools layer designed for the JARVIS AI assistant.

Built as the MVP described in the [Master Development Specification](./STUDY_VAULT_MASTER_DEVELOPMENT_SPECIFICATION.md). The architecture prioritizes security, auditability, and SaaS evolution — not just a pretty UI.

## Status

| Module | State |
|---|---|
| Multi-tenant foundation (User → Workspace → Resources) | ✅ MVP |
| Authentication (email/password, JWT session cookie) | ✅ MVP |
| File Manager (folders, files, upload, download, rename, move, soft-delete, restore, drag-drop, multi-select) | ✅ MVP |
| Favorites & Recent files | ✅ MVP |
| Trash (soft delete + purge + empty) | ✅ MVP |
| Search (V1 — name, extension, mime) | ✅ MVP |
| Notes (Markdown with live preview) | ✅ MVP |
| Audit log (every sensitive operation) | ✅ MVP |
| JARVIS Tool Layer (agent API keys, scopes, read-only tools, audit per call) | ✅ MVP |
| Obsidian import/export (Markdown) | ✅ MVP |
| PWA (manifest + service worker + icons) | ✅ MVP |
| API v1 (REST, versioned, typed envelope) | ✅ MVP |
| Billing / paid plans | ⏸ deferred to V3 |
| Bidirectional Obsidian sync | ⏸ deferred to V1.2 |
| RAG / semantic search | ⏸ deferred to V1.4 |

## Stack

- **Next.js 16** (App Router) + **TypeScript 5**
- **Prisma** + **SQLite** (Postgres-ready schema for production)
- **Tailwind CSS v4** + **shadcn/ui** (New York style)
- **TanStack Query** + **Zustand** (server + client state)
- **NextAuth** patterns via JWT session cookies + bcrypt-hashed passwords
- **react-markdown** for note preview
- **Vitest** (TBD) + **Playwright** (TBD)

## Architecture

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) and the ADRs in [`docs/adr/`](./docs/adr/):
- ADR-001 — Multi-tenancy via Workspace abstraction
- ADR-002 — Storage abstraction via `IStorageAdapter`
- ADR-003 — JARVIS Agent API Layer (no direct DB access)
- ADR-004 — Obsidian sync: modular foundation (import/export first)
- ADR-005 — Single-Page App constraint

## Project structure

```
src/
├── app/
│   ├── api/v1/                  # REST endpoints (auth, folders, files, notes, audit, agent, obsidian)
│   ├── globals.css              # Premium emerald theme + dark mode
│   ├── layout.tsx
│   └── page.tsx                  # SPA entrypoint
├── components/
│   ├── dashboard/                # Shell, sidebar, topbar
│   ├── files/                    # Upload, dialogs
│   ├── views/                    # Dashboard, Files, Favorites, Recent, Trash, Search, Notes, Obsidian, Audit, Jarvis, Settings
│   ├── common/                   # FileTypeIcon, etc.
│   └── providers.tsx             # Theme + React Query + SW registration
├── lib/
│   ├── agent/                    # JARVIS auth + tool registry (9 tools)
│   ├── api/                      # apiHandler envelope + typed fetch client
│   ├── domain/                   # constants, errors
│   ├── infra/
│   │   ├── audit/                # audit service
│   │   ├── auth/                 # session, API key hashing
│   │   └── storage/              # IStorageAdapter (swap for Supabase later)
│   ├── schemas/                  # Zod validators
│   ├── services/                 # workspace, folder, file, favorite, note
│   ├── store/                    # Zustand SPA state
│   └── utils/                    # formatBytes, etc.
└── prisma/
    └── schema.prisma             # 16 models, multi-tenant, SaaS-ready
public/
├── manifest.json                 # PWA
├── sw.js                         # Service worker
└── icons/                        # 192/512/maskable/apple-touch
docs/
├── ARCHITECTURE.md
└── adr/
```

## JARVIS integration

JARVIS authenticates with an API key (`sva_<wsId>_<secret>`) issued per workspace. Scopes are explicit strings — read-only by default, write/delete require explicit grants.

Every tool call:
1. Authenticates the agent (key hashed at rest)
2. Resolves the workspace from the credential (never trusts client)
3. Verifies the agent has at least one required scope
4. Executes through the domain service layer
5. Writes an audit log with actor, action, scope used, and outcome
6. Returns a structured envelope with `requestId`

Tools available in MVP:
- `search_files`, `get_file`, `list_folder` (read)
- `search_notes`, `get_note` (read)
- `get_recent_files`, `get_favorites` (read)
- `create_note`, `create_folder` (write — require explicit scope + idempotency)

The JARVIS layer never touches the database, storage, or service-role credentials — only the API. This means we can swap Supabase for any other backend without breaking JARVIS.

## Running

```bash
bun install
bun run db:push          # Apply Prisma schema to SQLite
bun run dev              # Start dev server on :3000
```

## Production deployment (Vercel)

The app is deployed at **https://study-vault-six-delta.vercel.app**

Repository: **https://github.com/clodoaldosilva608/study-vault**

### ⚠️ Important: ephemeral database on Vercel preview

The Vercel preview uses SQLite stored in `/tmp`, which is **ephemeral** — each
serverless function invocation starts with a fresh filesystem. The seed user
(`clodoaldo608@gmail.com`) is auto-recreated on every cold start via the
`ensureSeedUser()` bootstrap, but any other data you create (folders, files,
notes) will be lost when the instance spins down.

For a **persistent** production deployment, connect a managed Postgres:

1. Create a free [Neon](https://neon.tech) project (or Supabase, or Vercel Postgres).
2. Get the connection string (e.g. `postgresql://user:pass@host/db?sslmode=require`).
3. In Vercel → Project → Settings → Environment Variables, set `DATABASE_URL` to the Postgres connection string.
4. In `prisma/schema.prisma`, change the datasource provider from `sqlite` to `postgresql`.
5. Run `prisma migrate dev --name init` to generate the Postgres schema.
6. Redeploy.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:.../custom.db` (dev) / `file:/tmp/study-vault.db` (Vercel) | Prisma connection string. Use a Postgres URL for production. |
| `STORAGE_ROOT` | `/home/z/my-project/storage` (dev) / `/tmp/study-vault-storage` (Vercel) | File storage root. Use Vercel Blob for production. |
| `JWT_SECRET` | demo default (override in prod) | Secret for signing session JWTs. |
| `SEED_EMAIL` | `clodoaldo608@gmail.com` | Bootstrap user email (auto-created on cold start). |
| `SEED_PASSWORD` | `88677488` | Bootstrap user password (override after first login via Change password). |
| `SEED_NAME` | `Clodoaldo` | Bootstrap user display name. |

## Roadmap (per spec section 60)

- **V1.1** — UX polish, advanced previews, better search
- **V1.2** — Obsidian bidirectional sync (devices, conflicts, resolver)
- **V1.3** — Full-text indexing, document extraction
- **V1.4** — Embeddings, semantic search, RAG
- **V2** — Full JARVIS study assistant (questions, summaries, revision planning)
- **V3** — SaaS billing (Stripe/Kiwify), plans, quotas, teams, sharing

## Decisions documented

- **SQLite + Int (32-bit) storage limit in MVP** — capped at 1 GB for FREE tier to fit SQLite INT. Migrating to Postgres + BIGINT unlocks the full 2 GB / 100 GB / 1 TB tiers when billing launches. See [`docs/adr/ADR-002-storage-strategy.md`](./docs/adr/ADR-002-storage-strategy.md).
- **Single-page SPA on `/`** — the hosting preview exposes only `/`, so the dashboard renders as a client-side SPA with internal view state. API routes are standard REST and unaffected. See [`docs/adr/ADR-005-spa-constraint.md`](./docs/adr/ADR-005-spa-constraint.md).
- **Local filesystem storage adapter** — abstracted behind `IStorageAdapter` so swapping to Supabase Storage is a one-class change in [`src/lib/infra/storage/adapter.ts`](./src/lib/infra/storage/adapter.ts).
