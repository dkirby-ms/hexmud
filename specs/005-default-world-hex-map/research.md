# Phase 0 Research: Default World Base Map

## Goals

- Decide how to represent the default world layout (world, regions, hex tiles, spawn regions) in PostgreSQL.
- Define migration strategy for introducing world tables into the existing HexMUD database.
- Decide how world data is loaded and validated at server startup.
- Clarify how world versioning and world-reset behaviour are applied in practice.

## Technical Decisions

### 1. World Entities in PostgreSQL

**Decision**: Use four main tables to store the default world layout:

1. `world_definition`
   - `id` (PK)
   - `world_key` (unique, e.g., `"default"`)
   - `name`
   - `version` (semantic or incremental)
   - `description`
   - `boundary_policy` (e.g., `"hard-edge"`)
   - `created_at`, `updated_at`

2. `world_region`
   - `id` (PK)
   - `world_id` (FK → `world_definition.id`)
   - `region_key` (e.g., `"continent_a"`, `"ocean_main"`, `"islands_chain_1"`)
   - `name`
   - `type` (`"continent" | "ocean" | "island_chain" | "other"`)
   - `description`

3. `world_hex_tile`
   - `id` (PK)
   - `world_id` (FK → `world_definition.id`)
   - `region_id` (FK → `world_region.id`)
   - `q` (axial q coordinate)
   - `r` (axial r coordinate)
   - `terrain` (`"land" | "ocean" | "coastal" | "island" | "blocked"`)
   - `navigable` (boolean)
   - `label` (optional display name)

4. `world_spawn_region`
   - `id` (PK)
   - `world_id` (FK → `world_definition.id`)
   - `region_id` (FK → `world_region.id`)
   - `name`
   - `description`
   - `min_distance_from_edge` (optional numeric hint for spawn selection)

**Rationale**:
- Matches entities described in the spec (`WorldDefinition`, `WorldRegion`, `HexTile`, `SpawnRegion`).
- Keeps world layout separate from player state (presence and characters), allowing resets and versioning.
- Region and world IDs avoid duplicating strings in every tile.

**Alternatives considered**:
- **Embed hex tiles in JSON** inside a single `world_definition` row:
  - Rejected due to more complex querying (e.g., by coordinate or region) and harder evolution.
- **Single table with world/region fields only**:
  - Rejected to keep referential integrity and avoid repeated region metadata.

### 2. World Versioning

**Decision**: Track a `version` column on `world_definition` and store a single active row for the `"default"` world per deployment.

- Presence and player state refer to world coordinates (q,r) and an implicit world key `"default"`.
- When a major topology change occurs (as defined in the spec), we apply a new migration that:
  - Updates `world_hex_tile` and related tables.
  - Resets presence in affected regions and respawns players using a controlled script.
- We do **not** keep multiple concurrent versions of the default world in the DB in this feature; version is informational and for audit/logging.

**Rationale**:
- Simpler operational model than keeping historical world versions online.
- Aligns with spec: major changes are treated as world-reset events.

**Alternatives considered**:
- **Multiple world versions stored concurrently with per-player world version**:
  - Rejected for this feature as too complex; could be revisited if needed.

### 3. Migration Strategy

**Decision**: Introduce a single SQL migration file under `apps/server/src/migrations/` that creates the four tables and supporting indexes.

- Forward-only, additive migration (no destructive rollbacks).
- Indexes on `(world_id, q, r)` for fast tile lookup; `(world_id, region_id)` for region queries.
- Seed data for the `"default"` world provided either via:
  - A seed script that reads static world definition data (e.g., from JSON) and inserts it, or
  - Direct SQL insert statements in a dedicated seed migration (kept small and reviewed).

**Rationale**:
- Aligns with Constitution requirements for forward-only migrations and clear rollback mitigation.
- Keeps schema changes for world layout isolated from other features.

**Alternatives considered**:
- **Use a separate seeding mechanism outside migrations**:
  - Still possible (e.g., `bootstrap.ts`), but at least one path must guarantee the default world exists on a fresh deployment.

### 4. Loading & Validation at Startup

**Decision**: On server startup, the backend will:

1. Query `world_definition` for the `"default"` world.
2. Load all regions, hex tiles, and spawn regions for that world.
3. Validate that:
   - Two continents exist.
   - At least one ocean region between them exists.
   - At least one island chain region exists between/connecting continents.
   - All tiles have valid region references and coordinates.
4. Build in-memory lookup structures (e.g., maps keyed by `(q,r)` and by region) and expose them via a `world` module.
5. If validation fails, log diagnostics and fail startup.

**Rationale**:
- Matches spec requirements for startup validation and fail-fast.
- Keeps runtime movement checks fast by using in-memory lookups.

**Alternatives considered**:
- **Lazy loading tiles on first access**:
  - Rejected due to more complex error surface and inconsistent behaviour between rooms.

### 5. Movement & Boundary Policy

**Decision**:

- Movement uses the in-memory world map to determine if the target hex exists and is navigable.
- If the target coordinate does not exist in `world_hex_tile` for the default world, the move is rejected and the player remains in place, with feedback they hit the world edge.
- If the tile exists but `navigable = false` (e.g., deep ocean, blocked terrain), movement is rejected and the client is informed of the in-world reason (e.g., impassable terrain).

**Rationale**:
- Implements the hard-edge boundary policy (Q2: A) and non-navigable tiles with clear explanation (Q3: B) from the spec.

### 6. Presence Integration

**Decision**:

- Presence logic will consume the world module for:
  - Validating that a hex exists before recording presence.
  - Optionally tagging presence records with region information for analytics.
- No changes to the presence schema are required; coordinates and player IDs remain the primary keys.

**Rationale**:
- Presence was implemented in previous specs; this feature should be additive and non-breaking.

---

All prior NEEDS CLARIFICATION items from the spec are fully resolved here. Subsequent phases (data-model, contracts, quickstart) will reflect these decisions.
