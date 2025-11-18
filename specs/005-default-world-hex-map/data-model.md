# Data Model: Default World Base Map

## Overview

The default world is represented in PostgreSQL as an authoritative layout that the server loads at startup. It consists of a single `world_definition` row for the `"default"` world, associated `world_region` rows for continents, oceans, and island chains, `world_hex_tile` rows for each hex coordinate, and `world_spawn_region` rows specifying spawn areas.

This document describes the conceptual data model; implementation may map these to concrete SQL types and indexes.

## Entities

### WorldDefinition

Represents the overall default world configuration.

**Fields**:
- `id`: Internal identifier (integer/bigint).
- `world_key`: Stable key (string), e.g., `"default"`.
- `name`: Human-readable name for the world.
- `description`: Optional description.
- `version`: Version string or integer for audit and reproducibility.
- `boundary_policy`: Policy key (e.g., `"hard-edge"`).
- `created_at`: Timestamp created.
- `updated_at`: Timestamp last updated.

**Relationships**:
- One `WorldDefinition` has many `WorldRegion` and `WorldHexTile` and `WorldSpawnRegion` records.

### WorldRegion

Logical grouping of hex tiles (e.g., continents, oceans, island chains).

**Fields**:
- `id`: Internal identifier.
- `world_id`: FK to `WorldDefinition.id`.
- `region_key`: Stable key string, e.g., `"continent_a"`, `"continent_b"`, `"ocean_main"`, `"island_chain_1"`.
- `name`: Human-readable name.
- `type`: Enum-like string (`"continent" | "ocean" | "island_chain" | "other"`).
- `description`: Optional description.

**Relationships**:
- One `WorldRegion` has many `WorldHexTile`.
- One `WorldRegion` may be referenced by many `WorldSpawnRegion`.

### WorldHexTile

Represents a single hex tile in the default world.

**Fields**:
- `id`: Internal identifier.
- `world_id`: FK to `WorldDefinition.id`.
- `region_id`: FK to `WorldRegion.id`.
- `q`: Axial q coordinate (integer).
- `r`: Axial r coordinate (integer).
- `terrain`: Enum-like string (`"land" | "ocean" | "coastal" | "island" | "blocked"`).
- `navigable`: Boolean indicating whether players may enter.
- `label`: Optional label for notable locations.

**Relationships**:
- Belongs to a single `WorldDefinition` and `WorldRegion`.
- Used by movement and presence logic to validate coordinates.

**Validation Rules**:
- `(world_id, q, r)` must be unique.
- `region_id` must reference a region within the same `world_id`.
- `navigable = false` is allowed (e.g., deep ocean, impassable terrain).

### WorldSpawnRegion

Represents an area where new players may spawn.

**Fields**:
- `id`: Internal identifier.
- `world_id`: FK to `WorldDefinition.id`.
- `region_id`: FK to `WorldRegion.id`.
- `name`: Human-readable name.
- `description`: Optional description.
- `min_distance_from_edge`: Optional numeric hint indicating desired minimum distance from world edge or non-navigable tiles.

**Relationships**:
- Belongs to one `WorldDefinition` and one `WorldRegion`.
- Server uses associated tiles in that region to choose spawn hexes.

### PlayerPresenceRecord (existing)

Defined in previous spec; included here only for context.

**Key Points**:
- Tracks a player's presence in a single hex coordinate.
- Uses player identifier and hex coordinate (q,r) keyed to the default world.
- This feature does not change its structure; it relies on world data to validate coordinates.

## State Transitions

### WorldDefinition Lifecycle

- **Create default world**: On initial migration/seed, insert one row for `world_key = "default"`.
- **Update version**: When a major topology change is applied, increment `version` and adjust associated world data via migrations/seed scripts.
- **Delete**: Not expected for the default world in this feature.

### WorldRegion Lifecycle

- **Create**: Seed regions for continent A, continent B, oceans, and island chains.
- **Update**: Descriptions may change; type and key should remain stable except during a controlled world reset.
- **Delete**: Only as part of a world reset migration.

### WorldHexTile Lifecycle

- **Create**: Seed all tiles for the default world during initial migration/seed.
- **Update**: Coordinates and region assignments change only during world reset migrations.
- **Delete**: Tiles may be deleted when removing parts of the world during a reset.

### WorldSpawnRegion Lifecycle

- **Create**: Seed spawn regions in safe areas of continent A (and optionally other regions).
- **Update**: Adjusted when spawn policies or world layout changes.
- **Delete**: Removed if a spawn area is decommissioned as part of a reset.

## Invariants

- Exactly one active `WorldDefinition` row exists with `world_key = "default"`.
- For the default world:
  - At least one `WorldRegion` with `type = "continent"` and key analogous to continent A.
  - At least one `WorldRegion` with `type = "continent"` and key analogous to continent B.
  - At least one `WorldRegion` with `type = "ocean"` that lies between the two continents.
  - At least one `WorldRegion` with `type = "island_chain"` between/connecting continents.
- All `WorldHexTile` rows for the default world belong to one of these regions and form continuous navigable paths as defined in tests.

## Usage by Server

- At startup, server loads all world entities for `world_key = "default"`, validates invariants, and constructs in-memory indices.
- Movement logic queries the world indices to:
  - Check that a target `(q,r)` exists and is `navigable`.
  - Resolve region for analytics and feature gating.
- Presence logic uses the same coordinates; if a coordinate is missing from the world, presence for that tile is not created.

This data model underpins the feature’s functional requirements and will be used to derive the SQL migration and runtime world-loading module.
