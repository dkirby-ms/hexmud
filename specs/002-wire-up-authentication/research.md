# Research & Decisions: Wire Up Authentication

## Overview
Consolidates resolution of technical unknowns and records rationale for key decisions supporting implementation.

## Decisions

### D1: Sign-In Flow Mechanism
- Decision: Primary sign-in uses redirect flow (`loginRedirect`) with popup fallback for explicit user-triggered reauth in constrained contexts (tests / blockers).
- Rationale: Redirect flow more broadly compatible with third-party cookie restrictions and aligns with standard SPA auth patterns; popup retained for existing tests.
- Alternatives Considered:
  - Popup-only: Simpler tests but higher chance of browser popup blocking & UX friction.
  - Embedded iframe silent prompt: Limited by modern browser restrictions & CSP.

### D2: Renewal Strategy
- Decision: Start silent token renewal when <5 minutes remain before expiry; retry every 60s until success or expiry.
- Rationale: Simple deterministic window; balances network utilization and ensures ≥5 minute safety margin.
- Alternatives: 50%/80% lifetime checkpoints (more complexity), adaptive sliding window (higher implementation cost).

### D3: Authorization Model
- Decision: Minimal roles (player + moderator flag) surfaced via claims if present.
- Rationale: Avoid premature complexity while enabling early moderated experiences.
- Alternatives: Multi-tier roles (player/premium/moderator/admin); granular capability claims matrix.

### D4: Tenant Acceptance Policy
- Decision: Open acceptance (any provider-issued identity) for initial iteration.
- Rationale: Reduces onboarding friction; future allowlist can be layered without refactoring core path.
- Alternatives: Strict allowlist (higher initial config overhead); hybrid warn-only mode.

### D5: Token Validation Implementation
- Decision: Continue using `jose` with remote JWK set caching; ensure overlapping key rotation acceptance.
- Rationale: Already implemented; stable, standards-based, supports rotation.
- Alternatives: Custom signature validation (reinventing crypto), library switch (unnecessary churn).

### D6: Renewal Trigger Implementation
- Decision: Leverage `acquireTokenSilent` before join/connect attempts and background timer when active.
- Rationale: Reuses MSAL internal cache heuristics; minimal bespoke scheduling.
- Alternatives: Manual refresh token flow (complex; not needed with library support).

### D7: Storage & PII Handling
- Decision: No new persistence; session remains transient. PII (email, display name) not logged in clear form; only hashed/truncated if correlation needed.
- Rationale: Minimizes compliance surface early; aligns with principle 5.
- Alternatives: Persist profile metadata early (adds migration footprint prematurely).

## Open Risks
- R1: Open tenant policy increases potential for spam / abuse → Mitigation: monitor auth.token.invalid & rate limit join attempts.
- R2: Renewal failures near expiry may force re-auth disruption → Mitigation: <5 minute window gives multi-attempt slack.
- R3: Popup fallback test divergence from production redirect → Mitigation: Add integration test for redirect simulation using mocked handlers.

## Non-Goals
- Full role-based access control UI surfaces.
- Central account/profile persistence.
- Cross-tab broadcast channel token synchronization (deferred; localStorage events acceptable baseline).

## References
- Constitution P5 security clauses (token validation & minimal PII).
- Feature spec success criteria SC-001..SC-006.

## Summary
All prior clarifications resolved. No remaining NEEDS CLARIFICATION markers. Proceed to Phase 1 design artifacts.

### Load Test Snapshot (T047)
- Scenario: 500 concurrent placeholder-room joins, 1 iteration, 1s session hold, 500ms heartbeat delay.
- Environment: Local Linux host, server launched with MSAL auth disabled (env vars cleared) to focus on transport throughput.
- Results: 500 / 500 successful sessions, join latency p50 599ms, p95 622ms, average 583ms. No failures observed.
- Notes: `colyseus.js` emitted repeated `onMessage()` warnings because the placeholder client does not register an envelope handler yet; these log lines are benign for this scenario.
