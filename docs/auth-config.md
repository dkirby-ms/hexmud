# Authentication Configuration Guide

This document summarizes the configuration required to enable external identity authentication for HexMUD. It draws from the feature plan decisions (D1–D7) in `specs/002-wire-up-authentication/plan.md`.

## Overview

- **Flow (D1):** The SPA uses the `@azure/msal-browser` redirect flow (`loginRedirect`) as the primary sign-in mechanism, with popup fallback for tests or constrained environments.
- **Renewal (D2):** Tokens are refreshed silently when less than **5 minutes** of lifetime remain. Renewal retries every 60 seconds until success or expiry.
- **Roles (D3):** Only the `moderator` role is surfaced from token claims; all other claims map to baseline "player" access.
	- During join validation the server inspects both the boolean `moderator` claim and the `roles` array for the literal `moderator`. When detected, the `moderator` capability is recorded alongside the baseline `player` role in the in-memory session identity for downstream authorization checks.
- **Tenant Policy (D4):** Any issuer that matches the configured authority is accepted. Future iterations may introduce allow/deny lists.
- **Token Validation (D5):** The server validates signatures using `jose` and a remote JWKS endpoint with rotation support.
- **Silent Acquisition (D6):** `acquireTokenSilent` drives both pre-join token acquisition and the renewal timer.
- **PII Handling (D7):** No persistent storage of tokens or personally identifiable information (PII); logs only contain minimal identifiers.

## Environment Variables

### Web Client (`apps/web`)

Define the following variables in `apps/web/.env` (see `.env.example` for a template):

| Variable | Description |
|----------|-------------|
| `VITE_MSAL_CLIENT_ID` | Azure Entra ID application (client) ID exposed to the SPA. |
| `VITE_MSAL_AUTHORITY` | Authority URL, e.g. `https://login.microsoftonline.com/<tenantId>/`. |
| `VITE_MSAL_REDIRECT_URI` | Redirect URI registered with the app. Defaults to the app origin when omitted. |
| `VITE_MSAL_SCOPES` | Comma-separated scopes requested during sign-in; defaults to `openid,profile`. |

### Server (`apps/server`)

Define the following variables in `apps/server/.env` (see `.env.example` for a template):

| Variable | Description |
|----------|-------------|
| `MSAL_CLIENT_ID` | Must match the SPA client ID. Used to validate the `aud` claim. |
| `MSAL_AUTHORITY` | Same authority URL used by the client. Validated against the token `iss`. |
| `MSAL_JWKS_URI` | JWKS endpoint exposed by the identity provider for signature validation. |

## Renewal Strategy

Silent renewal kicks in when a token has fewer than five minutes of validity remaining:

1. The client schedules checks after each successful token acquisition.
2. Once the remaining lifetime is under the threshold, `acquireTokenSilent` is invoked.
3. Failures trigger exponential backoff retries (starting at 60 seconds) until a new token is obtained or the token expires.
4. Renewal success/failure events are logged on the client and server for observability.

Administrators should ensure clocks are synchronized to keep within the permitted ±120 second skew buffer enforced on the server.

## Metrics Naming Map

Authentication observability follows a strict naming scheme so dashboards can be assembled consistently across environments. The table below links each metric to the feature requirements and success criteria.

| Metric Name | Type | Description | Requirement Alignment |
|-------------|------|-------------|-----------------------|
| `sessions_total` | Counter | Incremented whenever an authenticated session is created. | FR-006, SC-006 |
| `sessions_active` | Gauge | Snapshot of active authenticated sessions; update on join/leave. | FR-011, SC-006 |
| `auth_token_validation_total` | Counter | Total validation attempts (success + failure). | FR-004, FR-011, SC-002 |
| `auth_token_validation_failure_total` | Counter (label `reason`) | Token validations rejected by the server (expired, signature, nbfSkew, claimMissing, revoked, other). | FR-004, FR-011, SC-002 |
| `auth_signin_success_total` | Counter | Successful sign-in completions reported by client or server. | FR-001, SC-001 |
| `auth_signin_failure_total` | Counter (label `reason`) | Sign-in attempts that fail or are cancelled. | FR-001, FR-010 |
| `auth_renewal_success_total` | Counter | Silent renewals that yield a fresh token. | FR-007, SC-003 |
| `auth_renewal_failure_total` | Counter (label `reason`) | Renewal attempts that fail (network, interactionRequired, other). | FR-007, FR-010, SC-003 |
| `auth_signin_duration_ms` | Histogram (value in ms) | Measures time from user action to authenticated state. | FR-011, SC-001 |
| `auth_renewal_latency_ms` | Histogram (value in ms) | Latency of each renewal request. | FR-011, SC-003 |
| `auth_join_latency_overhead_ms` *(reserved)* | Histogram (value in ms) | Planned metric for additional join latency vs unauth baseline. Name reserved for T061 instrumentation. | FR-011, SC-004 |

> **Integration note:** Client and server emitters funnel through `apps/server/src/metrics/adapter.ts`. Update this mapping if new metric helpers are added or renamed.

## Multi-Tab Sign-Out Propagation

- **Sentinel Key:** The web client writes and immediately removes a `localStorage` sentinel key (`hexmud:auth:signout`) whenever a user signs out.
- **Event Listener:** Other open tabs listen for the storage event and clear their authentication state when they detect the sentinel, ensuring a consistent logout experience without sharing token material.
- **Fallback Behaviour:** Browsers that block storage events (certain private/incognito modes) will not receive the broadcast automatically. In those cases, users should manually refresh or sign out from each tab.
- **Security Note:** No tokens or PII are persisted—only the ephemeral sentinel is used to coordinate state.

## Reference

- Feature plan: [`specs/002-wire-up-authentication/plan.md`](../specs/002-wire-up-authentication/plan.md)
- Quickstart instructions: [`specs/002-wire-up-authentication/quickstart.md`](../specs/002-wire-up-authentication/quickstart.md)
- Renewal implementation details live in `apps/web/src/hooks/useAuth.ts` and server validation lives in `apps/server/src/auth/validateToken.ts`.
