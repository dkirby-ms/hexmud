# hexmud Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-10

## Active Technologies
- TypeScript (strict) on Node.js 22 LTS (>=22.x) + Colyseus 0.16.5 (server + schema), Vite (React SPA), MSAL (@azure/msal-browser for SPA, @azure/msal-node optional future confidential extensions), Zod (message validation), pnpm workspaces, concurrently / turbo (task orchestration) (001-monorepo-framework-for)
- TypeScript (strict) Node.js 22 LTS (repo standard) + Colyseus (rooms/state sync), Zod (message validation), React + Vite (web UX), Logging (existing logger), Future: PostgreSQL (persistence), Redis (optional for decay batching) (004-hex-presence-progression)
- PostgreSQL (PlayerPresenceRecord table), Redis (optional ephemeral decay scheduling keys) (004-hex-presence-progression)

## Project Structure
```
apps/
	server/
	web/
packages/
	protocol/
	auth-utils/ (optional / may be merged later)
specs/
scripts/
config/
```

## Commands
pnpm install
pnpm dev            # concurrently start server + web
pnpm test           # vitest across workspaces
pnpm lint           # eslint type-aware rules
pnpm build          # (future) build shared packages

## Code Style
TypeScript (strict) on Node.js 22 LTS (>=22.x): Follow standard conventions

## Recent Changes
- 004-hex-presence-progression: Added TypeScript (strict) Node.js 22 LTS (repo standard) + Colyseus (rooms/state sync), Zod (message validation), React + Vite (web UX), Logging (existing logger), Future: PostgreSQL (persistence), Redis (optional for decay batching)
- 001-monorepo-framework-for: Added TypeScript (strict) on Node.js 22 LTS (>=22.x) + Colyseus 0.16.5 (server + schema), Vite (React SPA), MSAL (@azure/msal-browser for SPA, @azure/msal-node optional future confidential extensions), Zod (message validation), pnpm workspaces, concurrently / turbo (task orchestration)

<!-- MANUAL ADDITIONS START -->
Monorepo Notes:
- Use pnpm workspaces; do not introduce new packages unless they provide reusable logic consumed by at least two apps.
<!-- MANUAL ADDITIONS END -->
