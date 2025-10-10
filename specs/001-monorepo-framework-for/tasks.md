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

- [ ] T001 [ALL] Create root workspace scaffolding: `pnpm-workspace.yaml`, base folders (`apps/server`, `apps/web`, `packages/protocol`, `scripts`, `config`).
- [ ] T002 [P] [ALL] Add root `package.json` with scripts: `bootstrap`, `dev`, `build`, `lint`, `test`, engines (Node>=22). (Path: `/home/saitcho/hexmud/package.json`).
- [ ] T003 [P] [ALL] Add root `tsconfig.base.json` + `tsconfig.json` referencing base for composite builds.
- [ ] T004 [P] [ALL] Initialize `packages/protocol/package.json` (exports types, module, sideEffects false) + `src/index.ts` stub.
- [ ] T005 [P] [ALL] Initialize `apps/server/package.json` (depends on `protocol`).
- [ ] T006 [P] [ALL] Initialize `apps/web/package.json` (depends on `protocol`).
- [ ] T007 [P] [ALL] Configure ESLint + Prettier: `config/eslint.config.cjs`, `.prettierignore`, `.editorconfig`.
- [ ] T008 [P] [ALL] Add `vitest.config.ts` at root supporting workspaces + coverage threshold placeholders.
- [ ] T009 [P] [ALL] Add `.env.example` with MSAL + ports + protocol version environment placeholders.
- [ ] T010 [P] [ALL] Create CONTRIBUTING.md & root README referencing quickstart + structure (FR-001, FR-013, FR-018).
- [ ] T011 [P] [ALL] Add `scripts/bootstrap.ts` (Node) verifying Node & pnpm versions; fail fast (FR-002, SC-005).
- [ ] T012 [P] [ALL] Add Git ignore `.gitignore` aligned with Node/TypeScript/coverage caches.

**Checkpoint**: Monorepo skeleton present; installs & lint run.

---
## Phase 2: Foundational (Blocking Prerequisites)
**Purpose**: Core cross-cutting capabilities required before any story-specific slice.
**Blocking**: All subsequent phases depend on completion.

- [ ] T013 [ALL] Implement `packages/protocol/src/version.ts` exporting `PROTOCOL_VERSION = 1`.
- [ ] T014 [P] [ALL] Implement protocol envelope & shared Zod schemas (`packages/protocol/src/messages/envelope.ts`).
- [ ] T015 [P] [ALL] Add heartbeat + session.welcome + error message schemas (`packages/protocol/src/messages/core.ts`).
- [ ] T016 [P] [ALL] Export index barrel re-exporting version, envelope, message schemas (`packages/protocol/src/index.ts`).
- [ ] T017 [P] [ALL] Add TypeScript path mapping / references for protocol consumption by server & web (`tsconfig.base.json`).
- [ ] T018 [ALL] Implement root `pnpm dev` script with concurrently: `server:dev`, `web:dev`.
- [ ] T019 [P] [ALL] Implement `apps/server/src/config/env.ts` reading env + defaults (ports, log level, protocolVersion).
- [ ] T020 [P] [ALL] Implement `apps/server/src/logging/logger.ts` (light JSON console wrapper) (FR-010 baseline).
- [ ] T021 [P] [ALL] Implement metrics interface stub `apps/server/src/metrics/adapter.ts` (FR-017 placeholder).
- [ ] T022 [P] [ALL] Implement validation util `apps/server/src/validation/validateMessage.ts` using Zod.
- [ ] T023 [P] [ALL] Implement rate limit placeholder `apps/server/src/ratelimit/tokenBucket.ts` (in-memory, configurable).
- [ ] T024 [ALL] Add `apps/server/src/state/sessions.ts` managing PlayerSession & PlayerIdentity registry (in-memory).
- [ ] T025 [P] [ALL] Add `apps/server/src/state/rooms.ts` minimal room manager (create/get placeholder room).
- [ ] T026 [P] [ALL] Add Express integration + Colyseus server bootstrap `apps/server/src/server.ts` (health + version endpoints) (FR-009).
- [ ] T027 [P] [ALL] Add Vite config `apps/web/vite.config.ts` with React + path aliases for protocol.
- [ ] T028 [P] [ALL] Add `apps/web/src/main.tsx` + basic React root + status UI placeholder.
- [ ] T029 [P] [ALL] Add MSAL configuration placeholder `apps/web/src/services/auth/msalConfig.ts` (no runtime secret) (foundation for US3 but safe early).
- [ ] T030 [ALL] Add `apps/web/src/services/protocol/client.ts` (Colyseus Client connect wrapper stub).
- [ ] T031 [ALL] Add root `pnpm test` script + initial empty test suites directories.
- [ ] T032 [ALL] Add simple health test (vitest) hitting Express server (ensures foundation works) `apps/server/tests/integration/health.test.ts`.

