# ADR-005 — Single-Page App Constraint

**Status:** Accepted
**Date:** 2026-10-06

## Context

The hosting environment only exposes the `/` route to the user. Next.js App Router traditionally uses one route per page. We need to deliver the full Study Vault dashboard experience within that constraint.

## Decision

Render the entire authenticated dashboard as a client-side SPA at `/`. Auth state is resolved via `/api/v1/auth/me` on mount. The dashboard's internal "views" (Files, Favorites, Recent, Trash, Search, Notes, Obsidian, Audit, JARVIS Tools, Settings) are switched through client-side Zustand state — no URL routing.

API routes under `/api/v1/*` are full server-side Route Handlers and are not subject to this constraint — they're invisible to the user.

## Consequences

- Deep-linking to a specific dashboard view isn't possible in MVP. Acceptable for personal use; will revisit with hash-based routing in V1.1.
- All API routes remain standard REST endpoints — the JARVIS integration and future mobile clients are unaffected.
- The codebase stays close to a normal Next.js app — adding more page routes later requires only removing the constraint, not refactoring.

## Alternatives Considered

- **Next.js catch-all route `/[[...slug]]`** — would work but adds routing complexity for no MVP benefit.
- **Hash-based routing** — deferred to V1.1.
