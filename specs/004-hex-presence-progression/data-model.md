# Data Model: Hex Presence Progression

## Entities

### PlayerPresenceRecord
Represents a player's presence in a single hex.
- player_id (uuid/string) PK part
- hex_id (string or composite axial coords e.g., q,r) PK part
- presence_value (int) range 1..MAX_CAP (cap 100)
- created_at (timestamp)
- updated_at (timestamp)
- last_visited_at (timestamp)
- last_increment_at (timestamp)
- decay_state (enum: active|decaying|capped)
- tier_id (derived or cached smallint)

**Indexes**:
- PK (player_id, hex_id)
- INDEX on player_id for listing player map
- INDEX on decay_state + last_visited_at for decay batch selection

**Validation Rules**:
- presence_value >= 1 and <= CAP
- last_increment_at <= updated_at
- tier_id matches configured threshold mapping

**State Transitions**:
1. create → active (presence_value = 1)
2. active increment (presence_value + growth) → active OR capped if reaches CAP
3. active inactivity threshold reached → decaying
4. decaying increment (player returns) → active
5. decaying decay tick → decaying (presence_value decreases but >= floor)
6. capped inactivity threshold reached → decaying (if not visited) else remain capped

### PresenceTierDefinition (Configuration)
Static in-memory config loaded at server start.
- tier_id
- min_value
- label
- color_hint (string)

### PresenceUpdateEvent (Ephemeral)
Outbound message event summarizing changes.
- hex_id
- delta (signed int)
- new_value
- reason (create|increment|decay|cap|anomaly)
- tier_after
- timestamp

### PresenceAnomalyRecord (Log/Analytics)
Optional persisted anomaly.
- player_id
- hex_id
- anomaly_type (oscillation|rate|other)
- value_before
- value_after
- created_at

## Derived / Computed
- tier_id computed from presence_value using ordered thresholds.
- decay rate = floor(presence_value * DECAY_PERCENTAGE rounded).
- floor value = ceil(MAX_CAP * FLOOR_PERCENTAGE).

## Configuration Constants
- MAX_CAP = 100
- FLOOR_PERCENTAGE = 0.10
- DECAY_PERCENTAGE = 0.05
- INACTIVITY_THRESHOLD (ms) = 24h
- DWELL_INTERVAL (ms) = 10s
- REQUIRED_DWELL_FRACTION = 0.90

## Relationships
- PlayerPresenceRecord references player (foreign key to players table) (players table assumed existing).
- PresenceUpdateEvent ephemeral; not persisted (except anomalies).

## Persistence Strategy
- Single table `player_presence` for records.
- Migration adds table with composite primary key and necessary indexes.
- No timeline/history table initially; deltas can be reconstructed from logs if needed.

## Decay Batch Selection Query (Conceptual)
```
SELECT player_id, hex_id, presence_value
FROM player_presence
WHERE decay_state != 'capped'
  AND last_visited_at < (NOW() - INTERVAL '24 HOURS')
ORDER BY last_visited_at ASC
LIMIT BATCH_SIZE;
```
Apply decay percentage; ensure presence_value >= FLOOR.

## Error Modes / Edge Cases
- Attempt to increment when presence_value == CAP → emit cap event; no change.
- Decay tick resulting value < FLOOR → clamp to FLOOR.
- Re-entry during pending decay batch → skip decay for that record.

## Data Integrity Considerations
- All updates wrapped in transaction per batch to avoid partial decay application.
- Replay harness logs presence events for deterministic reproduction of presence_value evolution.

*End of Data Model*
