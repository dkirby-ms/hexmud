# Feature Specification: Project Framework: Backend & Frontend Scaffold with Confidential Client Auth

**Feature Branch**: `001-we-need-a`  
**Created**: 2025-10-10  
**Status**: Draft  
**Input**: User description: "We need a project framework with a shared monorepo that will support the server backend and web app frontend for a framework for a web-based MMORPG game. The framework should include the base folder structure to support both backend and frontend. The backend is a confidential client app using Colyseus.js for game and session management, protected with OAuth. The frontend is a vite-built SPA."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Initialize Unified Project Scaffold (Priority: P1)

A developer creates a new repository (or uses this one) and generates a standardized monorepo folder structure that cleanly separates backend real-time game/server logic, shared libraries (game state schemas, DTOs, validation), and web frontend assets while providing common configuration, environment handling, and documentation stubs. After scaffold generation, both backend server (including Colyseus-compatible runtime placeholder) and frontend SPA can be started independently or together without manual restructuring.

**Why this priority**: Foundational—without the scaffold no other feature (including real-time rooms or auth) can proceed efficiently; it reduces setup time and enforces consistency for a multiplayer game architecture.

**Independent Test**: Remove any existing custom code, apply the scaffold, then verify: (1) required top-level folders exist, (2) each contains placeholder README describing purpose, (3) running baseline start commands (backend dev server, frontend dev server) succeeds using only provided instructions.

**Acceptance Scenarios**:
1. **Given** an empty (or minimally initialized) repo, **When** the framework scaffolding is applied, **Then** the prescribed folder hierarchy is created with placeholder docs and configuration samples.
2. **Given** the scaffold exists, **When** a developer inspects directories, **Then** backend, frontend, shared, scripts, infra, and tests areas are clearly named and non-overlapping.

---

### User Story 2 - Implement Confidential Client Auth & Session Mediation (Priority: P2)

As a developer, I can rely on a standardized authentication abstraction where the backend acts as a confidential OAuth client (securely storing credentials/secrets) to obtain tokens and issue session context / frontend-safe session tokens so the web app never handles confidential secrets directly. Real-time game connections (Colyseus) must be bound to an authenticated session token.

**Why this priority**: Security and access control are essential but come after having the scaffold to host the logic.

**Independent Test**: Configure mock or real identity provider credentials (without altering code structure) and verify: (1) backend obtains an access token using stored secret material, (2) frontend receives only non-confidential session token (e.g., HTTP-only cookie or signed ephemeral token), (3) unauthorized HTTP or WebSocket upgrade attempts are rejected with standardized responses.

**Acceptance Scenarios**:
1. **Given** valid confidential client credentials, **When** the backend requests an access token, **Then** a token is obtained and stored transiently per lifetime rules.
2. **Given** frontend user context is not authenticated, **When** a protected REST or real-time endpoint is called, **Then** the response indicates authentication required without leaking implementation details.
3. **Given** a valid user/session token issued via backend mediation, **When** accessing a protected endpoint or joining a Colyseus room, **Then** access is granted and audit info is recorded.

---

### User Story 3 - Extendable Game Module & Feature Addition Workflow (Priority: P3)

A developer adding a new game domain module (e.g., inventory, chat, world zone, combat) can create aligned backend module (handlers/rooms/services) + matching frontend component(s)/screens + shared types/documentation using a repeatable pattern (naming, placement, test layout) within a defined time threshold without ambiguity.

**Why this priority**: Enhances long-term velocity once the scaffold and auth base exist.

**Independent Test**: Time a developer unfamiliar with the codebase creating a new module skeleton (backend room/endpoint + frontend view shell + shared schema + tests) by following CONTRIBUTING / scaffolding docs; verify completion within target time and structure compliance via checklist.

**Acceptance Scenarios**:
1. **Given** the framework docs, **When** a developer runs the prescribed module creation steps, **Then** new directories, test stubs, and doc placeholders appear in standardized locations.
2. **Given** a newly added module, **When** lint/structure validation scripts run, **Then** no structural violations are reported.

---

### Edge Cases

