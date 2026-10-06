# ADR-002 — Storage Abstraction via IStorageAdapter

**Status:** Accepted
**Date:** 2026-10-06

## Context

The spec mandates Supabase Storage in production, but we run on local filesystem during MVP development. Domain code must not be coupled to the storage backend.

## Decision

Define an `IStorageAdapter` interface (`save`, `read`, `delete`, `getSignedUrl`, `exists`) in `src/lib/infra/storage/`. The default implementation writes to `storage/{workspaceId}/files/{fileId}/{filename}` on local disk. Swapping to Supabase Storage later means implementing the same interface — no domain code changes.

## Consequences

- File paths are always server-generated. The client never controls the final storage path (prevents path traversal).
- When moving to Supabase, we can leverage signed URLs and TUS resumable uploads with minimal domain changes.
- Backup strategy: in MVP, the local `storage/` directory must be backed up manually. In SaaS, Supabase handles durability.

## Alternatives Considered

- **Direct Supabase SDK calls in domain code** — couples domain to vendor. Rejected per spec principle #17.
- **Store binary in Postgres** — explicitly forbidden by spec section 12.
