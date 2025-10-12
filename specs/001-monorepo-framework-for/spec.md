# Feature Specification: Monorepo Framework for Web MMORPG Backend & Frontend

**Feature Branch**: `001-monorepo-framework-for`  
**Created**: 2025-10-10  
**Status**: Draft  
**Input**: User description: "Monorepo framework for backend (Colyseus-based authoritative server with OAuth confidential client) and frontend (Vite SPA) for web MMORPG including shared packages and base folder structure."

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Spin Up Core Game Stack (Priority: P1)

As a game developer, I can clone the repository, install dependencies, and start both the authoritative game server and the web client with a single command so that I obtain a working end‑to‑end playground showing lobby connection and a placeholder world within minutes.

**Why this priority**: Without a fast baseline environment, no other feature work or iteration is efficient; this delivers immediate tangible value and validates repo structure.

**Independent Test**: Fresh clone + documented install + single start command produces: (a) server process listening on expected port, (b) web client reachable in browser, (c) client establishes a session handshake and receives a heartbeat within 5 seconds.

**Acceptance Scenarios**:

1. **Given** a clean machine with required runtime versions installed, **When** the developer runs the bootstrap script, **Then** both server and web client start and display a placeholder "Connected to game world" message.
2. **Given** the stack is running, **When** the developer stops the single orchestrating process, **Then** both server and client processes terminate cleanly with no orphan processes.

---

### User Story 2 - Shared Protocol & Types Package (Priority: P2)

As a developer, I can edit shared message / schema / type definitions in one shared workspace package and have both server and client consume them via a single versioned import so that protocol drift is prevented.

**Why this priority**: Ensures consistency of game state messages and reduces integration defects; accelerates feature delivery.

**Independent Test**: Modify a shared message schema (e.g., add a field) and observe type availability and build success in both server and client without manual duplication.

**Acceptance Scenarios**:

1. **Given** a new field added to a shared entity definition, **When** server & client builds run, **Then** both compile referencing the new field and a generated placeholder appears in the client debug view.
2. **Given** a client compiled against protocol version N, **When** the shared package increments to N+1 with a breaking message schema change and the client is not rebuilt, **Then** the startup/watch process MUST surface a clear incompatibility warning indicating required rebuild (failure scenario).

---

### User Story 3 - Authentication & Secure Session Bootstrap (Priority: P3)

As a player (via the browser client), I can authenticate through a standards‑based authorization flow so that my game session is tied to an identity, and the server only accepts authenticated session joins.

**Why this priority**: Security & account continuity; required before any persistence of progress or social features.

**Independent Test**: Attempt unauthenticated join (rejected) vs authenticated join (accepted) using documented flow; session token expiry triggers silent renewal or reauthentication flow.

**Acceptance Scenarios**:

1. **Given** the client is unauthenticated, **When** it requests to join a game room, **Then** the request is rejected with an authentication required response.
2. **Given** the client completed the authorization flow, **When** it requests to join a room, **Then** the server validates the token and issues a session, logging the player as connected.
3. **Given** an access token is expired, **When** the client attempts a privileged action, **Then** it triggers a renewal flow without losing current UI context.

---

Additional user stories (e.g., persistence scaffold, CI integration) will be addressed in future features once the framework baseline is accepted.

### Edge Cases

