# Quickstart: Wire Up Authentication

## Prerequisites
- Environment variables set in `apps/web` and `apps/server`:
  - `VITE_MSAL_CLIENT_ID`
  - `VITE_MSAL_AUTHORITY` (issuer/tenant authority URL)
  - `VITE_MSAL_REDIRECT_URI` (optional; defaults to origin)
  - `VITE_MSAL_SCOPES` (optional comma list; defaults to `openid,profile`)
  - Server: `MSAL_CLIENT_ID`, `MSAL_AUTHORITY`, `MSAL_JWKS_URI`

## Install & Run
1. `pnpm install`
2. `pnpm dev` (starts web + server concurrently)
3. Navigate to web app; click Sign In.

## Sign-In Flow
1. User clicks Sign In (redirect-based flow).
2. Provider authenticates user and redirects back.
3. `useAuth` hook processes redirect result, sets active account, acquires token silently.
4. Client uses token when establishing backend join.

## Renewal
- Silent renewal attempted automatically when <5 minutes token lifetime remain (background or on-demand before join).

## Sign Out
- Invokes provider logout (popup/redirect as implemented) and clears local state; subsequent joins require reauth.

## Testing
- Unit tests in `apps/web/tests/unit/authHook.test.ts` cover popup sign-in & silent acquisition.
- Add integration test for redirect: simulate `handleRedirectPromise` returning a result.
- Server integration tests: ensure join rejects without token when auth enabled, accepts with valid token.

## Extending Roles
- Add claim parsing in `useAuth` and server join mapping to include `moderator` when present.

## Troubleshooting
- "Authentication is disabled": Ensure env variables populated; check `isMsalConfigured` true.
- Token rejected: Confirm JWKS URI reachable and authority/audience match.
- Silent renewal fails repeatedly: Check clock skew and network connectivity.
