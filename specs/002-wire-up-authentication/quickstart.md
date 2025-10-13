# Quickstart: Wire Up Authentication

## Prerequisites
- Copy the provided `.env.example` files in `apps/web` and `apps/server`, then populate the values described in [docs/auth-config.md](../../docs/auth-config.md).
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
1. User clicks **Sign in (redirect)**. This triggers the primary redirect flow using MSAL.
2. Provider authenticates the user and redirects back to the SPA.
3. `useAuth` processes the redirect result, sets the active account, and acquires a token silently.
4. If redirect is blocked or when running tests, use the **Use popup fallback** button instead. The popup path reuses MSAL&apos;s `loginPopup` and surfaces the same authenticated state.
5. If the user cancels the sign-in dialog, the UI reports a non-intrusive “Sign-in cancelled” status and remains unauthenticated until the user retries.

## Renewal
- Silent renewal automatically begins once the remaining token lifetime drops below **5 minutes**.
- The client schedules the next renewal immediately after each successful acquisition.
- Failures trigger exponential backoff (starting at 60 seconds, doubling up to 5 minutes) while the token is still within the renewal window.
- If the window is exceeded or the provider requests interaction, the hook transitions to `unauthenticated` so the UI can prompt for manual reauth.

| Scenario | What happens | Recommended action |
|----------|--------------|--------------------|
| Temporary network failure | Renewal retries using exponential backoff without user interruption. | Wait for automatic retry; verify connectivity if retries exceed a few minutes. |
| Provider outage or interactive requirement | MSAL raises an interaction-required error; `useAuth` surfaces `unauthenticated`. | Show a re-authentication prompt (e.g., redirect sign-in button) and guide the user to retry once the provider recovers. |
| Long-lived play session (>1h) | Renewals continue transparently every time the remaining lifetime crosses the 5-minute threshold. | No action required; monitor renewal logs/metrics if diagnosing issues. |
| Testing with mocked tokens | Timers can be advanced with fake timers (see unit tests) to simulate multiple renewals rapidly. | Use the provided Vitest suites as a template for additional scenarios. |

## Sign Out
- Invokes provider logout (popup-based in the current implementation), clears local session state, and broadcasts a sign-out sentinel via `localStorage` so other open tabs return to the unauthenticated state.
- Subsequent joins require a fresh sign-in; ensure UI reflects the unauthenticated status promptly after sign-out.

## Testing
- Unit tests in `apps/web/tests/unit/authHook.test.ts` cover popup sign-in & silent acquisition.
- Add integration test for redirect: simulate `handleRedirectPromise` returning a result.
- Server integration tests: ensure join rejects without token when auth enabled, accepts with valid token.

## Extending Roles
- Add claim parsing in `useAuth` and server join mapping to include `moderator` when present.

## Troubleshooting

| Symptom | Likely cause | Suggested fix |
|---------|--------------|---------------|
| "Authentication is disabled" banner | Missing or misconfigured MSAL environment variables. | Verify `.env` values match Azure Entra app registration; restart `pnpm dev` after changes. |
| Token rejected on join | Audience/issuer mismatch or JWKS endpoint unavailable. | Confirm `MSAL_CLIENT_ID`, `MSAL_AUTHORITY`, and `MSAL_JWKS_URI`; check server logs for `auth.token.validation.failure`. |
| Silent renewal keeps warning about failures | Network instability or throttling is delaying token acquisition. | Allow backoff retries to proceed; if it persists beyond the expiry window, prompt the user to sign in again. |
| Redirect loop when signing in | Redirect URI misconfigured between app and Azure portal. | Ensure `VITE_MSAL_REDIRECT_URI` matches the registered URI; temporarily use popup login to regain access. |
| Popup blocked notice | Browser blocked the popup fallback flow. | Use the default redirect button or allow popups for the site when testing fallback mode. |
| Multi-tab sign-out not propagating | Browser prevented `localStorage` events (e.g., private mode restrictions). | Refresh other tabs or sign out directly from each tab; confirm storage access is permitted. |
