# Implementation Plan: Default World Base Map

**Branch**: `005-default-world-hex-map` | **Date**: 2025-11-16 | **Spec**: `/specs/005-default-world-hex-map/spec.md`
**Input**: Feature specification from `/specs/005-default-world-hex-map/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Store the default hex-based world layout (world definition, regions, hex tiles, and spawn regions) in PostgreSQL so every deployment boots with an authoritative, versioned map containing two major continents separated by oceans with island chains in between. On server startup, the backend loads and validates this layout, exposes read-only access helpers to movement/presence logic, and enforces boundary and world-reset policies defined in the feature spec.

## Technical Context

**Language/Version**: TypeScript (strict) on Node.js 22 LTS  
**Primary Dependencies**: Colyseus (rooms/session), Zod (message validation), PostgreSQL driver + migration layer (NEEDS CLARIFICATION: exact migration tool in this repo)  
**Storage**: PostgreSQL for authoritative world layout (`WorldDefinition`, `WorldRegion`, `WorldHexTile`, `WorldSpawnRegion` tables). Redis is not used directly by this feature.  
**Testing**: Vitest for unit/integration tests; extend existing replay/route tests so that movement + presence flows assert expected tiles/regions for a given world version.  
**Target Platform**: Linux server (HexMUD backend) with Vite/React frontend that indirectly benefits from consistent world layout via existing protocols.  
**Project Type**: Monorepo with `apps/server` and `apps/web` plus shared `packages`. This feature adds server-side modules and migrations only.  
**Performance Goals**: World lookups and region classification must add negligible overhead to existing movement and presence logic; maintain p95 end-to-end action acknowledgement ≤ 300ms under current concurrency goals. World load/validation on startup should complete within a few seconds and fail fast on misconfiguration.  
**Constraints**: World state must remain authoritative in PostgreSQL (per Constitution P1/P2); rooms may maintain read-only caches but no divergent copies. No new custom high-frequency loops beyond existing Colyseus simulation intervals.  
**Scale/Scope**: Support a single default world with up to ~100k hex tiles and associated regions; future multi-world/sharded layouts are out of scope for this feature but should not be precluded by schema design.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design and before merge.*

List each core principle (P1–P5) with pass/fail + evidence:

| Principle | Description (summary) | Status | Evidence / Notes |
|-----------|-----------------------|--------|------------------|
| P1 | Authoritative Server Consistency | PASS | World layout and regions are stored in PostgreSQL as the single source of truth and loaded read-only into server processes; clients never define or override topology. |
| P2 | Horizontal Scalability & Stateless Edges | PASS | Any room instance can query the same world tables; no node-local world mutations or machine affinity; rooms keep only transient references. |
| P3 | Deterministic Simulation & Reproducibility | PASS | For a fixed world version and ordered movement inputs, reachable tiles and region transitions are deterministic; replay tests will assert expected tile/region sequences. No new randomness is introduced. |
| P4 | Lean Observability & Performance Budgets | PASS | No new high-frequency loops; we rely on Colyseus metrics and add only minimal startup/validation logs and counters for boundary rejections and validation failures. |
| P5 | Security, Fair Play & Data Integrity | PASS | Movement is validated against DB-backed topology; schema migrations for world data are forward-only; world-reset policy for major topology changes is defined in the spec and implemented via migrations/ops scripts. |

Performance & Resource Impact Summary:
- Tick budget impact: Negligible per-move overhead from world lookups (expected to be cached in-process); well within existing movement/presence budgets.  
- Custom high-frequency loop introduced: NO  
- Added custom metrics/logs (justify if added): Startup world load/validation logs; counters for `world.default.boundary.moveRejected` and validation error counts to debug misconfigurations.  
- Schema migrations: YES – introduce world tables (e.g., `world_definition`, `world_region`, `world_hex_tile`, `world_spawn_region`) in a single migration file.  
- Redis keys (namespace + TTL): None added by this feature.

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

ios/ or android/
### Source Code (repository root)

```
apps/
  server/
    src/
      config/
      rooms/
      state/
      world/            # NEW: world loading + DB access for default world
    tests/
      integration/
      unit/

  web/
    src/
      components/
      hooks/
      protocol/
      services/
    tests/
      integration/
      unit/

packages/
  protocol/
    src/
      messages/
```

**Structure Decision**: Extend `apps/server` with a `world/` module responsible for loading default world data from PostgreSQL at startup and exposing read-only helpers to rooms and presence logic. No new top-level apps or packages are introduced.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
