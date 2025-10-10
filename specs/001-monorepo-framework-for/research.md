# Research: Monorepo Framework Baseline

## Method
Collected current library documentation (Colyseus 0.16.x APIs, MSAL JS for Auth Code + PKCE, Vite monorepo workspace patterns) via Context7. Mapped decisions to requirements and constitution gates. All prior NEEDS CLARIFICATION items resolved by explicit user input or deferral rationale.

## Decisions & Rationale

### D1: Monorepo Package Manager — pnpm Workspaces
- **Decision**: Use `pnpm` with a root `pnpm-workspace.yaml`.
- **Rationale**: Fast install, deterministic store, efficient linking for shared protocol types; Vite & Colyseus fully compatible.
- **Alternatives considered**: npm workspaces (slower symlink churn), Yarn (PNP complexity adds cognitive load), Turborepo (can add later for caching; start minimal with pnpm + concurrently).

### D2: Project Layout
- **Decision**: `apps/{server,web}` + `packages/{protocol,auth-utils?}`.
- **Rationale**: Clear runtime vs library separation; aligns with future horizontal scale (additional services) and avoids early micro-packaging. Protocol isolation enforces single source of truth for schemas.
- **Alternatives**: Single combined `src` (harder to enforce dependency direction); multiple granular packages (premature).

### D3: Shared Protocol Implementation
- **Decision**: Plain TypeScript + Zod schemas + version constant; optional future move to Colyseus Schema or binary format if needed for perf.
- **Rationale**: Human readability and fast iteration; Zod provides runtime validation + TS inference. Colyseus state classes for room state remain in server.
- **Alternatives**: Protobuf (higher setup cost), Colyseus Schema only (less expressive for arbitrary message validation), tRPC (overkill for simple message envelopes initially).

### D4: Authentication Flow
- **Decision**: Browser SPA uses MSAL (@azure/msal-browser) Authorization Code + PKCE flow against existing Entra ID app registration; server validates JWT (signature & claims) using `@azure/msal-node` only if needed for confidential operations, otherwise `jose` JWT verify to minimize coupling.
- **Rationale**: Standards based, aligns with FR-020, minimal server secret handling (server is resource server, not token issuer). Reduces complexity vs hybrid flows.
- **Alternatives**: Implicit Flow (deprecated), SPA using only public client tokens without backend verification (insufficient security), custom OAuth library (reinventing wheel).

### D5: Token Validation Strategy
- **Decision**: Server loads JWKS (cached) and validates access token on room join; extracts subject -> PlayerIdentity. No session DB; in‑memory map only.
- **Rationale**: Persistence deferred; meets security principle with minimal overhead.
- **Alternatives**: Token introspection (unnecessary latency), proprietary session cookies (breaks real‑time WebSocket parity).

### D6: Dev Orchestration
- **Decision**: Root scripts: `pnpm bootstrap` (install + build), `pnpm dev` (concurrently run server & web with watch), `pnpm test` aggregated (vitest workspaces). Use `concurrently` or `npm-run-all`; Turborepo optional later.
- **Rationale**: Simple, low barrier; satisfies FR-002/FR-003.
- **Alternatives**: Nx (heavier concept model early), Turbo from day one (value limited until build graph grows), docker-compose (not needed for no persistence baseline).

### D7: Testing Stack
- **Decision**: Vitest for unit/integration (colyseus room tests run via direct import), supertest for HTTP health endpoint, minimal contract tests for protocol version & auth guard.
- **Rationale**: Fast, TypeScript-native, easy watch; aligns with baseline speed goals.
- **Alternatives**: Jest (slower cold start), Playwright (add later for e2e), k6 for load (later feature).

### D8: Logging & Metrics
- **Decision**: Console structured JSON only when NODE_ENV=development (simple template), rely on Colyseus lifecycle events; define `metrics/adapter.ts` interface with no implementation (future pluggable).
- **Rationale**: Constitution P4 minimalism; avoids premature vendor lock.
- **Alternatives**: pino/winston now (adds config churn), OpenTelemetry early (overhead for baseline).

