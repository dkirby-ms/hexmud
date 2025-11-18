-- Migration: Default World Base Map schema

CREATE TABLE IF NOT EXISTS world_definition (
  id            BIGSERIAL PRIMARY KEY,
  world_key     TEXT        NOT NULL UNIQUE,
  name          TEXT        NOT NULL,
  description   TEXT,
  version       INTEGER     NOT NULL DEFAULT 1,
  boundary_policy TEXT      NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS world_region (
  id          BIGSERIAL PRIMARY KEY,
  world_id    BIGINT NOT NULL REFERENCES world_definition(id) ON DELETE CASCADE,
  region_key  TEXT   NOT NULL,
  name        TEXT   NOT NULL,
  type        TEXT   NOT NULL CHECK (type IN ('continent', 'ocean', 'island_chain', 'other')),
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (world_id, region_key)
);

CREATE TABLE IF NOT EXISTS world_hex_tile (
  id        BIGSERIAL PRIMARY KEY,
  world_id  BIGINT NOT NULL REFERENCES world_definition(id) ON DELETE CASCADE,
  region_id BIGINT NOT NULL REFERENCES world_region(id) ON DELETE CASCADE,
  q         INTEGER NOT NULL,
  r         INTEGER NOT NULL,
  terrain   TEXT    NOT NULL CHECK (terrain IN ('land', 'ocean', 'coastal', 'island', 'blocked')),
  navigable BOOLEAN NOT NULL DEFAULT TRUE,
  label     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (world_id, q, r)
);

CREATE TABLE IF NOT EXISTS world_spawn_region (
  id                    BIGSERIAL PRIMARY KEY,
  world_id              BIGINT NOT NULL REFERENCES world_definition(id) ON DELETE CASCADE,
  region_id             BIGINT NOT NULL REFERENCES world_region(id) ON DELETE CASCADE,
  name                  TEXT   NOT NULL,
  description           TEXT,
  min_distance_from_edge INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (world_id, name)
);

CREATE INDEX IF NOT EXISTS idx_world_region_world_type
  ON world_region (world_id, type);

CREATE INDEX IF NOT EXISTS idx_world_hex_tile_world_region
  ON world_hex_tile (world_id, region_id);

CREATE INDEX IF NOT EXISTS idx_world_hex_tile_coordinates
  ON world_hex_tile (world_id, q, r);

CREATE INDEX IF NOT EXISTS idx_world_spawn_region_world_region
  ON world_spawn_region (world_id, region_id);

COMMENT ON TABLE world_definition IS 'Authoritative world definitions (default world only in this feature).';
COMMENT ON TABLE world_region IS 'Logical groupings of tiles (continents, oceans, island chains, etc).';
COMMENT ON TABLE world_hex_tile IS 'Axial hex coordinates, terrain classification, and navigability.';
COMMENT ON TABLE world_spawn_region IS 'Spawn regions referencing safe areas within the default world.';
