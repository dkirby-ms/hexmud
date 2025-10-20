-- Migration: Create player_presence table for hex presence tracking
CREATE TABLE IF NOT EXISTS player_presence (
  player_id UUID NOT NULL,
  hex_id TEXT NOT NULL,
  presence_value INTEGER NOT NULL CHECK (presence_value >= 1),
  tier_id SMALLINT NOT NULL CHECK (tier_id >= 0),
  decay_state TEXT NOT NULL CHECK (decay_state IN ('active', 'decaying', 'capped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_visited_at TIMESTAMPTZ NOT NULL,
  last_increment_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (player_id, hex_id)
);

COMMENT ON TABLE player_presence IS 'Per-player presence accumulation for explored hex tiles.';
COMMENT ON COLUMN player_presence.presence_value IS 'Current presence value capped by configuration.';
COMMENT ON COLUMN player_presence.tier_id IS 'Cached tier identifier derived from presence thresholds.';
COMMENT ON COLUMN player_presence.decay_state IS 'Presence decay lifecycle state (active|decaying|capped).';

CREATE INDEX IF NOT EXISTS idx_player_presence_player ON player_presence (player_id);
CREATE INDEX IF NOT EXISTS idx_player_presence_decay_selection
  ON player_presence (decay_state, last_visited_at);
