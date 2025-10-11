# Feature Specification: Wire Up Authentication (External Identity Provider)

**Feature Branch**: `002-wire-up-authentication`  
**Created**: 2025-10-11  
**Status**: Draft  
**Input**: User description: "Wire up authentication with Entra ID external identities so that the web frontend can get a token and auth to the backend"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign In & Receive Token (Priority: P1)

A prospective player visits the web client, chooses to sign in, completes an external identity provider flow, and is returned to the application with an identity token that enables establishing an authenticated game/session connection.

**Why this priority**: No authenticated gameplay or personalized experience can occur without the foundational ability to sign in and obtain a validated identity token.

**Independent Test**: Can be fully tested by performing a fresh browser session, completing sign‑in, and verifying a token is present, structurally valid, and accepted by backend join endpoint—demonstrating core value (secure identity).

**Acceptance Scenarios**:

1. **Given** a user not signed in, **When** they click "Sign In" and complete the provider flow successfully, **Then** the app stores a valid (unexpired) token and displays authenticated state indicators.
2. **Given** a user cancels provider consent midway, **When** control returns, **Then** the app shows a non-intrusive message and remains in unauthenticated state.
3. **Given** clock skew within acceptable tolerance, **When** token `nbf` is slightly in future (<= allowed skew), **Then** token is still accepted.

### User Story 2 - Establish Authenticated Game Session (Priority: P2)

An already signed‑in user connects (e.g., opens lobby/game room connection) and the backend verifies the presented token before creating a server-side session referencing the user identity and claims.

**Why this priority**: Builds on sign‑in to enable secure participation; without validated backend session the identity token has no gameplay effect.

**Independent Test**: Can be tested by invoking join/connect endpoint with and without a token; success path yields an authenticated session record, failure path returns standard unauthorized response codes/messages.

**Acceptance Scenarios**:

1. **Given** a valid unexpired token, **When** the client initiates a join/connect, **Then** backend creates session with associated user identifier and returns success.
2. **Given** a missing token, **When** a join/connect is attempted, **Then** backend rejects with unauthorized and no session is created.
3. **Given** a token failing signature or claim validation, **When** join/connect is attempted, **Then** backend rejects with unauthorized and logs a security event.

### User Story 3 - Seamless Token Renewal & Sign Out (Priority: P3)

An authenticated user remains active; the system renews/refreshes identity before expiry without interrupting play, and the user can explicitly sign out which clears identity and invalidates local session context.

**Why this priority**: Ensures sustained gameplay sessions and proper termination while minimizing friction; critical for longer play periods and security hygiene.

**Independent Test**: Simulate approaching token expiry; verify renewal occurs without user interaction and subsequent backend calls remain authorized; test sign‑out leaves no residual auth state.

**Acceptance Scenarios**:

1. **Given** a token within a defined pre-expiry window, **When** the user remains active, **Then** the system initiates a silent renewal producing a new unexpired token before the old one lapses.
2. **Given** a user chooses sign out, **When** action confirmed, **Then** local tokens/claims are purged and subsequent protected actions fail until re-authenticated.
3. **Given** renewal fails (e.g., network), **When** fallback attempts complete, **Then** user is prompted to re-authenticate with clear guidance.

### Edge Cases

- Token expires mid real‑time session: server detects on next authenticated action and returns standardized expiry code; client attempts silent renewal then reconnect.
- Token not yet valid (not-before) due to clock skew: allow configured skew (e.g., <= 2 minutes) else reject.
- User opens multiple tabs: all tabs share latest valid token; sign‑out in one propagates to others (on next activity tick) via storage event.
- Identity provider unreachable during sign‑in: present retry guidance without losing current app state.
- Revoked / disabled account: token structurally valid but backend claim check fails and returns unauthorized with reason code.
- Tampered token (signature invalid): rejected; security event logged; no information leak beyond generic unauthorized.
- Missing essential claim (e.g., unique user id): reject and log validation error.
- JWKS / key set rotation timing: temporarily cache previous key set to accept overlapping signing keys (deterministic selection).
- Network drop during renewal: queued renewal retries with exponential backoff until grace window exceeded.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a user to initiate an external identity sign‑in flow and, upon success, obtain an identity token containing at minimum a stable unique user identifier claim.
- **FR-002**: The system MUST provide clear user interface affordances to sign in and sign out (visible in unauth/auth states respectively).
- **FR-003**: The web client MUST attach the current valid identity token to all protected backend connection / join attempts.
- **FR-004**: The backend MUST cryptographically validate each provided token (signature, expiration, not-before within allowable skew, issuer, audience, required claims) before creating an authenticated session.
- **FR-005**: The backend MUST reject any request lacking a valid token with a standardized unauthorized response (code + human-readable reason class) without revealing sensitive validation details.
- **FR-006**: The system MUST establish a server-side session structure linking the validated user identifier and any authorization claims for later gameplay authorization decisions.
- **FR-007**: The system MUST renew/refresh identity before expiry without interrupting active sessions: begin silent renewal when < 5 minutes remain before token expiry and retry every 60 seconds until success or expiry.
- **FR-008**: The system MUST define and enforce a minimal authorization model consisting of a baseline "player" identity plus an optional "moderator" flag for elevated moderation capabilities.
- **FR-009**: The system MUST accept any external identity issued by the configured external identity provider (open policy) without tenant/domain restriction in this iteration; future tightening may introduce allow/deny lists.
- **FR-010**: The system MUST log security-relevant events: sign‑in success, sign‑in failure (categorized), token validation failure (reason class), sign‑out, token renewal outcome.
- **FR-011**: The system MUST expose metrics for: active authenticated sessions, token validation failures (by reason), average success sign‑in latency, renewal success rate.
- **FR-012**: The system MUST gracefully handle identity provider unavailability (retry with backoff; user feedback without freezing UI).
- **FR-013**: The system MUST ensure sign‑out clears local auth artifacts so subsequent protected actions fail until re-authenticated.
- **FR-014**: The system MUST prevent replay of expired tokens (no grace beyond configured skew) and reject tokens with altered critical claims (detected via signature mismatch).
- **FR-015**: The system MUST avoid storing long-term sensitive secrets in the client; only volatile tokens and minimal claim metadata.