- Missing or unsupported runtime version when bootstrap command runs (should yield clear guidance output).
- Port already in use for server or client dev port (auto increment or descriptive failure message).
- Shared package change without rebuild (watch mode must propagate or indicate stale build).
- Simultaneous edits causing circular dependency between shared packages (detected and reported early).
- Auth token expires mid‑gameplay (graceful pause + renewal attempt, not silent desync).
- Network interruption during session (client retries connection with backoff; server cleans up stale session after timeout).
- Multiple tab sessions for same player identity (default: ALLOW concurrent tabs; future feature may restrict with session handoff).

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: The repository MUST provide a top-level README describing workspace layout and bootstrap steps.
- **FR-002**: A single bootstrap command MUST install all workspace dependencies and verify required tool versions (fail fast with guidance if unmet).
- **FR-003**: A single dev command MUST concurrently start the authoritative game server process and the web client dev server, handling graceful shutdown on interrupt.
- **FR-004**: Shared code (protocol schemas, data transfer structures, constants, validation logic) MUST reside in one or more dedicated workspace packages consumed by both server and client via local workspace references.
- **FR-005**: A version bump or change in a shared package MUST propagate to dependents without manual path updates (workspace linking / dependency graph in place).
- **FR-006**: The framework MUST enforce that only authenticated clients can join a game session; unauthenticated attempts are rejected with a structured error.
- **FR-007**: The repository MUST include environment configuration templates (e.g., sample env file) segregating secrets from committed code.
- **FR-008**: Once a client is authenticated the system MUST establish an authenticated session-level subscription to a minimal "world" / lobby event stream (global placeholder world state broadcast) that is conceptually distinct from any future gameplay / shard / instance rooms the player may join. A temporary unauthenticated placeholder broadcast is permitted only during pre-auth baseline development (US1/US2) and MUST be gated behind authentication once FR-006 is delivered.
- **FR-009**: The framework MUST include basic health/status endpoints or checks to confirm server readiness.
- **FR-010**: The system MUST log session lifecycle events (connect, authenticate, join, disconnect) in a structured, parseable format.
- **FR-011**: The framework MUST define validation rules for incoming client commands (shape, rate limit placeholder) to prevent malformed or excessive inputs.
- **FR-012**: The build system MUST support watch mode so editing shared packages reflects in both server and client without manual rebuild commands.
- **FR-013**: The framework MUST include a consistent naming convention & directory structure (e.g., /apps, /packages) documented in the README.
- **FR-014**: The system MUST support environment-based configuration (dev vs future prod) without code changes (config injection at runtime or build time).
- **FR-015**: A placeholder test suite MUST validate at least: (a) shared message schema export, (b) server start script returns success, (c) auth guard rejects unauthenticated join.
- **FR-016**: The framework MUST define a mechanism for versioning protocol changes (e.g., increment protocol version constant & backward compatibility placeholder notes).
- **FR-017**: The system MUST capture metrics counters for session connect/disconnect (abstract metric interface, no vendor specifics in spec).
- **FR-018**: The framework MUST document contribution guidelines (formatting, commit message guide) to reduce friction for new contributors.
- **FR-019**: The framework MUST handle multi‑tab or multi‑session attempts per identity according to a defined policy (default for baseline: ALLOW concurrent tabs, each treated as distinct PlayerSession sharing identity).
- **FR-020**: The authentication flow MUST use an OAuth 2.0 Authorization Code Grant with PKCE where the browser (public client) directly obtains access & refresh (if provided) tokens; the server validates presented access tokens on join without storing long-lived secrets.
- **FR-021**: The framework MUST support a documented baseline target of 100 concurrent active player sessions locally (simulated) without exceeding success criteria thresholds.
- **FR-022**: Persistence is explicitly deferred in the baseline; the framework MUST expose clearly documented extension points (interfaces / placeholders) for future persistence integration without impacting existing session logic.

All initial clarification topics have been resolved (grant strategy chosen, concurrency target set, persistence deferred decision recorded).

### Key Entities

