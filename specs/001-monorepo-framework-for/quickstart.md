# Quickstart: Monorepo Framework Baseline

## Prerequisites
- Node.js >= 22.x (LTS) (`node -v`)
- pnpm >= 9 (`corepack enable` or `npm i -g pnpm`)
- Modern browser
- (Optional) Azure Entra ID application registration (client ID, tenant ID, redirect URI)

## Repository Bootstrap
```
pnpm install      # installs all workspace dependencies
pnpm build        # (future) build shared packages if needed (not mandatory for dev watch)
```
Or single convenience script (will be added):
```
pnpm run bootstrap
```

## Development
Single command (script `dev` to be added in root `package.json`):
```
pnpm dev
```
Starts:
- Colyseus server (apps/server) on e.g. `localhost:2567`
- Vite SPA (apps/web) on e.g. `localhost:5173` with proxy to server if needed

## Authentication Setup
Create `.env` at repo root (never commit secrets):
```
MSAL_CLIENT_ID=00000000-0000-0000-0000-000000000000
MSAL_TENANT_ID=your-tenant-id
MSAL_AUTHORITY=https://login.microsoftonline.com/${MSAL_TENANT_ID}
MSAL_REDIRECT_URI=http://localhost:5173
```
Frontend loads config from env (Vite prefixes `VITE_` if exposed):
```
VITE_MSAL_CLIENT_ID=
VITE_MSAL_AUTHORITY=
VITE_MSAL_REDIRECT_URI=
```

## Shared Protocol Changes
Edit files in `packages/protocol/src` (messages, constants). Running `pnpm dev` ensures watch re-build; server & client auto pick up changes (HMR + ts-node reload where applicable). Version bump: increment `PROTOCOL_VERSION` and adjust server join guard.

## Testing
```
pnpm test              # runs vitest across workspaces
pnpm test:watch
```
Initial tests cover:
- Protocol version export
- Auth guard rejection when missing token
- Server health endpoint 200

## Adding a New Message Type
1. Define zod schema in `packages/protocol/src/messages/<name>.ts`
2. Export its TypeScript type
3. Add dispatcher handler in `apps/server/src/handlers` mapping message `type`
4. Client: consume from `packages/protocol` exports

## Lint & Format
```
pnpm lint
pnpm format
```

## Graceful Shutdown
Ctrl+C in dev orchestrator stops both server & web; server disposes rooms and logs `session.leave` events.

## Future Extensions (Not in Baseline)
- Persistence adapters (postgres) in `packages/persistence`
- Metrics adapter (Prometheus / OpenTelemetry)
- Replay harness when simulation logic added

## Troubleshooting
| Issue | Cause | Resolution |
|-------|-------|------------|
| Version mismatch error | Client not rebuilt after protocol change | Refresh SPA (HMR) or restart dev if schema type error persists |
| Auth join rejected | Missing/expired token | Re-login via MSAL; check browser console for MSAL errors |
| Port in use | Another process on 2567/5173 | Adjust env `SERVER_PORT` / `VITE_PORT` or kill process |
| Shared type not updating | Editor TS cache stale | Re-run `pnpm dev`; ensure package has `"types": "dist/index.d.ts"` after build (if build step added) |

## Clean Install
```
rm -rf node_modules pnpm-lock.yaml
pnpm install
```
