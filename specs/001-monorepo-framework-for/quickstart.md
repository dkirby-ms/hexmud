# Quickstart: Monorepo Framework Baseline

## Prerequisites
- Node.js >= 22.x (LTS) (`node -v`)
- pnpm >= 9 (`corepack enable` or `npm i -g pnpm`)
- Modern browser
- (Optional) Azure Entra ID application registration (client ID, tenant ID, redirect URI)

## Repository Bootstrap

From the repo root run the workspace installer script (it wraps `pnpm install` and validates tool versions):

```
pnpm run bootstrap
```

This command populates `node_modules/` for every workspace (`apps/server`, `apps/web`, `packages/protocol`) and primes TypeScript project references.

## Development Workflow

Start the full stack with hot-reload watchers:

```
pnpm run dev
```

What happens:

- `apps/server` runs via `tsx` on port `2567` and registers the `placeholder` Colyseus room.
- `apps/web` launches the Vite dev server on port `5173` and proxies game traffic to the server.
- Logs appear inline so you can watch join/leave events.

Visit `http://localhost:5173` if the browser tab does not auto-open. Successful US1 handshake is indicated by the status banner showing your session id and heartbeats updating every 5 seconds.

Stop the processes with a single `Ctrl+C`. The server performs a graceful shutdown, disposes rooms, and frees the port.

## Authentication Setup
Create `.env` at repo root (never commit secrets):
```
MSAL_CLIENT_ID=00000000-0000-0000-0000-000000000000
MSAL_TENANT_ID=your-tenant-id
MSAL_AUTHORITY=https://login.microsoftonline.com/${MSAL_TENANT_ID}
MSAL_JWKS_URI=https://login.microsoftonline.com/${MSAL_TENANT_ID}/discovery/v2.0/keys # optional override
MSAL_REDIRECT_URI=http://localhost:5173
```
Frontend loads config from env (Vite prefixes `VITE_` if exposed):
```
VITE_MSAL_CLIENT_ID=
VITE_MSAL_AUTHORITY=
VITE_MSAL_REDIRECT_URI=
VITE_MSAL_SCOPES=openid,profile
```

## Shared Protocol Changes
Edit files in `packages/protocol/src` (messages, constants). Running `pnpm run dev` keeps both server and web watchers active so changes propagate instantly (HMR + tsx reload).

When introducing breaking protocol changes, bump the version using the helper script:

```
pnpm run bump:protocol <next-version>
```

The script updates `packages/protocol/src/version.ts` and prepends a changelog entry. Restart any running dev processes so the new version is loaded everywhere. Mismatched clients will receive a `VERSION_MISMATCH` error during join attempts.

## Testing

Run all Vitest projects (protocol, server, web) at once:

```
pnpm run test
```

For focused development you can run tests in a specific workspace, e.g. `pnpm --filter @hexmud/server test`. The current MVP suite validates protocol watch propagation, server health, room join flow, and the web connection status contract.

## Adding a New Message Type
1. Define zod schema in `packages/protocol/src/messages/<name>.ts`
2. Export its TypeScript type
3. Add dispatcher handler in `apps/server/src/handlers` mapping message `type`
4. Client: consume from `packages/protocol` exports

## Lint & Format

```
pnpm run lint
pnpm run format
```

Formatting uses Prettier defaults; linting is eslint with type-aware rules.

## Graceful Shutdown

Terminate the dev orchestrator with `Ctrl+C`. The server log will emit `room.placeholder.disposed` once the Colyseus room shuts down, confirming resources were released.

## Future Extensions (Not in Baseline)
- Persistence adapters (postgres) in `packages/persistence`
- Metrics adapter (Prometheus / OpenTelemetry)
- Replay harness when simulation logic added

## Troubleshooting

| Issue | Cause | Resolution |
|-------|-------|------------|
| Version mismatch error | Client or server running against stale `PROTOCOL_VERSION` | Stop and restart the dev command so both sides reload the shared package |
| Auth join rejected | MSAL values missing (future feature) | Populate `.env` with valid Azure Entra IDs or keep auth disabled for the MVP |
| Browser prompts for login repeatedly | Missing API scopes or consent | Ensure `VITE_MSAL_SCOPES` matches the Azure app API permissions (comma separated) |
| Invalid token signature | JWKS endpoint unreachable or misconfigured | Ensure `MSAL_JWKS_URI` resolves, otherwise rely on the default derived from `MSAL_AUTHORITY` |
| Port in use | Another process on 2567/5173 | Update `SERVER_PORT`/`SERVER_HOST` or stop the conflicting process |
| Shared type not updating | Editor TS cache stale | Restart the dev command and reload your IDE's TS server |

## Clean Install
```
rm -rf node_modules pnpm-lock.yaml
pnpm install
```
