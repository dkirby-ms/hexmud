---
description: "Implementation task list for feature: Wire Up Authentication (External Identity Provider)"
---

# Tasks: Wire Up Authentication (External Identity Provider)

**Feature Directory**: `specs/002-wire-up-authentication/`
**Source Impacted**: `apps/web`, `apps/server`
**Primary Libraries**: `@azure/msal-browser`, `jose`, `colyseus`, `zod`
**Token Renewal Window**: <5 minutes remaining triggers silent renewal (every 60s retry) (Decision D2)
**Authorization Model**: Minimal roles (player, optional moderator flag) (Decision D3)

Tests were explicitly described in spec acceptance scenarios and quickstart; include targeted tests (unit + integration + metrics/log/logging) tied to user stories. No exhaustive fuzz tests in this iteration.

## Format
`[ID] [P?] [Story] Description (file path)`  
- `[P]` indicates the task can be executed in parallel with other `[P]` tasks (different files, no ordering dependency).  
- `[US#]` labels the user story (US1, US2, US3).  
- Omit `[Story]` for setup/foundational/polish phases.  
- Tasks are atomic: one clear edit / addition per task.  

## Phase 1: Setup (Shared Infrastructure)
Purpose: Ensure environment + config ready; no code logic changes yet beyond config scaffolding.

- [X] T001 Verify env var documentation reflects required auth vars (`specs/002-wire-up-authentication/quickstart.md`) and cross-link from root `README.md` (add Auth section).
- [X] T002 [P] Add sample `.env.example` entries for web (`VITE_MSAL_CLIENT_ID`, `VITE_MSAL_AUTHORITY`, `VITE_MSAL_REDIRECT_URI`, `VITE_MSAL_SCOPES`) in `apps/web/.env.example`.
- [X] T003 [P] Add sample `.env.example` entries for server (`MSAL_CLIENT_ID`, `MSAL_AUTHORITY`, `MSAL_JWKS_URI`) in `apps/server/.env.example`.
- [X] T004 Create developer doc snippet `docs/auth-config.md` summarizing configuration + renewal strategy referencing Decisions D1–D7.
- [X] T005 [P] Confirm existing test helper `apps/server/tests/helpers/auth.ts` covers JWKS issuance; extend docstring with renewal note.

**Checkpoint**: Environment + documentation ready.

## Phase 2: Foundational (Blocking Prerequisites)
Purpose: Core cross-story primitives needed before implementing story logic beyond current baseline.

- [X] T006 Add server auth settings guard: extend `apps/server/src/config/env.ts` (if missing) to surface `MSAL_JWKS_URI` (skip if present) + typed interface.
- [X] T007 [P] Add constant for acceptable clock skew (120s) in `apps/server/src/auth/validateToken.ts` or new `constants.ts`; integrate into validation error messaging (claim nbf handling placeholder if needed).
- [X] T008 [P] Add structured log event type definitions update in `apps/server/src/logging/events.ts` for canonical set (spec FR-010): `auth.signin.success`, `auth.signin.failure`, `auth.token.validation.failure`, `auth.signout`, `auth.renewal.success`, `auth.renewal.failure` (include reason + `authCorrId`). (Do NOT add extra events without spec update.)
- [X] T009 Implement initial metrics scaffolding in `apps/server/src/metrics/adapter.ts` (or new `authMetrics.ts`) for: active sessions gauge, token validations total counter, token validation failures (reason), signin success/failure counters (placeholders), renewal success/failure counters, signin duration histogram, renewal latency histogram. (Full wiring in T061/T062.)
- [X] T010 [P] Update protocol join envelope documentation (`packages/protocol/src/messages/envelope.ts` or `protocol-messages.md`) to clarify optional `accessToken` usage when auth enabled (no breaking change; do not increment protocol version since field already present logically— verify; if absent, plan minor addition and bump only if required). Add TODO note referencing PROTOCOL_VERSION bump gating rule.
- [X] T011 Add minimal invalid token attempt counter increment (no enforcement) in `apps/server/src/ratelimit/heartbeat.ts` (or security module) to support future rate limiting; expose metric only (Principle 5 alignment).
- [X] T012 [P] Ensure integration test scaffold for auth already exists; if not, create `apps/server/tests/integration/authJoin.test.ts` baseline (verify existing; adjust to cover negative missing token) referencing FR-004/FR-005.

**Checkpoint**: Foundation complete; user story work may proceed.

## Phase 3: User Story 1 - Sign In & Receive Token (Priority: P1) 🎯 MVP
Goal: User can initiate sign-in (redirect or popup fallback), obtain a valid token, UI reflects authenticated state. (FR-001, FR-002)
Independent Test: Fresh session -> click Sign In -> redirected -> token acquired -> `useAuth` state == authenticated; backend accepts token on join attempt (happy path) & cancellation path leaves unauthenticated state.