### Key Entities *(include if feature involves data)*

- **User Identity**: Conceptual representation of a unique player (stable identifier, display name claim (optional), email (if present), roles/claims set).
- **Auth Token (Identity Assertion)**: Time-bound credential containing subject identifier, issuer, audience, temporal claims, and optional role/tenant claims.
- **Session**: Server-side record binding a connected client to a validated user identity, creation timestamp, last activity, and authorization context snapshot.
- **Authorization Claim / Role**: Named capability markers influencing feature access (e.g., moderator). Exact taxonomy pending clarification.
- **Tenant Policy**: Configuration describing accepted issuer domains / tenant identifiers and rejection behavior.

### Assumptions & Dependencies

- External identity provider is reliable and standards-based (supports modern web-based user authentication with signed tokens).
- Reasonable default idle timeout assumed at 30 minutes of inactivity unless clarified.
- Acceptable clock skew default assumed at ≤ 120 seconds.
- No offline mode required for this iteration.
- Gameplay authorization beyond base authentication limited to placeholder distinctions until role model clarified.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of first-time sign‑in attempts complete (user clicks Sign In to authenticated UI state) in under 8 seconds.
- **SC-002**: < 0.5% of overall token validations (excluding deliberate negative tests) result in validation failure due to system error.
- **SC-003**: 99% of active authenticated sessions sustain continuous authorization across token renewals without user-visible prompts during a 60‑minute active period.
- **SC-004**: Median additional latency added to join/connect by authentication < 100 ms and does not increase median join/connect latency by more than 5% versus unauthenticated baseline.
- **SC-005**: 100% of rejected authentication attempts are accompanied by a security log event containing a correlation identifier.
- **SC-006**: Support at least 500 concurrent authenticated sessions without exceeding target latency objective (SC-004).

## Authoritative State & Determinism (Constitution P1 & P3)

- Authoritative state touched/created: Session records (authenticated metadata), possibly room membership annotated with user identifier.
- Client inputs accepted: Auth token (opaque string) presented during connect/join; must satisfy: non-empty, structurally valid (format), cryptographic verification, required claims present.
- Determinism considerations: Authentication itself is deterministic given token & key set; key rotation strategy must ensure overlapping acceptance window to avoid nondeterministic failures.
- Replay harness updates needed: YES – harness must support injecting a deterministic valid token and simulation of invalid tokens for negative replay scenarios.

## Observability & Performance (Constitution P4)

- New structured log events: auth.signin.success, auth.signin.failure (reason), auth.token.validate.failure (reason, claimMissing|signature|expired|tenantPolicy), auth.token.validate.success, auth.renewal.success, auth.renewal.failure (reason), auth.signout
- Metrics: counter.auth.signin.success, counter.auth.signin.failure (labels reason), counter.auth.token.validation.failure (labels reason), gauge.auth.sessions.active, histogram.auth.signin.duration, histogram.auth.renewal.latency, counter.auth.renewal.failure
- Tick budget impact: Estimated < 3% at 500 concurrent sessions (signature/claim checks + bookkeeping).
- Load test requirement: YES – run focused scenario: 500 concurrent sign‑ins followed by sustained renewal cycle to validate SC-004 & SC-006.

## Security & Fair Play (Constitution P5)

- Input validation schemas: Token structural validation + existing message validation pipeline (no change to payload schemas apart from adding auth requirement to join/connect message envelope).
- Anti-cheat / anomaly rules: Adds detection surface for repeated invalid token attempts; may integrate with rate limiting.
- Data integrity / migration notes: No persistent storage introduced; session structure extended in-memory only.
- PII considerations: YES – email / display name may appear in claims; only minimally retained in transient session memory; not logged except hashed or truncated if needed for correlation (implementation detail deferred to design phase).

---

## Decisions Incorporated

- Renewal strategy: <5 minute remaining window triggers silent renewal; retry cadence 60s until refreshed or token expires.
- Authorization model: Minimal (player + moderator flag) for initial scope; extensibility deferred.
- Tenant policy: Open acceptance of all provider-issued identities for early adoption; monitoring via logs for potential abuse; future iterations may impose restrictions.
