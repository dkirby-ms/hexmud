# Security Review – Monorepo Framework Baseline

_Last updated: 2025-10-11_

## Overview

The baseline implementation focuses on authenticated session bootstrap, protocol integrity, and guardrails for future extensions. Persistence and external integrations remain out of scope; all mitigations target the in-memory Colyseus placeholder loop.

## Controls Implemented

### Authentication & Authorization
- **Access tokens required** when MSAL configuration is present. The server validates JWTs using cached JWKS keys (`apps/server/src/auth/validateToken.ts`).
- **Player identity mapping** stores a minimal claim subset and defaults to session IDs when auth is disabled, preventing PII leakage.

### Protocol Safety
- **Version enforcement** via `processJoinRequest` prevents schema drift (`VERSION_MISMATCH`).
- **Envelope validation** with Zod rejects malformed messages before room handlers execute.

### Rate Limiting & Session Hygiene
- **Token bucket limiter** for heartbeat traffic ensures abusive clients receive `RATE_LIMIT` errors while healthy sessions stay responsive.
- **Session store cleanup** removes identities and active session counters on disconnect to avoid resource buildup.

### Observability & Logging
- **Structured JSON logs** (correlation IDs) simplify incident triage without exposing secrets.
- **Metrics adapters** emit session lifecycle events, enabling future alerting.

### Secrets & Configuration
- `.env.example` documents required environment variables; no secrets are committed.
- `env.ts` trims trailing slashes, normalizes log levels, and provides defaults for all critical values.

## Residual Risks & Follow-Ups
- **Persistence**: No durable storage; future features must re-evaluate encryption at rest and access controls.
- **Token revocation**: Static JWKS cache lacks introspection; consider TTL-based refresh or IdP webhook when moving to production.
- **Transport security**: Local development uses WS/HTTP. Production must terminate TLS (reverse proxy or Colyseus transport upgrade).
- **DDoS & rate limiting**: Heartbeat guard is per-session; add per-IP/global throttles when deploying externally.
- **Metrics privacy**: Current adapter allows custom implementations; vet downstream sinks for sensitive claim data before emission.

## Recommended Next Steps
1. Implement automated dependency scanning in CI (e.g., GitHub Dependabot + audit).
2. Add penetration test checklist before exposing public endpoints.
3. Document incident response escalation paths once multiplayer features expand.