### D9: Rate Limiting & Validation
- **Decision**: Zod validation at message ingress; placeholder token bucket in-memory per session for heartbeat + join attempt guard (config constants).
- **Rationale**: Meets FR-011 & P5 guard rails without heavy dependency (future can add Redis or sliding window).
- **Alternatives**: External rate-limit service (overkill) or none (risk).

### D10: Protocol Versioning
- **Decision**: `packages/protocol/src/version.ts` exports `PROTOCOL_VERSION`; server checks client-declared version during join; mismatch yields structured error & log.
- **Rationale**: Satisfies FR-016 & scenario in User Story 2 failure case.
- **Alternatives**: Semantic multi-field (major/minor) now (unnecessary until first breaking change); hash based (opaque to devs).

### D11: Frontend Framework
- **Decision**: React + Vite + TypeScript.
- **Rationale**: Ecosystem familiarity, fast HMR, easy MSAL integration; minimal design system initially (plain CSS / Tailwind optional later).
- **Alternatives**: Vanilla JS (slows future scaling), Solid/Svelte (fine but team skill unknown), Next.js (SSR unnecessary now).

### D12: Server Transport Integration
- **Decision**: Plain Colyseus WebSocketTransport; wrap in Express for health endpoint & token validation route (if needed) only.
- **Rationale**: Satisfies FR-009 health check; retains flexibility for future middleware.
- **Alternatives**: Standalone Colyseus without Express (health harder), Fastify integration (not needed yet).

### D13: Tooling & Linting
- **Decision**: ESLint (typescript-eslint recommendedTypeChecked), Prettier, root config extends across packages.
- **Rationale**: Enforces consistent style & type safety; supports FR-018 guidelines.
- **Alternatives**: Biome (emerging, fine later), no formatter (onboarding friction).

### D14: Environment Configuration
- **Decision**: Root `.env.example`; each app reads via `dotenv` in dev; production injection later. Sensitive values (client secret if any) excluded from repo.
- **Rationale**: FR-007, twelve-factor alignment.
- **Alternatives**: .env per package only (duplication risk) or single JSON config (secret leakage risk).

### D15: Message Validation Strategy
- **Decision**: Distinguish transport envelope vs domain payload. Envelope shape: `{ type: string; v: number; ts: number; payload: unknown }`. Validate type enumeration & version equality before delegating to per-type schema.
- **Rationale**: Simplifies dispatch & future analytics; supports FR-011.
- **Alternatives**: Free-form messages (risk), strongly coupled to Colyseus Schema for ALL inbound (harder to evolve non-state messages).

## Open Questions (Resolved / Deferred)
- Persistence Layer: Deferred (D). Extension interfaces stubbed (`persistence` folder placeholder) → decision documented.
- Metrics backend: Deferred; interface only.
- Multi-tab session policy: Allow (explicit in spec) → implemented by permitting multiple PlayerSessions per playerId.

## Risk Mitigations
- Over-engineering: Limit to 2 apps + 1 required package; optional `auth-utils` only if size > trivial.
- Auth complexity: Reuse MSAL patterns; minimal server JWT validation (JWKS cache util) first.
- Protocol drift: Central version constant + join check + shared package watch.

## Summary Table
| Area | Decision | Alternatives | Rationale Snapshot |
|------|----------|-------------|--------------------|
| Package manager | pnpm | npm, yarn | Faster linking & workspace ergonomics |
| Auth | PKCE + MSAL | Implicit, custom | Standards, security |
| Shared validation | Zod | Protobuf, raw TS | Fast iteration + runtime safety |
| Testing | Vitest | Jest | Speed & TS integration |
| Layout | apps + packages | single src | Clear dependency direction |
| Protocol version | Constant + join check | semantic triple now | Minimal & adequate |

All prior NEEDS CLARIFICATION markers cleared; no remaining gating unknowns.
