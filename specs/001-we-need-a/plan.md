# Implementation Plan: Project Framework (TypeScript / Node / Colyseus / Vite)

**Feature Branch**: `001-we-need-a`
**Date**: 2025-10-09
**Status**: Draft

This plan outlines the technical approach and phased delivery steps to implement the scaffolded full‑stack framework with a Node.js (TypeScript) backend (including Colyseus for real-time extensibility) and a Vite-based frontend, enforcing a confidential client authentication model.

---
## 1. Architecture Overview

| Layer | Technology | Purpose |
|-------|------------|---------|
| Backend Core | Node.js + TypeScript | API, auth mediation, permission enforcement |
| Real-time | Colyseus (rooms) | Optional multiplayer / session channels; foundation only now |
| Frontend | Vite + React + TypeScript | Developer-friendly SPA scaffold (constitution mandates React) |
| Shared Contracts | TypeScript decls (`shared/`) | DTOs, enumerations, permission constants |
| Auth Federation | `openid-client` (OIDC) | Confidential client token retrieval; session token issuing |
| Logging | pino (structured) | Security & audit logs w/ correlation ids |
| Metrics & Tracing | OpenTelemetry SDK + exporters (console placeholder) | token latency, scaffold timings, auth events |
| Validation | zod (or valibot) | Input schemas (modular) |
| Testing | vitest (frontend + shared + backend) / playwright (e2e later) | Unified test runner |
| Packaging | pnpm workspaces (preferred) or npm workspaces | Monorepo consistency |
| Persistence | PostgreSQL + migration tool (Prisma or Knex) | Future domain persistence readiness |

---
## 2. Repository / Directory Structure

```
backend/
  src/
    app.ts
    server.ts
    config/
    auth/
      oidcClient.ts
      sessionIssuer.ts
      middleware/
    permissions/
      roles.ts
      permissions.ts
    rooms/ (Colyseus rooms skeleton)
    errors/
      codes.ts
      handler.ts
    logging/
      logger.ts
    metrics/
      otel.ts
    routes/
      health.ts
      auth.ts
    utils/
  package.json
frontend/
  src/
    main.ts
    app/
    components/
    pages/
    i18n/
    accessibility/
  index.html
  vite.config.ts
  package.json
shared/
  src/
    types/
      auth.ts
      user.ts
      permissions.ts
    constants/
    errors/
  package.json
infra/
  docker/
  env/
    .env.example
scripts/
  scaffold-module.ts
  validate-structure.ts
  detect-secrets.ts
  dev-all.sh
tests/
  backend/
  frontend/
  integration/
  e2e/ (placeholder)
docs/
  architecture.md
  auth-flow.md
  security-boundaries.md
  contributing.md

pnpm-workspace.yaml (or package.json workspaces)
README.md
```

---
## 3. Confidential Client Auth Flow

1. Backend loads OIDC configuration + client credentials (client_id, client_secret) from environment / secret store.
2. Uses `openid-client` to perform client credentials or authorization code w/ PKCE (future) depending on grant selection (initial: client credentials for service-scope + session bridging).
3. Issues frontend session token (HTTP-only secure cookie) containing minimal claims: `sub`, `roles`, `permissions`, `exp`, `sid`.
4. No refresh token exposed to frontend; backend silently reacquires external access token prior to expiry (≈60m). Session token TTL aligned but shorter (e.g., 30m) to reduce risk.
5. Audit + metrics: each token event logged (without secrets) & histogram for acquisition latency.

Open design decision captured: confirm grant type expansion (authorization code w/ user browser redirect) in later milestone (decision gate at end of M2); initial milestone uses stub + mock provider for local dev.

---
## 4. Authorization Model

- Roles map to permission identifiers defined in `shared/src/types/permissions.ts`.
- Policy evaluation middleware: attaches `req.authContext` after session validation.
- Decorator / helper for route protection: `requirePermissions(['perm.read_user'])` OR `requireRole('admin')`.
- Future extension: attribute-based or room-level access for Colyseus.

---
## 5. Error Handling & Response Schema

Standard envelope:
```jsonc
{
  "code": "ERR_<CATEGORY>_<TOKEN>",
  "message": "User-safe description",
  "correlationId": "uuid",
  "timestamp": "ISO-8601"
}
```
- Categories (initial): AUTH, VALIDATION, PERMISSION, SYSTEM, NOT_FOUND.
- Map internal errors via centralized handler.

---
## 6. Logging & Observability

- Logger (pino) configured with correlation id (use request header `x-correlation-id` or generated UUID).
- OpenTelemetry instrumentation wrapper (http server metrics + custom spans for token acquisition, scaffold generation).
- Metrics: counters (`token_requests_total`), histograms (`token_request_latency_ms`), gauge (`active_sessions`), counter (`unauthorized_attempts_total`).
- Export path: `/metrics` (Prometheus exposition placeholder) reserved.

---
## 7. Build & Dev Tooling

