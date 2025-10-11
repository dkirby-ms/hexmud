# HexMUD Monorepo

> Baseline scaffolding for the HexMUD web MMORPG prototype.

## Getting Started

Install prerequisites (Node.js 22+, pnpm 9+), then run the bootstrap script to install every workspace dependency:

```bash
pnpm run bootstrap
```

Copy `.env.example` to `.env` and update values when credentials become available. Authentication is optional during early development, but when you enable Azure Entra ID configure both the server variables (`MSAL_*`) and the client-side entries (`VITE_MSAL_CLIENT_ID`, `VITE_MSAL_AUTHORITY`, `VITE_MSAL_REDIRECT_URI`, `VITE_MSAL_SCOPES`).

Run the workspace test suite to confirm the toolchain is healthy:

```bash
pnpm run test
```

## Quick Start (US1 MVP)

Launch the full stack from a single terminal:

```bash
pnpm run dev
```

You should observe the following within a few seconds:

- Server logs reporting `server.started` and `room.placeholder.joined` events.
- The web client automatically opens a browser tab (or navigate to `http://localhost:5173`) showing "Connected to placeholder world" with your session identifier and live heartbeat latency.

Press `Ctrl+C` once to gracefully shut down both processes. The server will dispose the active room and free the port cleanly.

See [`specs/001-monorepo-framework-for/quickstart.md`](specs/001-monorepo-framework-for/quickstart.md) for detailed onboarding, troubleshooting tips, and future authentication setup instructions.

## Repository Layout

```
apps/
  server/   # Colyseus authoritative server (Node.js)
  web/      # Vite + React SPA client
packages/
  protocol/ # Shared protocol constants, schemas, and helpers
scripts/    # Node-based maintenance scripts (bootstrap, tooling)
config/     # Shared configuration (eslint, tsconfig, vitest)
```

## Commands

| Command            | Description                                        |
|--------------------|----------------------------------------------------|
| `pnpm run bootstrap` | Installs dependencies across the workspace         |
| `pnpm run dev`       | Runs all app `dev` scripts in parallel             |
| `pnpm run build`     | Builds each workspace package/app (tsc/vite/etc.)  |
| `pnpm run lint`      | Runs ESLint across the workspace                   |
| `pnpm run test`      | Executes Vitest suites workspace-wide              |

## Documentation

- Feature spec: [`specs/001-monorepo-framework-for/spec.md`](specs/001-monorepo-framework-for/spec.md)
- Implementation plan: [`specs/001-monorepo-framework-for/plan.md`](specs/001-monorepo-framework-for/plan.md)
- Quickstart: [`specs/001-monorepo-framework-for/quickstart.md`](specs/001-monorepo-framework-for/quickstart.md)

## Protocol Versioning & Breaking Changes

- The shared protocol contract lives in `packages/protocol`.
- Use the helper script to bump the protocol version whenever you introduce a breaking change:

  ```bash
  pnpm run bump:protocol <next-version>
  ```

  The script updates `packages/protocol/src/version.ts`, prepends a changelog entry, and blocks accidental downgrades.
- The server enforces strict version compatibility during room joins. Clients advertising an outdated or future protocol number receive a `VERSION_MISMATCH` error envelope and the join is rejected.
- After bumping, rebuild and restart both the server and web app so they load the new shared package.

## Contributing

Please review [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening pull requests. The guidelines include commit conventions, coding standards, and testing expectations.
