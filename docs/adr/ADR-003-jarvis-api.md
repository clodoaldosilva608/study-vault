# ADR-003 — JARVIS Agent API Layer

**Status:** Accepted
**Date:** 2026-10-06

## Context

The spec is explicit: JARVIS must never touch the database, storage buckets, or service-role keys. It must authenticate, declare scopes, hit the Study Vault API, and have every operation audited.

## Decision

Expose a dedicated `/api/v1/agent/*` namespace. Agents authenticate with a per-workspace API key (`sva_<wsId>_<randomSecret>`). Keys are stored **hashed** (SHA-256) in `agent_credentials`. Scopes are explicit strings (`jarvis.files.read`, `jarvis.notes.write`, ...) — no implicit grants.

**MVP scope defaults:**
- `jarvis.files.read` ✓
- `jarvis.folders.read` ✓
- `jarvis.notes.read` ✓
- `jarvis.recent.read` ✓
- `jarvis.favorites.read` ✓
- `jarvis.notes.write` ✗ (must be explicitly granted)
- `jarvis.folders.create` ✗ (must be explicitly granted)
- `jarvis.files.delete` ✗ (always off in MVP)

Every tool call writes an `audit_logs` row with `actor_type=AGENT`, the agent's friendly name, the scopes used, request ID, and outcome. Tools support idempotency keys for write operations.

## Consequences

- Adding new tools does not require touching auth — just register a new tool with `required_scopes` in `src/lib/agent/registry.ts`.
- Replacing JARVIS with another agent (or a multi-agent system later) requires no architectural change — just new credentials.
- All agent operations are observable from the audit dashboard in the UI.

## Alternatives Considered

- **JWT-based agent auth** — more complex, requires key rotation infrastructure. Deferred. API key + scopes is sufficient for MVP.
- **Direct DB access for agent** — explicitly forbidden by spec section 5.