- **PlayerIdentity**: Abstract representation of an authenticated user; attributes: playerId, displayName (optional), authClaims (scoped set), sessionPolicy.
- **PlayerSession**: A live connection instance tied to PlayerIdentity; attributes: sessionId, playerId, connectionState, lastHeartbeatAt.
- **GameRoom**: Logical channel for broadcasting authoritative state snapshots; attributes: roomId, playerIds[], protocolVersion, stateSummary.
- **ProtocolMessage**: Structured envelope for client<->server communication; attributes: type, timestamp, payload, schemaVersion.
- **AuthToken**: Opaque credential representing delegated authorization; attributes: subjectId, issuedAt, expiresAt, scopes.
- **SharedConstants**: Non-sensitive enumerations or version constants used across server & client.
- **MetricsEvent**: Abstract record for observability counters (name, dimensions, value, timestamp).

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: New developer can achieve a running local stack (server + client connected) in under 10 minutes following README (time-to-first-playable).
- **SC-002**: Shared protocol change propagates to both server and client builds in under 15 seconds during watch mode.
- **SC-003**: Unauthenticated join attempts are 100% rejected; authenticated attempts succeed > 95% under baseline load.
- **SC-004**: Session lifecycle events (connect/auth/join/disconnect) appear in structured logs with < 2 second latency from occurrence.
- **SC-005**: Bootstrap command fails fast (under 5 seconds) when a required runtime version is missing, with clear instructions.
- **SC-006**: Framework supports 100 concurrent active player sessions with < 5% session drop rate during a 10‑minute soak test.
- **SC-007**: At least 5 core functional tests (FR-015 subset) pass on initial CI run.

## Authoritative State & Determinism (Constitution P1 & P3)

- Authoritative state created: PlayerSession registry, GameRoom state snapshot, ProtocolMessage routing.
- Client inputs accepted: connect request (validated identity), join room request (valid room + auth), heartbeat ping (rate-limited), placeholder action command (schema validated, no side effects yet).
- Determinism considerations: Initial placeholder world state static; randomization deferred; protocol versioning scaffolds deterministic replay later.
- Replay harness updates needed: NO (baseline does not introduce gameplay logic requiring replay). Future feature will add harness when state mutations exist.

## Observability & Performance (Constitution P4)

- New structured log events: session.connect, session.auth.success, session.auth.failure, session.join, session.leave, session.error.
- Metrics: counter: sessions_active, counter: sessions_total, counter: auth_failures, gauge: rooms_active, counter: messages_inbound, counter: messages_rejected.
- Tick budget impact: < 5% of per-tick budget consumed by session bookkeeping at baseline concurrency (estimate; refine after clarification).
- Load test requirement: YES – run soak test at clarified baseline concurrency for 10 minutes logging drop rate & latency distribution.

## Security & Fair Play (Constitution P5)

- Input validation: Schema-based validation for all client messages (shape & max sizes). Rate limiting placeholder for heartbeat & joins.
- Anti-cheat: None yet (no gameplay actions). Framework sets hook points for future anomaly detection.
- Data integrity / migration: No persistence if clarification decides to defer; if included, migration notes will define initialization script only.
- PII considerations: NO persistent PII stored in baseline; transient identity claims processed in memory only.

## Assumptions

- Real-time session library and front-end build tooling are implementation details and not mandated by this spec (technology-neutral wording despite initial request).
- Default multi-tab policy will ALLOW multiple concurrent sessions unless clarified otherwise.
- Persistence likely deferred to later (subject to clarification); current spec assumes in-memory only.
- Baseline concurrency guess (if not clarified) would default to 100 simultaneous active player sessions for initial performance targets.

## Clarifications (Resolved)

1. OAuth strategy: Authorization Code + PKCE (public SPA obtains tokens directly; server validates access tokens).
2. Baseline concurrency: 100 concurrent active player sessions (used in FR-021 & SC-006).
3. Persistence: Deferred; extension points only (no storage layer in baseline).
4. FR-008 Scope: World/lobby broadcast is an authenticated session channel separate from gameplay rooms; early unauth broadcast allowed solely for fast baseline prior to authentication completion.

## Out of Scope (Explicitly)

- Gameplay mechanics, combat, inventory, chat.
- Production deployment configuration, scaling automation, CDN configuration.
- Payment / monetization systems.
- Analytics pipeline integration.

## Risks

- Over-engineering early (mitigated by minimal baseline definition).
- Auth complexity delaying baseline if strategy undecided (mitigate by quick clarification decision).
- Shared package version drift (handled via workspace linking & watch build).

## Success Validation Approach

Manual developer onboarding test + automated minimal CI workflow verifying FR-015 tests and lint; simple load script exercising concurrent session connects to reach baseline target once clarified.