### Tests (Write First)
- [X] T013 [P] [US1] Extend `apps/web/tests/unit/authHook.test.ts` to add redirect flow success test simulating `handleRedirectPromise` token result.
- [X] T014 [P] [US1] Add test for canceled sign-in (simulate thrown InteractionRequired / user cancel) verifying state returns unauthenticated with non-intrusive error.
- [X] T015 [P] [US1] Add test covering slight future `nbf` (simulate claims with future nbf within skew) ensuring accept path on server (utilize test token issuance override) in `apps/server/tests/integration/authJoin.test.ts`.

### Implementation
- [X] T016 [P] [US1] Add redirect-based sign-in trigger UI control (if missing) in `apps/web/src/components/WorldPlaceholder.tsx` (show Sign In / Sign Out states).
- [X] T017 [US1] Refactor `useAuth.ts` to expose explicit `signInRedirect` (already present) ensure fallback path documented + add inline comments referencing D1.
- [X] T018 [P] [US1] Enhance `useAuth.ts` to surface specific error codes for cancellation vs generic errors (map to InteractionRequired / user cancel) for UI message granularity.
- [X] T019 [US1] Add authenticated state indicator (e.g., display account username) in `WorldPlaceholder.tsx`.
- [X] T020 [P] [US1] Add basic structured client log (console.info) when sign-in succeeds or fails (placeholder; future telemetry integration) in `useAuth.ts`.
- [X] T021 [US1] Update quickstart `specs/002-wire-up-authentication/quickstart.md` with redirect vs popup explanation and cancellation scenario.
- [X] T022 [US1] Update README Auth section referencing how to trigger redirect sign-in (link to quickstart doc).

**Checkpoint**: US1 complete; MVP deliverable (sign-in + token retrieval + basic acceptance by server).

## Phase 4: User Story 2 - Establish Authenticated Game Session (Priority: P2)
Goal: Token attached on join; server validates token & creates session with identity + roles (FR-003, FR-004, FR-006, FR-008, FR-010, FR-011 partial).
Independent Test: Attempt join with valid token => success & session record with playerId; attempt join without token => unauthorized; invalid signature => unauthorized + log event.

### Tests (Write First)
- [X] T023 [P] [US2] Add integration test for missing token rejection (if not already) verifying error code & no session record in `apps/server/tests/integration/authJoin.test.ts`.
- [X] T024 [P] [US2] Add integration test for invalid signature token (mutate last char) expecting `auth.token.invalid` log & unauthorized.
- [X] T025 [P] [US2] Add unit test for `validateToken` clock skew acceptance & rejection beyond skew (create new `apps/server/tests/unit/validateTokenSkew.test.ts`).
- [X] T026 [P] [US2] Add test verifying roles extraction (moderator claim -> roles includes 'moderator') using issued token in integration test.

### Implementation
- [X] T027 [US2] Extend `validateToken.ts` to enforce nbf skew logic (T007 constant) and produce descriptive error reasons (claimMissing|expired|signature|nbfSkew|revoked placeholder) mapped to FR-004.
- [X] T028 [P] [US2] Parse roles (moderator flag) from claims in `join.ts` (derive from a claim or placeholder mapping) store in session state structure (update `apps/server/src/state/sessions.ts`).
- [X] T029 [US2] Emit structured log events per FR-010 in success/failure paths inside `join.ts` (ensure standardized reason field).
- [X] T030 [P] [US2] Increment metrics counters / gauge updates at validation points (signin success not applicable server side; token validation success/failure; active sessions gauge) in metrics adapter (T009 scaffolding).
- [X] T031 [US2] Add unauthorized standardized error message constants in `apps/server/src/handlers/error.ts` (avoid leaking raw signature errors) referencing FR-005.
- [X] T032 [P] [US2] Update `apps/web/src/hooks/useGameConnection.ts` to automatically include latest `accessToken` when establishing connection/join message (if not yet present) (FR-003).
- [X] T033 [US2] Add doc note in `docs/auth-config.md` about role claim source and session binding.

**Checkpoint**: US2 complete; authenticated gameplay sessions established; session contains identity + roles; metrics/logging operational.

## Phase 5: User Story 3 - Seamless Token Renewal & Sign Out (Priority: P3)
Goal: Silent renewal before expiry; sign-out clears state; failures trigger re-auth guidance (FR-007, FR-013, FR-012 partial, FR-010 renewal events, FR-011 renewal metrics).
Independent Test: Force near-expiry token -> silent renewal obtains new token without user action; sign-out clears token and subsequent join fails; renewal failure triggers prompt.