- Missing or malformed environment variables during startup (framework surfaces clear diagnostics and safe defaults where possible).
- Disabled or unreachable identity provider (backend degrades gracefully: deny auth-required requests, expose health warning state).
- Token acquisition failure mid-request (no sensitive error text leakage; standardized error envelope returned).
- Expired/invalid/forged frontend session token presented (rejected with consistent unauthorized response; no stack trace leakage).
- Simultaneous module creation by different developers causing naming collision (detection + guidance message).
- Frontend attempting to directly request confidential credentials (must never succeed; ensure no endpoint exposes them).
- WebSocket handshake attempted without valid session token (reject with auth error and log event).
- Room join request referencing non-existent or full room (standardized error response & metric increment).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Framework MUST provide a canonical top-level folder structure including (names may adjust for clarity): `backend/`, `frontend/` (Vite + SPA scaffold), `shared/` (cross-cutting models/utilities/game schemas), `infra/` (infrastructure & deployment descriptors), `scripts/` (automation), `tests/` (integration/e2e), `docs/` (high-level), and a root `README` referencing each area.
- **FR-002**: Framework MUST include per-area README stubs describing purpose, allowed contents, and placement rules.
- **FR-003**: Framework MUST supply environment configuration pattern (sample env file + precedence rules for local, staging, production) without embedding secrets in version control.
- **FR-004**: Framework MUST define a standardized error response model (fields: code, user-safe message, correlation id, timestamp) applied across HTTP and real-time error surfaces.
- **FR-005**: Framework MUST provide a confidential client authentication abstraction where backend securely stores and uses OAuth client credentials to obtain access tokens and mediates issuance of frontend-safe session tokens for HTTP + real-time channels.
- **FR-006**: Framework MUST strictly separate confidential material (server only) from any artifacts delivered to the frontend build pipeline.
- **FR-007**: Framework MUST log security & room lifecycle events (auth success/failure, token exchange, permission denial, room join/leave) using a structured format (key-value) with correlation / session id propagation.
- **FR-008**: Framework MUST enforce least-privilege for backend-to-external resource token scopes (only configured scopes requested).
- **FR-009**: Framework MUST include automated validation (script) verifying folder presence, naming conventions, absence of disallowed secret patterns in committed files.
- **FR-010**: Framework MUST provide a documented workflow for adding a new domain/game module covering backend handlers/rooms, shared contract/type, frontend view/container, and test placeholders.
- **FR-011**: Framework MUST supply a pluggable authorization layer implementing roles plus fine-grained named permissions (roles map to permission sets) allowing endpoints/rooms to reference role(s) or specific permission identifiers. [NEEDS CLARIFICATION: granularity of permissions vs role-only simplification MVP]
 - **FR-011**: Framework MUST supply a pluggable authorization layer starting with ROLE-ONLY model (coarse roles: e.g., `admin`, `moderator`, `player`) for MVP. Endpoints/rooms declare required role(s). Design MUST allow later introduction of named permissions without breaking existing role checks (extensibility note documented). Test: changing an endpoint required role denies prior non-role members.
- **FR-012**: Framework MUST implement a token lifecycle with medium-lived access tokens (≈60 minutes) obtained via backend confidential flow and silent server-side renewal; no refresh token exposed to frontend.
- **FR-013**: Framework MUST adopt external identity provider federation (OIDC/OAuth) for user authentication; backend mediates confidential client exchange and issues session tokens.
- **FR-014**: Framework MUST offer a mock identity provider mode for local development without real credentials.
- **FR-015**: Framework MUST document security boundaries (non-accessible areas from frontend, secret loading, rotation considerations).
- **FR-016**: Framework MUST include baseline accessibility and internationalization placeholders in the frontend (structure only).
- **FR-017**: Framework MUST provide a contribution guide (CONTRIBUTING) outlining code review expectations, naming patterns, dependency policy.
- **FR-018**: Framework MUST enable deterministic build & startup steps with single documented command each for backend and frontend.
- **FR-019**: Framework MUST define non-functional baselines: backend cold start ≤ 8s, frontend dev build ≤ 45s, steady-state backend RSS ≤ 300MB (subject to review as features accrue).
- **FR-020**: Framework MUST include baseline PostgreSQL integration scaffolding (config sample, migration tool initialization with empty initial migration, DB health endpoint) without domain persistence yet.
- **FR-021**: Framework MUST scaffold Colyseus integration (room base class template, state schema example, room registration pattern, connection authentication hook placeholder) including ONLY a single minimal "Lobby" room template (join/auth flow + basic broadcast) for MVP; docs MUST describe how to add new room types (zone/chat/etc.) without breaking existing APIs.
- **FR-022**: Framework MUST version shared game state schemas using a required semantic version field (MAJOR.MINOR.PATCH) embedded in the schema metadata; client/server handshake MUST compare versions and reject mismatches where MAJOR differs, warn (log + metric) on MINOR mismatch, and allow PATCH mismatch. A standardized rejection error MUST include expected vs received version.

### Key Entities

