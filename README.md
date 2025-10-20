# HexMUD Monorepo

> Baseline scaffolding for the HexMUD web MMORPG prototype.

## Getting Started

Install prerequisites (Node.js 22+, pnpm 9+), then run the bootstrap script to install every workspace dependency:

```bash
pnpm run bootstrap
```

Copy `.env.example` to `.env` and update values when credentials become available. Authentication is optional during early development, but when you enable Azure Entra ID configure both the server variables (`MSAL_*`) and the client-side entries (`VITE_MSAL_CLIENT_ID`, `VITE_MSAL_AUTHORITY`, `VITE_MSAL_REDIRECT_URI`, `VITE_MSAL_SCOPES`).

### Presence Configuration (Server)

Populate the following environment variables to tune the presence progression feature. Defaults align with the MVP research assumptions:

| Variable | Default | Description |
|----------|---------|-------------|
| `PRESENCE_CAP` | `100` | Maximum presence value per hex before increments stop. |
| `PRESENCE_FLOOR_PERCENT` | `0.10` | Minimum floor percentage (as decimal) applied to the cap. Presence never decays below `ceil(cap * floorPercent)`. |
| `PRESENCE_DECAY_PERCENT` | `0.05` | Fractional decay percentage applied during each decay tick. |
| `PRESENCE_INACTIVITY_MS` | `86400000` | Inactivity threshold (milliseconds) before a hex becomes eligible for decay (default 24h). |
| `PRESENCE_INTERVAL_MS` | `10000` | Accumulation interval (milliseconds) used to validate dwell and schedule increments. |
| `PRESENCE_REQUIRED_DWELL_FRACTION` | `0.9` | Minimum fraction of the interval a player must dwell in a hex to earn an increment. |

Configure these alongside the existing MSAL variables in `apps/server/.env`. The client does not require additional configuration for presence during Phase 1.

### Database Configuration (Server)

Presence persistence relies on PostgreSQL. Provide the following environment variables when booting the server:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | _(required)_ | PostgreSQL connection string used by the presence DAO. Example: `postgres://postgres:postgres@localhost:5432/hexmud`. |
| `DATABASE_MAX_CONNECTIONS` | `10` | Optional override for the Postgres pool size (matches `pg` `max` option). |

If `DATABASE_URL` is omitted, the presence world room is not registered and the server emits a warning at startup.

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

## Authentication Setup

Authentication is optional for local prototyping but required to exercise the new auth-enabled join flow:

- Copy `.env.example` to `.env` in both `apps/web` and `apps/server`, then follow the guidance in [`docs/auth-config.md`](docs/auth-config.md).
- Review the feature-specific quickstart at [`specs/002-wire-up-authentication/quickstart.md`](specs/002-wire-up-authentication/quickstart.md) for redirect flow behaviour, renewal expectations, and troubleshooting steps.
- When the `MSAL_*` and `VITE_MSAL_*` variables are populated, the web client will automatically prompt for sign-in and attach the validated token to server join requests.
- The UI exposes a **Sign in (redirect)** button aligned with Decision D1 and a **Use popup fallback** helper when running tests or diagnosing redirect blockers. Cancellation leaves the session unauthenticated without noisy errors; retry when ready.

## Performance Snapshot

| Criteria | Target | Status | Evidence & Next Steps |
|----------|--------|--------|-----------------------|
| **SC-001** Sign-in latency | 95% of first-time sign-ins < 8s | On track | Redirect + popup flows covered by `apps/web/tests/unit/authHook.test.ts`; instrumentation for percentile capture planned in T061. Manual dev runs remain comfortably below threshold. |
| **SC-002** Token validation reliability | <0.5% validation failures (non-test) | In progress | Integration coverage in `apps/server/tests/integration/authJoin.test.ts` shows 0 system failures; production counter wiring scheduled in T062 to report rolling rate. |
| **SC-003** Renewal continuity | 99% renewals without prompts over 60 min | On track | Renewal + sign-out flows validated via `authHook` unit suites and connection renewal contract tests; extended 60-minute simulation to land with T064. |
| **SC-004** Auth overhead | Median join overhead <100 ms and <5% delta vs unauth baseline | Monitoring | 500-session load test (T047) recorded join latency p50 599 ms, p95 622 ms with 0 failures; unauth baseline comparison will be captured in T065 before lock-in. |
| **SC-005** Correlated security logging | 100% rejected attempts include `authCorrId` | Pending | Log event schema finalized in Phase 2; client/server propagation of correlation IDs tracked in T055/T056. |
| **SC-006** Concurrency support | ≥500 concurrent authenticated sessions within SC-004 budget | ✅ Achieved | Load test `scripts/load-test.ts --concurrency 500` completed with 500/500 successes (avg join 583 ms) as recorded in `specs/002-wire-up-authentication/research.md`. |

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
- Authentication configuration: [`docs/auth-config.md`](docs/auth-config.md)

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