**Checkpoint**: Foundation ready—server boots, web skeleton builds, shared protocol imported.

---
## Phase 3: User Story 1 - Spin Up Core Game Stack (Priority: P1) 🎯 MVP
**Goal**: Single command starts server + web; client connects to placeholder world & receives heartbeat.
**Independent Test**: Fresh clone → `pnpm bootstrap && pnpm dev` results in server listening, web UI shows "Connected to game world" within 5s; Ctrl+C shuts both down cleanly.

### Tests (US1)
- [ ] T033 [P] [US1] Add integration test spawning server and simulating a Colyseus client joining placeholder room (no auth) `apps/server/tests/integration/roomJoin.test.ts`.
- [ ] T034 [P] [US1] Add web component test verifying connection status UI updates after handshake `apps/web/tests/contract/connectionStatus.test.tsx`.
- [ ] T035 [P] [US1] Add watch propagation test: modify protocol constant mock & assert rebuild detection (script) `packages/protocol/tests/watchPropagation.test.ts` (may use fs timestamp diff).

### Implementation (US1)
- [ ] T036 [P] [US1] Implement Colyseus Room class `apps/server/src/rooms/PlaceholderRoom.ts` broadcasting `room.state` at interval.
- [ ] T037 [US1] Wire room definition in server bootstrap (`server.ts`) with `gameServer.define('placeholder', PlaceholderRoom)`.
- [ ] T038 [P] [US1] Implement client connection logic `apps/web/src/protocol/placeholderClient.ts` (connect + listen for state).
- [ ] T039 [P] [US1] Implement React hook `useGameConnection` `apps/web/src/hooks/useGameConnection.ts` exposing state & heartbeat latency.
- [ ] T040 [US1] Render placeholder world component `apps/web/src/components/WorldPlaceholder.tsx` using hook.
- [ ] T041 [US1] Add graceful shutdown signal handling in `apps/server/src/server.ts` (SIGINT -> gameServer.shutdown).
- [ ] T042 [US1] Add README section "Quick Start" referencing US1 test criteria.
- [ ] T043 [US1] Update quickstart.md with actual commands & placeholders replaced.

**Checkpoint**: US1 independently deliverable (MVP). Proceed to US2 only after merging US1 if incremental delivery desired.

---
## Phase 4: User Story 2 - Shared Protocol & Types Package (Priority: P2)
**Goal**: Single shared protocol package; editing a message field reflects in both builds automatically; version bump mismatch detection.
**Independent Test**: Modify message schema field & observe type availability in server & web without manual path change; simulate version mismatch triggers warning.

### Tests (US2)
- [ ] T044 [P] [US2] Add unit test validating `PROTOCOL_VERSION` export & numeric type `packages/protocol/tests/version.test.ts`.
- [ ] T045 [P] [US2] Add integration test: server rejects join with client version +1 (simulate mismatch) `apps/server/tests/integration/versionMismatch.test.ts`.
- [ ] T046 [P] [US2] Add validation test: malformed envelope → error message `apps/server/tests/unit/validation.test.ts`.

### Implementation (US2)
- [ ] T047 [P] [US2] Implement protocol version guard in join handler (server state/session join path) `apps/server/src/handlers/join.ts`.
- [ ] T048 [P] [US2] Implement structured error sender helper `apps/server/src/handlers/error.ts`.
- [ ] T049 [US2] Expose additional sample message schema update (e.g., add `build:number` to welcome) & propagate to client UI display.
- [ ] T050 [P] [US2] Add dev script to bump protocol version `scripts/bump-protocol-version.ts` updating version.ts & CHANGELOG entry.
- [ ] T051 [US2] Add documentation section in README: "Protocol Versioning & Breaking Changes".
- [ ] T052 [US2] Add watch mode note & troubleshooting in quickstart.md.

