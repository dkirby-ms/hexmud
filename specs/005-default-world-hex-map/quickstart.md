# Quickstart: Default World Base Map

This guide explains how to work with the default world layout for HexMUD once this feature is implemented. It is written for developers and operators.

## 1. After migrations

1. Apply the database migrations for the default world tables:
   - `world_definition`
   - `world_region`
   - `world_hex_tile`
   - `world_spawn_region`
2. Ensure seed data for the `"default"` world has been inserted (via migration or the `seedDefaultWorld.ts` helper that backs `pnpm run bootstrap`).
3. Verify that the seed script logged `world.default.seed.applied` (or `world.default.seed.skipped`) so you know whether data was inserted or already present.

## 2. Starting the server

1. Start the server from the monorepo root.
2. On startup, the server will:
   - Load the `"default"` world from PostgreSQL.
   - Validate that:
     - Two continents exist.
     - At least one ocean region exists between them.
     - At least one island chain region exists between/connecting the continents.
   - Build in-memory indices for world lookups.
3. Observe the structured logs emitted during bootstrap:
   - `world.default.load.start` kicks off the load.
   - `world.default.validation.error` describes any invariants that failed.
   - `world.default.load.success` and `world.default.version.active` record version, tile, region, and spawn counts. These entries also drive the `world_load_*` metrics in `apps/server/src/metrics/world.ts`.
4. If validation fails, startup halts with detailed diagnostics plus metrics (`world_load_failure_total`) indicating the phase that failed.

## 3. Using the world in code

- Use the `apps/server/src/world/` module to:
  - Retrieve world metadata (world key, version, boundary policy).
   - Resolve a hex tile by axial coordinates `(q,r)` via `getHexTile`.
   - Determine the containing region with `getRegionForTile` or list all regions with `listWorldRegions`.
   - Enumerate spawn regions and choose a spawn hex using `selectSpawnHex`, which now prefers regions and enforces navigable tiles.
   - Access immutable metadata through `getWorldMetadata` for logging, feature flags, or telemetry.

Movement and presence logic should call this module rather than accessing the database directly, ensuring a consistent view of the world.

## 4. Inspecting the world via API

The planning-level API in `contracts/openapi.yaml` describes internal endpoints (implemented under `apps/server/src/handlers/world/`) that may be used for tooling and diagnostics, such as:

- `GET /worlds/default` – View metadata for the default world.
- `GET /worlds/default/regions` – List all regions (continents, oceans, island chains).
- `GET /worlds/default/tiles?regionKey=continent_a` – Inspect tiles for a given region.
- `GET /worlds/default/spawn-regions` – List configured spawn regions.

These endpoints are optional and intended for internal use (e.g., admin UI, QA tools).

## 5. World resets and topology changes

When a major topology change is introduced:

1. Apply a migration that updates world tables to the new layout.
2. Run an operational script that:
   - Resets presence in affected regions.
   - Moves players to safe spawn regions.
3. Verify that startup validation passes and default paths (e.g., continent A → continent B) still work.

This process treats large layout changes as "world reset" events, as described in the feature spec.

## 6. Validation & diagnostics

1. Run the deterministic world tests after any schema, data, or code change:
   - `pnpm --filter @hexmud/server test -- tests/unit/world/worldModule.test.ts`
   - `pnpm --filter @hexmud/server test -- tests/integration/world/defaultWorldPaths.test.ts`
   - `pnpm --filter @hexmud/server test -- tests/integration/presence/presenceOnDefaultWorld.test.ts`
2. Use `pnpm load:test -- --scenario placeholder --iterations 3 --concurrency 50` to stress movement/presence flows after verifying the world is loaded. Monitor `world_boundary_move_rejections_total` and `world.default.boundary.moveRejected` logs for edge hits.
3. When debugging operator issues, query the metrics generated in `apps/server/src/metrics/world.ts` (e.g., `world_load_success_total`, `world_load_failure_total`, `world_validation_errors_total`) alongside the structured logs listed above.