- Monorepo with pnpm for deterministic installs; root scripts orchestrate backend + frontend dev.
- TypeScript project references (each package tsconfig extends base `tsconfig.base.json`).
- ESLint + Prettier baseline (shared config); commit hooks (lint + typecheck) via Husky.
- Dev scripts: `scripts/dev-all.sh` runs backend watcher (ts-node-dev / nodemon + ts-node) and Vite dev server concurrently (use `concurrently`).

---
## 8. Module Scaffolding Workflow

`scripts/scaffold-module.ts` inputs: module name (kebab), options (--realtime?). Generates:
- Backend route file + test stub.
- Frontend page/component skeleton.
- Shared contract stub.
- Updates central index exports.
- Adds permission constants if requested.
Validation ensures no name collisions; logs scaffold event.

---
## 9. Non-Functional Targets Alignment (FR-019)

- Backend cold start ≤ 8s (Node + load config + start listener + Colyseus registration).
- Frontend dev build ready ≤ 45s (Vite baseline, minimal deps).
- Backend steady RSS ≤ 300MB; periodic memory log every 5m dev mode.
- Token acquisition success ≥ 99% under nominal mocked latency <500ms.

Verification: add `npm run verify:baseline` script executing timed startup & memory snapshot; outputs JSON for CI gating (optional threshold warnings).

Additional NFR validations:
- Secret/material boundary scan ensures no confidential credentials appear in frontend bundle.
- Token renewal scheduler test asserts renewal occurs ≥5 minutes before expiry.

---
## 10. Security Considerations

- Secrets only via environment (dotenv in dev). Provide `.env.example` (no values).
- HTTP-only, Secure, SameSite=Lax session cookie.
- Brute force detection placeholder (counter & threshold config, future enforcement hook).
- Threat logging: suspicious repeated invalid token events aggregated.
- Secret scanning script rejects commits with patterns (client secret accidental inclusion).

---
## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Over-engineering early | Slows delivery | Phase features; minimal real-time stub first |
| Auth complexity | Delays onboarding | Stub provider + mock responses in M1/M2 |
| Permission sprawl | Hard to manage | Central permission registry + lint rule later |
| Performance regression | Fails FR-019 | Baseline verification script + profiling hooks |
| Ambiguous module structure | Inconsistent code | Scaffold script enforces layout |

---
## 12. Phased Roadmap

### Milestone M1: Core Scaffold (P1)
- Monorepo structure + workspaces
- Backend HTTP server + health route
- Frontend Vite skeleton + shared types linkage
- Logging baseline + correlation id
- Validation + lint + basic tests
- Secret scanning & structure validation scripts
- React integration (base App component)
- Environment sample `.env.example`

### Milestone M2: Confidential Auth Foundation (P2)
- OIDC client integration (mock + real configurable)
- Session token issuing logic + cookie handling
- Error envelope & security event logging
- Metrics for token requests
- Token renewal scheduler (silent re-acquisition)
- Least-privilege scope configuration & validation
- Security boundaries documentation draft

### Milestone M3: Authorization & Module Generation (P3)
- Roles/permissions registry + middleware
- Module scaffold script (routes + components + contracts)
- Colyseus room bootstrap example (optional sample room)
- Module creation time measurement script (ties to SC-002)

### Milestone M4: Observability & Performance Baseline
- OpenTelemetry wiring (HTTP + custom spans)
- Metrics endpoint & baseline dashboards doc
- Baseline performance verification script
- Correlation id completeness sampling tests (SC-006)

### Milestone M5: Hardening & Documentation
- Expanded security docs (secret rotation, token renewal details)
- Contribution guide completeness
- Accessibility/i18n placeholders validated
- Developer onboarding time trial (SC-001)
- Documentation satisfaction survey (SC-007)
- Final secret scan audit (SC-003)

---
## 13. Out of Scope (Current Feature)
- Production deployment automation (CI/CD) beyond placeholders
- Advanced multi-tenant isolation
- Complex real-time game logic (only structural example)
- Full i18n content / accessibility audits (placeholders only)

---
## 14. Acceptance Alignment
Each milestone maps to FR & SC coverage; final checklist resides in `checklists/requirements.md` and `tasks.md`.

---
## 15. Next Steps
1. Approve plan.
2. Initialize workspace configs (pnpm / tsconfig base).
3. Execute M1 tasks in order defined in `tasks.md`.
 4. Add Constitution Check section updates after each milestone.

---
## 16. Constitution Check (Initial Snapshot)
| Principle | Status | Notes |
|-----------|--------|-------|
| 1. Authoritative Server | N/A (no game state yet) | Future when simulation features arrive |
| 2. Horizontal Scalability | Partial | Stateless scaffold; DB placeholder pending |
| 3. Deterministic Simulation | N/A | No simulation loops yet |
| 4. Lean Observability | Partial | Basic logs only initially; defer heavy tracing until justified |
| 5. Security & Fair Play | Partial | Validation & auth foundation phased; renewal & scopes upcoming |

---