- **User**: End user interacting via the web frontend / game client; conceptual attributes: id, display name, roles, permissions, status.
- **Session / Frontend Token**: Authenticated user context issued by backend; contains claims permitted for frontend use (no secrets) and used for HTTP + WebSocket auth.
- **Confidential Client Credential**: Secure configuration item (client id + secret/key) stored server-side only; used to obtain external access tokens.
- **Role / Permission**: Authorization abstractions controlling access to endpoints and rooms (granularity pending clarification FR-011).
- **Room**: Real-time gameplay or social interaction space (e.g., lobby, zone) with a state schema and capacity rules.
- **Game State Schema**: Structured representation of room or entity state (shared types for serialization & validation).
- **Audit Event**: Structured security/audit log record; includes event type, principal, timestamp, correlation id, outcome.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: New developer can clone repo and run backend + frontend baseline processes successfully in under 10 minutes following only documented steps.
- **SC-002**: Adding a new game module scaffold (backend room/endpoint + frontend view + tests + docs stubs) requires ≤ 15 minutes median across 3 trial runs.
- **SC-003**: Security audit of scaffold finds 0 occurrences of committed secrets or confidential credentials.
- **SC-004**: Unauthorized request (HTTP or WebSocket) to protected endpoint/room receives standardized error response 100% of automated test cases.
- **SC-005**: Auth token acquisition success rate ≥ 99% under nominal conditions (simulated IdP latency < 500ms) with graceful fallback defined for failures.
- **SC-006**: Structured log entries for auth & room lifecycle events contain correlation/session id in 100% of sampled cases (sample ≥ 50 events).
- **SC-007**: Documentation satisfaction survey ≥ 80% “clear or very clear” after first onboarding iteration.
- **SC-008**: Baseline Colyseus room template supports < 100ms join authentication overhead (median) in local benchmark.
- **SC-009**: Shared schema version mismatch detection triggers a clear client error in 100% of simulated mismatch tests.

## Authoritative State & Determinism (Constitution P1 & P3)

- Authoritative state: conceptual user records, session/token metadata (ephemeral), role/permission definitions, room instances & state snapshots, audit event stream.
- Client inputs accepted: auth attempts, room join/leave requests, module scaffolding commands (dev only), API calls with headers/parameters—validated for bounds and type.
- Determinism: Scaffold generation deterministic; room state evolution dependent on gameplay logic (future) but state schema hashing/versioning enables reproducible test harness injection; random identifiers use centralized generator supporting seeding.
- Replay harness updates: YES – need fixtures for room join auth, token issuance simulation, and schema version mismatch tests.

## Observability & Performance (Constitution P4)

- New structured log events: AUTH_TOKEN_REQUESTED, AUTH_TOKEN_GRANTED, AUTH_TOKEN_DENIED, USER_SESSION_CREATED, USER_SESSION_EXPIRED, PERMISSION_DENIED, ROOM_CREATED, ROOM_DISPOSED, ROOM_JOIN_ATTEMPT, ROOM_JOIN_ACCEPTED, ROOM_JOIN_REJECTED, SCHEMA_VERSION_MISMATCH.
- Metrics: token_requests_total, token_request_latency, unauthorized_attempts_total, room_joins_total, room_join_rejects_total, room_active_count, schema_mismatch_total, scaffold_generation_duration, active_sessions_gauge.
- Tick budget impact (estimate): <5% baseline processing budget allocated to auth + room scaffold under low feature load.
- Load test requirement: YES – verify auth + room join flow maintains ≥ 95% success within target latency under projected concurrent join rate (clarify target concurrency after FR-021 room types decision).

## Security & Fair Play (Constitution P5)

- Input validation schemas: conceptual schemas for auth payloads, room join requests, configuration file schema, module naming pattern regex.
- Anti-cheat / anomaly placeholders: failed auth attempt threshold (brute force), duplicate session token reuse detection, rapid room rejoin flood detection placeholder.
- Data integrity / migration notes: initial scaffold creates no persistent gameplay tables; only auth & minimal user/role constructs (to be extended later). Migration strategy doc placeholder included.
- PII considerations: YES – user identifiers & display names; ensure logging excludes sensitive credential material and masks user identifiers where not essential.

## Assumptions

- Single-tenant initially; multi-tenant isolation can be layered later.
- External identity provider integration expected (industry standard) – federation chosen unless clarified otherwise.
- Secrets managed outside VCS (env vars, secret manager) – no in-repo secret storage.
- Frontend served separately from backend; shared contracts abstract duplication.
- Real-time transport via Colyseus WebSocket; fallback transports not included in MVP.

## Open Clarifications (Max 3)

Pending: None.

## Clarifications

### Session 2025-10-10

- Q: How granular should the initial permissions model be for MVP (FR-011)? → A: Role-only (admin, moderator, player)
- Q: Which initial room types should we include in the scaffold (FR-021)? → A: Single Lobby room only
- Q: How should shared game state schemas be versioned/validated between backend and frontend (FR-022)? → A: Semantic version field (MAJOR.MINOR.PATCH)

## Summary

This specification defines a foundational monorepo project framework enabling consistent, secure, and extensible development for both backend (real-time + HTTP) and frontend (Vite SPA), centered on a confidential OAuth client authentication model and Colyseus-based room scaffolding. Three critical decisions remain (permissions granularity, initial room types to scaffold, and schema versioning method) which will materially influence authorization strategy, onboarding experience, and compatibility validation.