### Tests (Write First)
- [X] T034 [P] [US3] Add unit test simulating token nearing expiry triggering silent renewal path in `apps/web/tests/unit/authHook.test.ts` (mock `acquireTokenSilent` re-issue).
- [X] T035 [P] [US3] Add unit test for renewal failure then success on retry (exponential backoff mocked) verifying log events sequence.
- [ ] T036 [P] [US3] Add integration test: expired token used on join triggers unauthorized then client renews and retries successfully (new `apps/web/tests/contract/connectionRenewal.test.tsx` or integration analog).
- [ ] T037 [P] [US3] Add test for sign-out: after calling signOut, join attempt fails until re-auth.

### Implementation
- [ ] T038 [US3] Implement renewal timer / scheduler in `useAuth.ts` (background interval checking remaining lifetime; <5m triggers refresh) respecting existing refresh logic.
- [ ] T039 [P] [US3] Add exponential backoff retry strategy (60s base) for renewal failure until expiry window exceeded; surface state changes.
- [ ] T040 [US3] Emit client console log placeholders for renewal success/failure (align names with server events for future telemetry linking).
- [ ] T041 [P] [US3] Extend `signOut` to broadcast (e.g., localStorage key write) so other tabs detect sign-out (basic multi-tab coherence per edge case list) (FR-013 enhancement; minimal implementation).
- [ ] T042 [US3] On sign-out ensure any running renewal timer cleared (prevent memory leaks) in `useAuth.ts`.
- [ ] T043 [P] [US3] Update server `join.ts` to detect expired token mid-session scenario (if token invalid after initial join attempt) ensuring standardized rejection reason (edge case) (may already covered by validation; just add explicit log path if missing).
- [ ] T044 [US3] Add metrics increments for renewal success/failure (T009 scaffolding) and ensure gauge adjust if sign-out disconnects sessions.
- [ ] T045 [P] [US3] Update quickstart with renewal behavior & troubleshooting table (network failure, backoff, manual reauth prompt).
- [ ] T046 [US3] Document sign-out + multi-tab propagation in `docs/auth-config.md`.

**Checkpoint**: US3 complete; long-lived sessions sustained; sign-out hygiene verified.

## Phase 6: Polish & Cross-Cutting Concerns
Purpose: Hardening, documentation, performance validation, and cleanup across stories.

- [ ] T047 Run load test `scripts/load-test.ts` scenario for 500 concurrent sessions measuring added latency (<5% overhead) and document results in `specs/002-wire-up-authentication/research.md` appendix.
- [ ] T048 [P] Scrub logs to ensure no PII beyond allowed fields; add redaction or truncation where necessary in `apps/server/src/logging/logger.ts` (hash email if logged).
- [ ] T049 [P] Add README performance section summarizing SC-001..SC-006 achievement snapshot.
- [ ] T050 Review metrics naming consistency vs spec & update naming map in `docs/auth-config.md`.
- [ ] T051 [P] Refactor any duplicated role extraction logic into helper `apps/server/src/auth/extractRoles.ts` (if duplication detected after US2 completion).
- [ ] T052 Ensure all TODO comments resolved or converted to tracked issues; update `tasks.md` status if automation available.
- [ ] T053 [P] Final pass: confirm protocol version unchanged or bump if envelope modification required; update `packages/protocol/CHANGELOG.md` accordingly.
- [ ] T054 Validate quickstart end-to-end using clean environment: sign-in, join, renewal simulated, sign-out; record in `quickstart.md` results section.

## Phase 2.5: Remediation (Critical & High Gaps)
Purpose: Close specification alignment gaps (correlation IDs, open policy logging, JWKS rotation, secret handling, metrics completeness, provider outage handling, replay harness) before broad implementation phases advance.

- [ ] T055 [P] Implement correlation ID generation (ULID/UUIDv7) in client sign-in & attach to outbound join/auth requests; propagate into server logs (FR-010, SC-005).
- [ ] T056 [P] Add server middleware/util to inject `authCorrId` into all auth-related structured log events; update logger tests.
- [ ] T057 [P] Implement open policy logging: record `iss` + tenant/directory claim (if present) at info/debug on successful validation (FR-009) without blocking flow.
- [ ] T058 [P] Add JWKS rotation cache layer (current + previous set, 10m overlap) with test simulating rotation (Edge Case, FR-004 support).
- [ ] T059 [P] Initial sign-in provider unavailability handling: detect network/timeout, present retry UI state, exponential backoff (FR-012) with unit tests.
- [ ] T060 [P] Enforce in-memory token storage only; audit code to remove any persistent token writes; add test asserting localStorage/sessionStorage free of token (FR-015).
- [ ] T061 Wire metrics timers: measure sign-in duration (client start→token available) & emit histogram; add join auth overhead measurement (FR-011, SC-001, SC-004).
- [ ] T062 Add total token validations counter & failure rate computation doc; test deriving SC-002 numerator/denominator (FR-011, SC-002).
- [ ] T063 Add unauthorized response test suite verifying standardized messages & no raw crypto leaks for missing/invalid/expired/nbfSkew (FR-005).
- [ ] T064 Add long-duration simulated renewal test (advance timers) covering multiple sequential renewals for 60m continuity (SC-003).
- [ ] T065 Capture baseline unauthenticated join latency artifact & comparative authenticated latency report (SC-004 methodology) stored in `research.md`.
- [ ] T066 Document and test multi-tab sign-out sentinel key (`auth:signout`) ensuring no token material present (FR-013, FR-015 synergy).
- [ ] T067 Extend replay harness to accept deterministic token injection + invalid token scenarios (Constitution P3 alignment).
- [ ] T068 Update spec & plan references if additional events or metrics are added during remediation (governance sync).

