# Task Plan (Remediated): Monorepo Framework for Web MMORPG Backend & Frontend

Generated: 2025-10-11 (Remediation applied 2025-10-11)
Source Docs: plan.md, spec.md, data-model.md, quickstart.md, contracts/* (protocol-messages.md, openapi.yaml), research.md

Feature Branch: `001-monorepo-framework-for`

## Conventions
- Task IDs: T001, T002 ... sequential, execution order respecting dependencies.
- [P] denotes task can be run in parallel with other [P] tasks in the SAME phase/story (different files / no ordering constraint).
- [Story USn] label ties task to a user story or to Setup/Foundational/Polish.
- Stories are independently testable increments. Completing a story phase yields a demo‑able slice.
- Tests: Requested implicitly by FR-015 and acceptance criteria; we include minimal test tasks before implementation tasks (TDD ordering) where applicable.
- Explicit file paths are relative to repo root unless noted.

## Phase Overview
1. Phase 1: Setup (repo & tooling scaffolding already present; validate & finalize) 
2. Phase 2: Foundational (cross-cutting prerequisites) 
3. Phase 3: User Story 1 (P1) – Spin Up Core Game Stack 
4. Phase 4: User Story 2 (P2) – Shared Protocol & Types Package 
5. Phase 5: User Story 3 (P3) – Authentication & Secure Session Bootstrap 
6. Phase 6: Polish & Cross-Cutting Enhancements 

## Remediation Update (2025-10-11)
This file consolidates tasks after analysis. High / critical issues addressed:
1. Duplicate second task plan removed (was appended after original "End of tasks plan"). This document is now the single source of truth.
2. FR-008 Clarification: Baseline (US1/US2) allows placeholder room broadcast pre-auth to deliver fast playable slice; once authentication (US3) is active, broadcast occurs only after authenticated join. A spec wording adjustment will align separately.
3. Versioning tasks consolidated: T015 now encompasses creation of version constant, bump script, and initial CHANGELOG entry. US2 tasks T045 & T046 are RETIRED (kept for historical numbering, excluded from active counts).
4. Added coverage for underspecified / missing edge cases & flows:
	- T072: Network interruption reconnect with exponential backoff + test.
	- T073: Port conflict detection & friendly error message + test.
	- T074: Silent token renewal (MSAL acquireTokenSilent) + expiry simulation test.
5. Pre-existing implementation inventory recorded so already-present scaffold tasks are not re-executed.
6. Logging & metrics remain lean (Principle 4) – only session/auth lifecycle & core counters retained; extra correlation id enhancements deferred.

### Pre-existing Implementation Inventory (Do NOT re-implement)
Verified in repository: T001–T010, T011–T024, T026, T027, T031–T033, T036, T038–T044, T047–T052, T053–T062, T065–T071. (T025 placeholder if room manager covers; confirm before acting.)

### Retired Tasks
T045 (merged into T015), T046 (merged into T015). Keep IDs reserved; exclude from counts.

### New Tasks Added
T072 (Reconnect), T073 (Port conflict detection), T074 (Silent token renewal & test).

## Tasks

### Phase 1: Setup
| # | Task | Notes/Outputs | Dep |
|---|------|---------------|-----|
| T001 | Verify prerequisites script exists or stub `.specify/scripts/bash/check-prerequisites.sh` if absent (ensure Node>=22, pnpm>=9) [Setup] | Satisfies SC-005 fast fail; update README if adjustments | - |
| T002 | Validate root `pnpm-workspace.yaml` lists `apps/*` and `packages/*` workspaces [Setup] | Ensure protocol & apps included | T001 |
| T003 | Ensure root `tsconfig.base.json` has project references for `apps/server`, `apps/web`, `packages/protocol` [Setup] | Align with watch propagation goal | T002 |
| T004 | Confirm root scripts: `bootstrap`, `dev`, `test`, `lint` in `package.json` implement FR-002/FR-003 (adjust if missing) [Setup] | `bootstrap` -> version check + `pnpm install`; `dev` -> concurrently run | T003 |
| T005 | Add `.env.example` with MSAL placeholders & protocol config (PROTOCOL_VERSION) [Setup] | FR-007, reference Quickstart | T004 |
| T006 | Document repo layout & commands in `README.md` (ensure FR-001, FR-013, contribution guide pointer) [Setup] | SC-001 support | T005 |
| T007 | Add/verify `CONTRIBUTING.md` guidelines for lint/format/test (FR-018) [Setup] | Standardize contributions | T006 |
| T008 | Initialize/verify Vitest root config for multi-workspace run (`vitest.config.ts`) [Setup] | Enables FR-015 | T004 |
| T009 | Add license header / placeholder if required (compliance) [Setup] | Optional governance | T006 |
| T010 | Bootstrap install & initial build (`pnpm run bootstrap`) and record timing baseline [Setup] | Gather baseline for SC-001/SC-002 | T008 |

### Phase 2: Foundational
| # | Task | Notes/Outputs | Dep |
|---|------|---------------|-----|
| T011 | Implement structured logger scaffold `apps/server/src/logging/logger.ts` (JSON dev) [Foundational] | Supports FR-010 | T010 |
| T012 | Implement metrics adapter interface `apps/server/src/metrics/adapter.ts` (noop counters) [Foundational] | FR-017 | T010 |
| T013 | Implement rate limit token bucket placeholder `apps/server/src/ratelimit/tokenBucket.ts` + heartbeat limiter [Foundational] | FR-011 | T010 |
| T014 | Implement message envelope validation `apps/server/src/validation/validateMessage.ts` using Zod [Foundational] | FR-011 | T010 |
| T015 | Implement protocol version constant export `packages/protocol/src/version.ts` + bump script `scripts/bump-protocol-version.ts` [Foundational] | FR-016 | T010 |
| T016 | Add shared constants `packages/protocol/src/index.ts` exports (PROTOCOL_VERSION, heartbeat intervals) [Foundational] | Enables US1 join/heartbeat | T015 |
| T017 | Implement session registry state structures `apps/server/src/state/sessions.ts` [Foundational] | Enables lifecycle tracking FR-010 | T011 |
| T018 | Implement room registry/scaffold `apps/server/src/state/rooms.ts` [Foundational] | Prep for placeholder room | T017 |
| T019 | Add health & version endpoints `apps/server/src/server.ts` integration (Express route `/healthz`, `/version`) [Foundational] | FR-009, FR-016 | T011 |
| T020 | Add placeholder world room class `apps/server/src/rooms/PlaceholderRoom.ts` [Foundational] | Pre-req for US1 | T018 |
| T021 | Root load test script stub `scripts/load-test.ts` (simulate 100 session connects) [Foundational] | For SC-006 baseline later | T019 |
| T022 | Add metrics event emission at session connect/disconnect in server code [Foundational] | FR-017 | T017 |
| T023 | Add structured error handler `apps/server/src/handlers/error.ts` mapping codes (AUTH_REQUIRED, VERSION_MISMATCH, RATE_LIMIT) [Foundational] | Supports later auth & version checks | T014 |
| T024 | Add heartbeat handler & cleanup logic `apps/server/src/ratelimit/heartbeat.ts` updating lastHeartbeatAt & session timeout [Foundational] | FR-011 timeouts | T013 |

### Phase 3: User Story 1 (P1) – Spin Up Core Game Stack
Goal: End-to-end start with single command; placeholder room join & heartbeat.
Independent Test Criteria: Fresh clone -> bootstrap -> dev; client shows connected + heartbeats within 5s.
| # | Task | Notes/Outputs | Dep |
|---|------|---------------|-----|
| T025 | [US1] Add client placeholder protocol wrapper `apps/web/src/protocol/placeholderClient.ts` (connect, join placeholder room) [P] | Basic handshake no auth yet | T020 |
| T026 | [US1] Implement server join handler `apps/server/src/handlers/join.ts` (assign sessionId, attach room) | Uses session registry & room placeholder | T023 |
| T027 | [US1] Add client component `apps/web/src/components/WorldPlaceholder.tsx` display session id & heartbeat ticks [P] | UI acceptance check | T025 |
| T028 | [US1] Add connection status hook `apps/web/src/hooks/useGameConnection.ts` (state: connecting, connected) [P] | Reusable for later auth gating | T025 |
| T029 | [US1] Add heartbeat emit timer in client connection hook (5s) [P] | For server lastHeartbeatAt update | T028 |
| T030 | [US1] Implement server heartbeat processing updating session + optional ack log | Extend heartbeat handler | T024 |
| T031 | [US1] Add Vitest integration test: health endpoint & version endpoint success `apps/server/tests/integration/health.test.ts` (ensure present) | FR-009 | T019 |
| T032 | [US1] Add Vitest integration test: room join & heartbeat flow (no auth) `apps/server/tests/integration/roomJoin.test.ts` | Validate E2E join basics | T026 |
| T033 | [US1] Add web contract test connection status `apps/web/tests/contract/connectionStatus.test.tsx` | UI shows connected & heartbeat increments | T027 |
| T034 | [US1] Update README Quickstart section with verified times & expected output snippet | SC-001 evidence | T033 |
| T035 | [US1] Measure watch propagation time editing `packages/protocol/src/messages/core.ts` and record in docs (SC-002) | Document results | T016 |
| T036 | [US1] Check graceful shutdown logs & add test if feasible `apps/server/tests/integration/health.test.ts` extension or new test | Optional reliability | T031 |
| T037 | [US1] Checkpoint: Tag story completion evidence in spec or tasks doc | Mark P1 done | T034 |

### Phase 4: User Story 2 (P2) – Shared Protocol & Types Package
Goal: Single shared package; version drift detection; watch propagation.
Independent Test Criteria: Editing shared schema appears in both builds under 15s; version mismatch surfaces clear error.
| # | Task | Notes/Outputs | Dep |
|---|------|---------------|-----|
| T038 | [US2] Add message envelope & specific message zod schemas in `packages/protocol/src/messages/` (heartbeat, session.join, session.welcome, room.state, error) | FR-011 | T016 |
| T039 | [US2] Export schema types & re-export index `packages/protocol/src/index.ts` ensure tree-shakeable [P] | Consumption by apps | T038 |
| T040 | [US2] Implement server validation integration using shared schemas (update `validateMessage.ts`) | Replace placeholders | T038 |
| T041 | [US2] Add version guard in join handler comparing client version param | Enforce FR-016 | T026 |
| T042 | [US2] Add protocol watch propagation test `packages/protocol/tests/watchPropagation.test.ts` | Edit file triggers compile in dependents | T039 |
| T043 | [US2] Add server version mismatch integration test `apps/server/tests/integration/versionMismatch.test.ts` | Expect VERSION_MISMATCH error | T041 |
| T044 | [US2] Add client handling for version mismatch (display banner) `apps/web/src/components/WorldPlaceholder.tsx` update [P] | Developer visible error | T043 |
| T045 | [US2][RETIRED] (Merged into T015) | (Do not execute) | T015 |
| T046 | [US2][RETIRED] (Merged into T015) | (Do not execute) | T015 |
| T047 | [US2] Document protocol change workflow in README & Quickstart | Dev guidance | T046 |
| T048 | [US2] Checkpoint: Story 2 completion record (prop time measurement & mismatch test results) | SC-002 evidence | T047 |

### Phase 5: User Story 3 (P3) – Authentication & Secure Session Bootstrap
Goal: Authenticated join; unauthenticated rejected; token validation & error handling.
Independent Test Criteria: Unauth join rejected; auth join accepted; expired token triggers renewal path.
| # | Task | Notes/Outputs | Dep |
|---|------|---------------|-----|
| T049 | [US3] Add MSAL init service `apps/web/src/services/auth/initMsal.ts` (client config from env) | FR-020 | T005 |
| T050 | [US3] Add `useAuth` hook `apps/web/src/hooks/useAuth.ts` (login, logout, acquireTokenSilent) [P] | Client identity layer | T049 |
| T051 | [US3] Add server JWKS loader `apps/server/src/auth/jwks.ts` (cache) | D5 decision | T023 |
| T052 | [US3] Add token validator `apps/server/src/auth/validateToken.ts` (verify signature, exp) | FR-006 | T051 |
| T053 | [US3] Update join handler to require token and map claims -> PlayerIdentity | Enforce FR-006 | T052 |
| T054 | [US3] Add unauthorized join test `apps/server/tests/integration/authJoin.test.ts` | Acceptance scenario 1 | T053 |
| T055 | [US3] Add auth guard unit test `apps/server/tests/unit/authGuard.test.ts` | FR-006 reliability | T052 |
| T056 | [US3] Add client join flow integration with token injection `apps/web/src/hooks/useGameConnection.ts` update | Auth handshake | T053 |
| T057 | [US3] Add expired token simulation test (mock jitter) `apps/server/tests/integration/authJoin.test.ts` extension | Renewal logic placeholder | T054 |
| T058 | [US3] Add client UI feedback for auth state (login button, error message) `apps/web/src/components/WorldPlaceholder.tsx` update [P] | UX clarity | T056 |
| T059 | [US3] Log structured auth events (success/failure) in logger | FR-010 | T052 |
| T060 | [US3] Metrics counters for auth failures & active sessions adjusted | FR-017 | T052 |
| T061 | [US3] Document auth setup in README + Quickstart (env variables) | SC-003 evidence | T058 |
| T062 | [US3] Checkpoint: Story 3 completion record (tests pass + doc updates) | Mark P3 done | T061 |

### Phase 6: Polish & Cross-Cutting
| # | Task | Notes/Outputs | Dep |
|---|------|---------------|-----|
| T063 | Refine graceful shutdown: ensure room disposal events logged & test if not done (extend T036) | Reliability | T036 |
| T064 | Add load test harness execution & record metrics (sessions_active peak, failures) update spec with SC-006 evidence | Performance | T021 |
| T065 | Add rate-limit test for heartbeat spam `apps/server/tests/unit/ratelimit.test.ts` | FR-011 | T024 |
| T066 | Add structured logging test `apps/server/tests/unit/logger.test.ts` verifying JSON shape | FR-010 | T011 |
| T067 | Add session metrics test `apps/server/tests/unit/sessions.metrics.test.ts` | FR-017 | T022 |
| T068 | Ensure multi-tab policy documented & tested (allow concurrent) maybe update README | FR-019 | T053 |
| T069 | Review and prune optional `auth-utils` package decision (create or merge) | Keep minimalism | T062 |
| T070 | Final documentation sweep: update `spec.md` with achieved SC results & close risks | Completion readiness | T062 |
| T071 | Tag release candidate / create git tag `baseline-v1` | Versioning | T070 |
| T072 | Add network interruption reconnect with exponential backoff (client) + integration test (simulate disconnect & successful reconnect) `apps/web/src/hooks/useGameConnection.ts` & update `apps/web/tests/contract/connectionStatus.test.tsx` | Edge case (network interruption) | T033 |
| T073 | Add port-in-use detection on server startup (friendly error or auto-increment opt) + unit/integration test `apps/server/tests/unit/portConflict.test.ts` | Edge case (port conflict) | T019 |
| T074 | Implement silent token renewal (MSAL acquireTokenSilent + fallback login) + expiry simulation test updates `apps/server/tests/integration/authJoin.test.ts` & `apps/web/tests/unit/authHook.test.ts` | Token expiry acceptance (SC-003) | T052 |

## Dependency Graph (Stories)
1. Foundational Phases 1–2 must complete before any story.
2. US1 (Phase 3) depends on Foundational; US2 (Phase 4) depends on US1 structures for join handler & version constant; US3 (Phase 5) depends on US1 join flow + US2 protocol versioning for error codes.
3. Polish (Phase 6) depends on completion of all user stories.

Graph (simplified):
Setup -> Foundational -> US1 -> US2 -> US3 -> Polish

## Parallel Execution Examples
- US1: (T025, T027, T028) can run in parallel after T020; T029 parallel after T028; T030 after T024.
- US2: T038 then (T039 [P], T040, T041) where T039 is parallelizable with T040 if schemas stable; UI mismatch handling T044 waits on T043.
- US3: T049 -> (T050 [P], T051) then T052 -> (T053) -> tests (T054, T055 [P]) -> client updates (T056, T058 [P]). Logging/metrics (T059, T060 [P]) parallel post T052.

## Implementation Strategy
- MVP Scope: Complete through US1 (Phase 3) to achieve first playable + baseline tests.
- Incremental Delivery: Merge after each story phase with passing tests & updated docs.
- Versioning: Bump PROTOCOL_VERSION only when breaking change tasks executed (US2). Maintain CHANGELOG entries.
- Testing Focus: Minimal set early (FR-015), expand metrics & rate limit in Polish phase to avoid slowing early velocity.

## Task Coverage Mapping to Functional Requirements (Updated)
- FR-001/013 (README & structure): T006, T034, T047, T061, T070
- FR-002 (bootstrap command): T001, T004, T010
- FR-003 (single dev command): T004, T010
- FR-004/005 (shared protocol & propagation): T015, T038, T039, T042, T035
- FR-006 / FR-020 (auth enforced, OAuth PKCE): T049–T056, T059–T061, T074
- FR-007 (env templates): T005
- FR-008 (placeholder broadcast; clarified pre-auth allowed baseline, post-auth after US3): T020, T026, T027
- FR-009 (health endpoints): T019, T031
- FR-010 (session/auth logging): T011, T059, T066
- FR-011 (validation & rate limit): T013, T014, T024, T030, T065
- FR-012 (watch mode): T003, T010, T042, T035
- FR-014 (env-based config): T005, T061
- FR-015 (placeholder test suite): T031, T032, T033, T042, T043, T054, T055, T065, T066, T067
- FR-016 (protocol versioning): T015, T041, T043 (T045, T046 retired)
- FR-017 (metrics counters): T012, T022, T060, T067
- FR-018 (contrib guidelines): T007, T069
- FR-019 (multi-tab policy): T068 (consider adding explicit concurrent session assertion) 
- FR-021 (baseline load target): T021, T064
- FR-022 (persistence extension point): T012 + documentation (deferred persistence)

Non-Functional / Success Criteria Coverage:
- SC-001 (time-to-first-playable): T010, T034
- SC-002 (propagation <15s): T035, T042
- SC-003 (auth rejection/accept + renewal): T054, T055, T074
- SC-004 (log latency <2s): Pending – add measurement sub-step to T066 (future improvement)
- SC-005 (fail fast <5s): T001, T010 (needs explicit timing assert; add subtask note)
- SC-006 (100 CCU <5% drop): T021 (stub), T064 (execution)
- SC-007 (≥5 tests): Covered by listed test tasks.

## Story Task Counts
- Setup: 10
- Foundational: 14
- US1: 13
- US2: 11 (2 retired → 9 active)
- US3: 15 (includes T074)
- Polish: 11 (added T072, T073)
Total numbered entries: 74 (Active executable: 72)

## Independent Test Criteria (Per Story)
- US1: Single dev command brings up server & client; session join & heartbeat visible.
- US2: Modify shared schema -> both builds update <15s; version mismatch triggers error.
- US3: Unauth join rejected; auth join accepted; expired token triggers renewal attempt logged.

## Parallel Opportunities Summary
- ~40% tasks marked logically parallel (UI vs server vs docs vs tests) though only select tasks flagged explicitly in tables for clarity to avoid race conditions.

## MVP Suggestion
- Deliver through US1 (Phases 1–3) for first merge; ensures baseline functionality and scaffolding before expanding complexity (protocol version workflow, auth integration).

## Completion Checkpoints
- After T037: MVP baseline accepted.
- After T048: Protocol versioning & watch validated.
- After T062: Auth secure join implemented.
- After T071: Baseline feature ready for broader gameplay feature layers.
- After T074: Remediation (renewal + edge cases) complete; feature hardened.

---

End of tasks plan (Remediated).
---
description: "Task list for monorepo framework baseline"
---

# Tasks: Monorepo Framework for Web MMORPG Backend & Frontend

**Input**: Design documents from `/specs/001-monorepo-framework-for/`
**Prerequisites**: plan.md (required), spec.md (user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Feature spec (FR-015, success criteria SC-007) explicitly requires a placeholder test suite. Therefore, targeted tests are INCLUDED (minimal necessary to validate each independent story). Tests are written before implementation within each story phase (quasi-TDD) to ensure independent verification.

**Organization**: Tasks are grouped by user story to ensure each can be delivered & demonstrated independently.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Parallelizable (different file / no ordering dependency)
- **[Story]**: US1 / US2 / US3 (user story association) or `ALL` for shared setup/foundation
- File paths reflect planned structure (apps/, packages/, config/, scripts/). Create files if absent.

---
## Phase 1: Setup (Shared Infrastructure)
**Purpose**: Initialize monorepo skeleton and baseline tooling.

- [x] T001 [ALL] Create root workspace scaffolding: `pnpm-workspace.yaml`, base folders (`apps/server`, `apps/web`, `packages/protocol`, `scripts`, `config`).
- [x] T002 [P] [ALL] Add root `package.json` with scripts: `bootstrap`, `dev`, `build`, `lint`, `test`, engines (Node>=22). (Path: `/home/saitcho/hexmud/package.json`).
- [x] T003 [P] [ALL] Add root `tsconfig.base.json` + `tsconfig.json` referencing base for composite builds.
- [x] T004 [P] [ALL] Initialize `packages/protocol/package.json` (exports types, module, sideEffects false) + `src/index.ts` stub.
- [x] T005 [P] [ALL] Initialize `apps/server/package.json` (depends on `protocol`).
- [x] T006 [P] [ALL] Initialize `apps/web/package.json` (depends on `protocol`).
- [x] T007 [P] [ALL] Configure ESLint + Prettier: `config/eslint.config.cjs`, `.prettierignore`, `.editorconfig`.
- [x] T008 [P] [ALL] Add `vitest.config.ts` at root supporting workspaces + coverage threshold placeholders.
- [x] T009 [P] [ALL] Add `.env.example` with MSAL + ports + protocol version environment placeholders.
- [x] T010 [P] [ALL] Create CONTRIBUTING.md & root README referencing quickstart + structure (FR-001, FR-013, FR-018).
- [x] T011 [P] [ALL] Add `scripts/bootstrap.ts` (Node) verifying Node & pnpm versions; fail fast (FR-002, SC-005).
- [x] T012 [P] [ALL] Add Git ignore `.gitignore` aligned with Node/TypeScript/coverage caches.

**Checkpoint**: Monorepo skeleton present; installs & lint run.

---
## Phase 2: Foundational (Blocking Prerequisites)
**Purpose**: Core cross-cutting capabilities required before any story-specific slice.
**Blocking**: All subsequent phases depend on completion.

- [x] T013 [ALL] Implement `packages/protocol/src/version.ts` exporting `PROTOCOL_VERSION = 1`.
- [x] T014 [P] [ALL] Implement protocol envelope & shared Zod schemas (`packages/protocol/src/messages/envelope.ts`).
- [x] T015 [P] [ALL] Add heartbeat + session.welcome + error message schemas (`packages/protocol/src/messages/core.ts`).
- [x] T016 [P] [ALL] Export index barrel re-exporting version, envelope, message schemas (`packages/protocol/src/index.ts`).
- [x] T017 [P] [ALL] Add TypeScript path mapping / references for protocol consumption by server & web (`tsconfig.base.json`).
- [x] T018 [ALL] Implement root `pnpm dev` script with concurrently: `server:dev`, `web:dev`.
- [x] T019 [P] [ALL] Implement `apps/server/src/config/env.ts` reading env + defaults (ports, log level, protocolVersion).
- [x] T020 [P] [ALL] Implement `apps/server/src/logging/logger.ts` (light JSON console wrapper) (FR-010 baseline).
- [x] T021 [P] [ALL] Implement metrics interface stub `apps/server/src/metrics/adapter.ts` (FR-017 placeholder).
- [x] T022 [P] [ALL] Implement validation util `apps/server/src/validation/validateMessage.ts` using Zod.
- [x] T023 [P] [ALL] Implement rate limit placeholder `apps/server/src/ratelimit/tokenBucket.ts` (in-memory, configurable).
- [x] T024 [ALL] Add `apps/server/src/state/sessions.ts` managing PlayerSession & PlayerIdentity registry (in-memory).
- [x] T025 [P] [ALL] Add `apps/server/src/state/rooms.ts` minimal room manager (create/get placeholder room).
- [x] T026 [P] [ALL] Add Express integration + Colyseus server bootstrap `apps/server/src/server.ts` (health + version endpoints) (FR-009).
- [x] T027 [P] [ALL] Add Vite config `apps/web/vite.config.ts` with React + path aliases for protocol.
- [x] T028 [P] [ALL] Add `apps/web/src/main.tsx` + basic React root + status UI placeholder.
- [x] T029 [P] [ALL] Add MSAL configuration placeholder `apps/web/src/services/auth/msalConfig.ts` (no runtime secret) (foundation for US3 but safe early).
- [x] T030 [ALL] Add `apps/web/src/services/protocol/client.ts` (Colyseus Client connect wrapper stub).
- [x] T031 [ALL] Add root `pnpm test` script + initial empty test suites directories.
- [x] T032 [ALL] Add simple health test (vitest) hitting Express server (ensures foundation works) `apps/server/tests/integration/health.test.ts`.

**Checkpoint**: Foundation ready—server boots, web skeleton builds, shared protocol imported.

---
## Phase 3: User Story 1 - Spin Up Core Game Stack (Priority: P1) 🎯 MVP
**Goal**: Single command starts server + web; client connects to placeholder world & receives heartbeat.
**Independent Test**: Fresh clone → `pnpm bootstrap && pnpm dev` results in server listening, web UI shows "Connected to game world" within 5s; Ctrl+C shuts both down cleanly.

### Tests (US1)
- [x] T033 [P] [US1] Add integration test spawning server and simulating a Colyseus client joining placeholder room (no auth) `apps/server/tests/integration/roomJoin.test.ts`.
- [x] T034 [P] [US1] Add web component test verifying connection status UI updates after handshake `apps/web/tests/contract/connectionStatus.test.tsx`.
- [x] T035 [P] [US1] Add watch propagation test: modify protocol constant mock & assert rebuild detection (script) `packages/protocol/tests/watchPropagation.test.ts` (may use fs timestamp diff).

### Implementation (US1)
- [x] T036 [P] [US1] Implement Colyseus Room class `apps/server/src/rooms/PlaceholderRoom.ts` broadcasting `room.state` at interval.
- [x] T037 [US1] Wire room definition in server bootstrap (`server.ts`) with `gameServer.define('placeholder', PlaceholderRoom)`.
- [x] T038 [P] [US1] Implement client connection logic `apps/web/src/protocol/placeholderClient.ts` (connect + listen for state).
- [x] T039 [P] [US1] Implement React hook `useGameConnection` `apps/web/src/hooks/useGameConnection.ts` exposing state & heartbeat latency.
- [x] T040 [US1] Render placeholder world component `apps/web/src/components/WorldPlaceholder.tsx` using hook.
- [x] T041 [US1] Add graceful shutdown signal handling in `apps/server/src/server.ts` (SIGINT -> gameServer.shutdown).
- [x] T042 [US1] Add README section "Quick Start" referencing US1 test criteria.
- [x] T043 [US1] Update quickstart.md with actual commands & placeholders replaced.

**Checkpoint**: US1 independently deliverable (MVP). Proceed to US2 only after merging US1 if incremental delivery desired.

---
## Phase 4: User Story 2 - Shared Protocol & Types Package (Priority: P2)
**Goal**: Single shared protocol package; editing a message field reflects in both builds automatically; version bump mismatch detection.
**Independent Test**: Modify message schema field & observe type availability in server & web without manual path change; simulate version mismatch triggers warning.

### Tests (US2)
- [x] T044 [P] [US2] Add unit test validating `PROTOCOL_VERSION` export & numeric type `packages/protocol/tests/version.test.ts`.
- [x] T045 [P] [US2] Add integration test: server rejects join with client version +1 (simulate mismatch) `apps/server/tests/integration/versionMismatch.test.ts`.
- [x] T046 [P] [US2] Add validation test: malformed envelope → error message `apps/server/tests/unit/validation.test.ts`.

### Implementation (US2)
- [x] T047 [P] [US2] Implement protocol version guard in join handler (server state/session join path) `apps/server/src/handlers/join.ts`.
- [x] T048 [P] [US2] Implement structured error sender helper `apps/server/src/handlers/error.ts`.
- [x] T049 [US2] Expose additional sample message schema update (e.g., add `build:number` to welcome) & propagate to client UI display.
- [x] T050 [P] [US2] Add dev script to bump protocol version `scripts/bump-protocol-version.ts` updating version.ts & CHANGELOG entry.
- [x] T051 [US2] Add documentation section in README: "Protocol Versioning & Breaking Changes".
- [x] T052 [US2] Add watch mode note & troubleshooting in quickstart.md.

**Checkpoint**: US2 ensures safe shared evolution; independent from auth.

---
## Phase 5: User Story 3 - Authentication & Secure Session Bootstrap (Priority: P3)
**Goal**: Only authenticated joins accepted; unauthenticated connections rejected with `AUTH_REQUIRED`; token expiry triggers renewal.
**Independent Test**: Unauthenticated join rejected; after MSAL login join succeeds; expired token refresh path executes.

### Tests (US3)
- [x] T053 [P] [US3] Unit test: join without token -> `AUTH_REQUIRED` error `apps/server/tests/unit/authGuard.test.ts`.
- [x] T054 [P] [US3] Integration test: simulated token (mock JWKS) accepted `apps/server/tests/integration/authJoin.test.ts`.
- [x] T055 [P] [US3] Web auth hook test verifying MSAL acquireToken & rejoin `apps/web/tests/unit/authHook.test.ts`.

### Implementation (US3)
- [x] T056 [P] [US3] Implement JWKS fetch & cache util `apps/server/src/auth/jwks.ts`.
- [x] T057 [P] [US3] Implement token validator `apps/server/src/auth/validateToken.ts` (signature, expiry, audience checks).
- [x] T058 [US3] Integrate auth guard into join handler (modify `handlers/join.ts`) returning structured errors.
- [x] T059 [P] [US3] Implement MSAL browser setup `apps/web/src/services/auth/initMsal.ts` (PublicClientApplication instance).
- [x] T060 [P] [US3] Implement React auth hook `useAuth` `apps/web/src/hooks/useAuth.ts` (login, logout, get token, silent renew placeholder).
- [x] T061 [P] [US3] Wire token acquisition into `useGameConnection` (include token on join).
- [x] T062 [US3] Update placeholder UI to show authenticated playerId `apps/web/src/components/WorldPlaceholder.tsx`.
- [x] T063 [US3] Update README & quickstart with auth setup instructions & .env variables (FR-007, FR-020).
- [x] T064 [US3] Add structured log events for auth lifecycle `apps/server/src/logging/events.ts`.

**Checkpoint**: All three user stories independently testable.

---
## Phase 6: Polish & Cross-Cutting Concerns
**Purpose**: Hardening and refinement after core stories.

- [x] T065 [P] Add structured logging format enhancements (correlation id) `apps/server/src/logging/logger.ts`.
- [x] T066 [P] Add metrics event emission (sessions_total, sessions_active) instrumentation `apps/server/src/metrics/adapter.ts` & integrate in session events.
- [x] T067 [P] Add load test script stub `scripts/load-test.ts` (simulate 100 concurrent sessions) (SC-006 prep).
- [x] T068 [P] Add rate limit enforcement to heartbeat path & unit test `apps/server/tests/unit/ratelimit.test.ts`.
- [x] T069 Documentation pass: finalize CONTRIBUTING (commit message guide) & protocol change workflow.
- [x] T070 Add CI pipeline config stub (GitHub Actions) running lint + test matrix Node 22.
- [x] T071 Validate quickstart against clean clone script (automate) `scripts/validate-quickstart.ts`.
- [x] T072 Security review checklist doc `specs/001-monorepo-framework-for/security-review.md` summarizing guards.

---
## Dependencies & Execution Order

### Phase Dependencies
- Phase 1 → Phase 2 → (US1, US2, US3 parallel after Phase 2 if desired) → Phase 6
- Recommended delivery order: US1 (MVP) → US2 → US3 for incremental review.

### Story Independence
- US1 requires foundation only.
- US2 builds on foundation + protocol pieces (independent of auth) — optional to start parallel with late US1 tasks.
- US3 depends on join handler (foundation) but not on US2 logic (auth guard modular); can start after T047 join guard stub pattern clarified or earlier with feature flags.

### Critical Path (Sequential Minimal MVP → Full)
T001–T032 → (US1: T033–T043) → (US2: T044–T052) → (US3: T053–T064) → Polish (T065+)

### Parallel Opportunities
- Setup: T002–T012 mostly parallel after T001 directory creation.
- Foundation: T014–T023 parallel (all distinct files).
- US1 Tests (T033–T035) parallel; Implementation T036, T038, T039 parallel; T037, T040 depend on earlier code.
- US2 Tests T044–T046 parallel; Implementation T047–T052 mostly parallel (T048 after T047; docs last).
- US3 Tests parallel; Implementation: T056–T061 parallel; T058 depends on validator; UI updates after hooks.
- Polish tasks mostly parallel.

---
## Parallel Execution Examples
- After T001: run T002, T003, T004, T005, T006, T007, T008, T009, T010, T011, T012 concurrently.
- After T013: run T014–T023 concurrently.
- US1 start: run T033, T034, T035 then T036, T038, T039 concurrently while T037 waits for T036; T040 waits for hook & client files.
- US3 start: run T056, T057, T059, T060, T061 concurrently; then T058 integrates; then T062.

---
## Implementation Strategy
1. Deliver US1 fast (time-to-first-playable) for stakeholder validation.
2. Layer protocol versioning hardness (US2) ensuring safe evolution.
3. Add authentication (US3) before any persistence or sensitive gameplay logic in future features.
4. Polish with metrics, logging enrichments, load test stub, and CI scaffolding.
5. Keep optional package (`auth-utils`) minimal; merge into protocol if under threshold to avoid fragmentation.