**Checkpoint**: US2 ensures safe shared evolution; independent from auth.

---
## Phase 5: User Story 3 - Authentication & Secure Session Bootstrap (Priority: P3)
**Goal**: Only authenticated joins accepted; unauthenticated connections rejected with `AUTH_REQUIRED`; token expiry triggers renewal.
**Independent Test**: Unauthenticated join rejected; after MSAL login join succeeds; expired token refresh path executes.

### Tests (US3)
- [ ] T053 [P] [US3] Unit test: join without token -> `AUTH_REQUIRED` error `apps/server/tests/unit/authGuard.test.ts`.
- [ ] T054 [P] [US3] Integration test: simulated token (mock JWKS) accepted `apps/server/tests/integration/authJoin.test.ts`.
- [ ] T055 [P] [US3] Web auth hook test verifying MSAL acquireToken & rejoin `apps/web/tests/unit/authHook.test.ts`.

### Implementation (US3)
- [ ] T056 [P] [US3] Implement JWKS fetch & cache util `apps/server/src/auth/jwks.ts`.
- [ ] T057 [P] [US3] Implement token validator `apps/server/src/auth/validateToken.ts` (signature, expiry, audience checks).
- [ ] T058 [US3] Integrate auth guard into join handler (modify `handlers/join.ts`) returning structured errors.
- [ ] T059 [P] [US3] Implement MSAL browser setup `apps/web/src/services/auth/initMsal.ts` (PublicClientApplication instance).
- [ ] T060 [P] [US3] Implement React auth hook `useAuth` `apps/web/src/hooks/useAuth.ts` (login, logout, get token, silent renew placeholder).
- [ ] T061 [P] [US3] Wire token acquisition into `useGameConnection` (include token on join).
- [ ] T062 [US3] Update placeholder UI to show authenticated playerId `apps/web/src/components/WorldPlaceholder.tsx`.
- [ ] T063 [US3] Update README & quickstart with auth setup instructions & .env variables (FR-007, FR-020).
- [ ] T064 [US3] Add structured log events for auth lifecycle `apps/server/src/logging/events.ts`.

**Checkpoint**: All three user stories independently testable.

---
## Phase 6: Polish & Cross-Cutting Concerns
**Purpose**: Hardening and refinement after core stories.

- [ ] T065 [P] Add structured logging format enhancements (correlation id) `apps/server/src/logging/logger.ts`.
- [ ] T066 [P] Add metrics event emission (sessions_total, sessions_active) instrumentation `apps/server/src/metrics/adapter.ts` & integrate in session events.
- [ ] T067 [P] Add load test script stub `scripts/load-test.ts` (simulate 100 concurrent sessions) (SC-006 prep).
- [ ] T068 [P] Add rate limit enforcement to heartbeat path & unit test `apps/server/tests/unit/ratelimit.test.ts`.
- [ ] T069 Documentation pass: finalize CONTRIBUTING (commit message guide) & protocol change workflow.
- [ ] T070 Add CI pipeline config stub (GitHub Actions) running lint + test matrix Node 22.
- [ ] T071 Validate quickstart against clean clone script (automate) `scripts/validate-quickstart.ts`.
- [ ] T072 Security review checklist doc `specs/001-monorepo-framework-for/security-review.md` summarizing guards.

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

## Task Counts
- Total Tasks: 72
- Setup: 12
- Foundational: 20 (including version + supporting utilities through T032) *[Note: counts tasks T013–T032 = 20]*
- US1: 11 (T033–T043)
- US2: 9 (T044–T052)
- US3: 12 (T053–T064)
- Polish: 8 (T065–T072)

## Independent Test Criteria Summary
- US1: Server + web start, handshake + heartbeat within 5s, graceful shutdown.
- US2: Schema edit propagates, version mismatch rejection surfaced.
- US3: Unauth join rejected, auth join succeeds, token expiry triggers renewal path.

## MVP Scope Recommendation
MVP = Phases 1–2 plus US1 (T001–T043). Provides playable loop & scaffolding for further expansion.