**Checkpoint**: Critical/High remediation complete (C1, C2, G1–G6, G5 parts, N1, N2, I1/I2) enabling continued story implementation.

**Checkpoint**: Feature ready for merge; success criteria evaluated.

## Dependencies & Execution Order

### Phase Dependencies
- Setup (Phase 1) → Foundational (Phase 2) → US1 (Phase 3) → US2 (Phase 4) → US3 (Phase 5) → Polish (Phase 6)
- User stories can begin only after Foundational complete. US2 logically depends on presence of token acquisition from US1 but tests use issued tokens; because join can be tested with mock tokens, US2 could start in parallel with late US1 tasks if T016–T019 not critical. Renewal (US3) depends on US1 token mechanics.

### Task Dependency Highlights
- T007 prerequisite for T027 (skew enforcement).
- T009 metrics scaffold prerequisite for T030, T044.
- T010 protocol doc update before any client change referencing accessToken semantics (T032).
- T027 (validation reasons) before tests verifying reason mapping if added (potential extension test not explicitly listed; add if necessary).

### Parallel Opportunities
- Setup: T002, T003, T005 parallel.
- Foundational: T007, T008, T009, T010, T011, T012 parallel once T006 completes.
- US1 Tests: T013–T015 all parallel.
- US1 Implementation: T016, T018, T020 parallel; T017 before T018 (refactor before enhancement); T019 after T016; T021–T022 after implementation tasks.
- US2 Tests: T023–T026 parallel.
- US2 Implementation: T028, T030, T032 parallel after T027; T029 after T027; T031 after error constant ready (same file sequencing); T033 after role/session tasks.
- US3 Tests: T034–T037 parallel.
- US3 Implementation: T038 before T039 & T042; T041 independent; T043 after T027; T044 after T038; T045–T046 after renewal & sign-out implemented.
- Polish: Many tasks parallel except those touching same files (e.g., T048 and any concurrent logger refactor must coordinate).

## Parallel Execution Examples

User Story 1 (initial test sprint):
- Run in parallel: T013, T014, T015 (three separate test file edits)
- Then implement in parallel: T016, T018, T020

User Story 2 (post-foundation):
- Parallel tests: T023, T024, T025, T026
- Parallel impl (after T027): T028, T030, T032

User Story 3:
- Parallel tests: T034, T035, T036, T037
- Parallel impl cluster: (T039, T041, T043, T044) after T038 baseline renewal logic done

## Implementation Strategy

### MVP Scope
Deliver Phases 1–3 (through US1). Provides functional sign-in/token acceptance enabling authenticated baseline.

### Incremental Delivery
1. MVP (US1) merge once independent tests pass.
2. Add US2 for server session binding & metrics.
3. Add US3 for renewal and sign-out resilience.
4. Polish phase to validate success criteria (SC-001..SC-006).

### Risk Mitigation
- Early implement T007/T027 to de-risk skew/claim logic.
- Maintain feature flags (auth auto-enabled only when env vars present) to avoid blocking dev environments.

## Task Counts
- Total Tasks: 54 + 14 remediation = 68
- Per Story: US1 = 10 (T013–T022), US2 = 11 (T023–T033), US3 = 16 (T034–T046)
- Setup + Foundational + Polish: 17
- Remediation: 14 (T055–T068)
- Parallelizable (marked [P]): 34 + remediation (most remediation tasks P except where sequencing implied)

## Independent Test Criteria Recap
- US1: Acquire token & server accepts join with token; cancellation path leaves unauthenticated state.
- US2: Join success w/ valid token; failure no/invalid token; roles extracted; validation logs & metrics.
- US3: Renewal before expiry seamless; failure prompts reauth; sign-out clears state & invalidates join until new sign-in.

## Notes
- Protocol version change only if adding new required field or altering semantics; currently optional token usage does not mandate bump (verify during T053).
- Avoid leaking raw cryptographic error details to client (FR-005). Ensure standardized code prefix `AUTH_REQUIRED` maintained.
- Metrics adapter tasks assume placeholder instrumentation pattern; refine after initial counters verified.
