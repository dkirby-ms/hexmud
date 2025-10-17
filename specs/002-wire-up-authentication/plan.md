# Implementation Plan: Wire Up Authentication (External Identity Provider)

**Branch**: `002-wire-up-authentication` | **Date**: 2025-10-11 | **Spec**: ./spec.md  
**Input**: Feature specification from `/specs/002-wire-up-authentication/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Introduce external identity authentication flow so web client users can sign in via configured external identity provider, obtain a validated identity token, and perform authenticated backend join/connect operations. Client will add a redirect-based sign-in function (primary) with popup fallback for tests/edge cases. Backend already includes token validation and session binding; plan formalizes renewal strategy (<5 min window) and minimal authorization (player + moderator flag). Observability limited to structured auth events; no new high-frequency loops or persistent storage is added.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript (strict) Node.js 22 (backend); TypeScript + React (Vite) (frontend)  
**Primary Dependencies**: @azure/msal-browser (client), jose (server token validation), Colyseus (real-time), zod (message validation baseline)  
**Storage**: No new persistence; session state in-memory only (existing architecture)  
**Testing**: Vitest (unit + integration), existing test suites extended for redirect flow & token validation edge cases  
**Target Platform**: Web browser client; Node.js backend (Linux)  
**Project Type**: Monorepo (apps/web, apps/server, packages/protocol)  
**Performance Goals**: Auth overhead adds <5% latency to join/connect; 500 concurrent authenticated sessions baseline (SC-006)  
**Constraints**: No persistent secrets client-side; silent renewal before expiry (<5 min) without user interruption; p95 join overhead <100 ms added  
**Scale/Scope**: Initial feature scope limited to sign-in, token validation, silent renewal, basic two-tier authorization flag; future roles out-of-scope

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design and before merge.*

List each core principle (P1–P5) with pass/fail + evidence:

| Principle | Description (summary) | Status | Evidence / Notes |
|-----------|-----------------------|--------|------------------|
| P1 | Authoritative Server Consistency | PASS | Token validated server-side; session binding only after validation |
| P2 | Horizontal Scalability & Stateless Edges | PASS | No sticky auth state; pure stateless token verification per join |
| P3 | Deterministic Simulation & Reproducibility | PASS | Replay harness will be updated (T067) to allow deterministic token injection & invalid token scenarios; no nondeterministic simulation introduced |
| P4 | Lean Observability & Performance Budgets | PASS | Only minimal structured auth events; no new loop; estimated <3% tick impact |
| P5 | Security, Fair Play & Data Integrity | PASS | Strict token validation, structured logging, minimal PII retention, env-driven config |

Performance & Resource Impact Summary:
- Tick budget impact: <3% (token signature & claim checks per join; renewal handled client-side)
- Custom high-frequency loop introduced: NO
- Added custom metrics/logs (justify if added): auth.* events (signin, token.validated/invalid, signout, renewal) to support security/audit
- Schema migrations: NO
- Redis keys (namespace + TTL): None added

Waivers (if any): Reference Complexity Tracking table.

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```
apps/
  server/
    src/
      auth/
      handlers/
      validation/
    tests/
  web/
    src/
      hooks/
      services/auth/
    tests/
packages/
  protocol/
specs/
  002-wire-up-authentication/
```

**Structure Decision**: Existing monorepo with `apps/web` (frontend) and `apps/server` (backend). Feature touches only web auth hook & service config plus server join validation paths (already present). No new packages.

## Phase Progress

- Phase 0 (Research): Completed (`research.md`) – all clarifications resolved.
- Phase 1 (Design & Contracts): Completed (`data-model.md`, `contracts/openapi.yaml`, `quickstart.md`). No schema migrations introduced.

## Constitution Re-Check (Post-Design)

| Principle | Status | Notes |
|-----------|--------|-------|
| P1 | PASS | Server-only token validation maintained |
| P2 | PASS | No stateful affinity; token per request |
| P3 | PASS | Replay harness token injection extension planned (T067); no nondeterministic simulation added |
| P4 | PASS | Minimal logging; no perf gate breach |
| P5 | PASS | Validation, minimal PII, env-based config |

No waivers required.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
