# ADR-004 — Obsidian Sync: Modular Foundation

**Status:** Accepted
**Date:** 2026-10-06

## Context

Spec section 24 requires Obsidian integration. Full bidirectional sync needs conflict resolution, device tracking, and CRDT-like semantics — too much for MVP.

## Decision

Build **import and export** primitives in MVP (Markdown files in/out, preserving folder structure). Define a `SyncEngine` interface and stub it with a doc-only architecture. Sync state models (`sync_devices`, `sync_operations`) exist in the schema for forward compatibility but are not actively used in MVP.

**Sync state contract (V1.2):** `SYNCED | PENDING_UPLOAD | PENDING_DOWNLOAD | CONFLICT | DELETED`. Conflict resolution strategies (keep local, keep remote, create copy, merge markdown) are documented but not yet implemented.

## Consequences

- Users can already move content between Obsidian and Study Vault one-way in MVP.
- V1.2 sync work has a clear contract to implement against.
- No fake sync promises in the UI — import/export buttons are explicit.

## Alternatives Considered

- **Bidirectional sync in MVP** — too risky, would ship half-baked. Rejected per spec section 24 ("Não prometer sincronização bidirecional automática no MVP").
- **Skip Obsidian entirely** — explicitly required by spec. Rejected.
