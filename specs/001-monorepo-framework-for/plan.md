# Implementation Plan: Monorepo Framework for Web MMORPG Backend & Frontend

**Branch**: `001-monorepo-framework-for` | **Date**: 2025-10-10 | **Spec**: [/home/saitcho/hexmud/specs/001-monorepo-framework-for/spec.md](/home/saitcho/hexmud/specs/001-monorepo-framework-for/spec.md)
**Input**: Feature specification from `/specs/001-monorepo-framework-for/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Establish a TypeScript monorepo scaffold enabling a fast end‑to‑end playable slice (authoritative Colyseus server + Vite SPA client) with a shared protocol/types workspace package, authenticated session join (Azure Entra ID via MSAL Authorization Code + PKCE for SPA → access token validated server‑side), and developer ergonomics (single bootstrap + single dev command, watch propagation of shared types). Persistence is deferred; extension points and metrics/log hooks prepared. Monorepo uses pnpm workspaces for linking, Vitest for unit/contract tests, and structured logging placeholders.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript (strict) on Node.js 22 LTS (>=22.x)  
**Primary Dependencies**: Colyseus 0.16.5 (server + schema), Vite (React SPA), MSAL (@azure/msal-browser for SPA, @azure/msal-node optional future confidential extensions), Zod (message validation), pnpm workspaces, concurrently / turbo (task orchestration)  
**Storage**: N/A (persistence deferred; in‑memory only; extension interfaces scaffolded)  
**Testing**: Vitest (unit + integration), supertest (HTTP), Playwright (optional future e2e – not required baseline), ts-node for dev scripts  
**Target Platform**: Linux dev environment; browser clients (modern evergreen)  
**Project Type**: Web (monorepo: server + SPA + shared packages)  
**Performance Goals**: Local baseline: 100 concurrent active player sessions with <300ms p95 join+heartbeat latency; future scale target (constitution) 5k CCU horizontally scaled (not load‑tested in baseline)  
**Constraints**: Single dev command, watch propagation <15s (goal <5s) for shared protocol changes; p95 session join under 300ms locally; bootstrap fail fast <5s for missing runtimes; zero hardcoded secrets  
**Scale/Scope**: Baseline slice: 2 apps (server, web), ≥1 shared package (protocol), optional second shared package (auth-utils) kept minimal; <2 weeks setup effort; future gameplay & persistence out of scope

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design and before merge.*

List each core principle (P1–P5) with pass/fail + evidence:

| Principle | Description (summary) | Status | Evidence / Notes |
|-----------|-----------------------|--------|------------------|
| Principle | Description (summary) | Status | Evidence / Notes |
|-----------|-----------------------|--------|------------------|
| P1 | Authoritative Server Consistency | PASS | Server owns PlayerSession & GameRoom authoritative state; client only sends join/heartbeat; validation layer & protocol schemas enforced |
| P2 | Horizontal Scalability & Stateless Edges | PASS | Stateless process; no persistence; room instances ephemeral; architecture leaves room driver pluggable (Redis driver future) |
| P3 | Deterministic Simulation & Reproducibility | N/A | No simulation loop yet; placeholder world static; replay harness deferred until gameplay logic added |
| P4 | Lean Observability & Performance Budgets | PASS | Rely only on Colyseus lifecycle events + structured console; no custom high‑freq loop; metrics abstraction interface stub only |
| P5 | Security, Fair Play & Data Integrity | PASS | OAuth2 Auth Code + PKCE; access token validated on join; Zod validation for messages; rate‑limit placeholder; no secrets committed |

Performance & Resource Impact Summary:
- Tick budget impact: <5% (session bookkeeping + heartbeat broadcast only)
- Custom high-frequency loop introduced: NO
- Added custom metrics/logs (justify if added): N/A (using Colyseus built‑ins only)
- Schema migrations: NO (no persistence in baseline)
- Redis keys (namespace + TTL): N/A (Redis not introduced yet)

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
  server/                 # Colyseus authoritative server
    src/
      rooms/
      auth/
      config/
      metrics/
      schema/             # Colyseus Schema classes
      handlers/
    tests/
      unit/
      integration/
  web/                    # Vite + React SPA
    src/
      components/
      pages/
      hooks/
      services/auth/
      protocol/
    public/
    tests/
      unit/
      contract/
packages/
  protocol/               # Shared types, message schemas, constants, version
    src/
      messages/
      constants.ts
      version.ts
  auth-utils/ (optional)  # Thin wrappers for MSAL config + token validation helpers (may merge later if minimal)
scripts/                  # Bootstrap + dev orchestration scripts (pnpm) 
config/                   # Root-level lint, tsconfig base, vitest config

specs/001-monorepo-framework-for/ (documents)
```

**Structure Decision**: Adopt a polyrepo-style monorepo using `apps` (runtime artifacts) and `packages` (pure libraries) to enforce separation of concerns: server & web depend on `protocol` (and optionally `auth-utils`); no circular deps. Keeps future additions (e.g., `apps/tooling`, `packages/persistence-adapter`) straightforward. Minimizes early complexity while enabling watch-linked shared code.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | | |
