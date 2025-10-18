# Feature Specification: Hex Presence Progression

**Feature Branch**: `004-hex-presence-progression`  
**Created**: 2025-10-17  
**Status**: Draft  
**Input**: User description: "Players explore a large hex-grid game board, gradually gaining presence in each new hex tile they move to."

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - First-Time Exploration & Presence Claim (Priority: P1)

A player enters the world and moves their avatar into previously unvisited hex tiles to expand their personal presence. Upon first entry to a hex, they begin accumulating a non-transferable "presence score" for that tile that represents familiarity/control. Presence accumulation starts immediately and is visible to the player.

**Why this priority**: Core loop foundation; without establishing and tracking presence per tile, downstream mechanics (visibility, control, progression gating) cannot exist.

**Independent Test**: Can be tested by spawning a fresh player, moving across several hex coordinates, and verifying presence entries are created and increment according to defined rules without requiring any other feature.

**Acceptance Scenarios**:

1. **Given** a new authenticated player with no prior explored tiles, **When** they move into hex H(10,5), **Then** a presence record for H(10,5) is created with initial presence value > 0.
2. **Given** the player remains in H(10,5) for the presence tick interval, **When** the interval elapses, **Then** the presence value for H(10,5) increases by the base rate and is surfaced to the player.
3. **Given** the player moves sequentially through three new hexes, **When** they inspect their explored map, **Then** all three hexes show presence >= initial value and all other hexes show no presence.
4. **Given** the player re-enters an already present hex later, **When** presence accumulation conditions are met, **Then** presence resumes incrementing from prior stored value (not reset).

---

### User Story 2 - Presence Visibility & Feedback (Priority: P2)

Player can view their presence values for explored hexes through a map or overlay and see real-time (or periodic) updates as they stand in a tile or move. Presence values are represented with intuitive visual scaling (e.g., shading intensity tiers).

**Why this priority**: Visualization motivates continued exploration and gives the player situational awareness; while not required to store data, it is required to deliver user value.

**Independent Test**: Can be tested by pre-populating presence data or generating it via Story 1 and verifying the UI/feedback layer renders correct values and updates when presence changes.

**Acceptance Scenarios**:

1. **Given** the player has presence in hexes A,B,C, **When** they open the map view, **Then** those hexes display presence tiers corresponding to stored values and unexplored hexes show neutral state.
2. **Given** the player remains stationary in a hex during a presence increment, **When** the increment occurs, **Then** the displayed value (or tier) updates within the defined latency budget.
3. **Given** presence reaches a threshold boundary (e.g., tier change), **When** the value crosses that threshold, **Then** the visual representation changes to the new tier in the next refresh cycle.

---

### User Story 3 - Presence Decay & Re-Engagement (Priority: P3)

If a player neglects a hex for a prolonged period, their presence in that hex gradually decays (soft decay that never fully deletes record unless value hits zero). Re-entering the hex halts decay and resumes growth.

**Why this priority**: Introduces dynamic maintenance loop encouraging revisits and strategic routing after initial exploration loop is stable.

**Independent Test**: Can be simulated by advancing time (or configuring accelerated decay) and verifying decay rules without requiring User Story 2 visuals (logs or API output suffice).

**Acceptance Scenarios**:

1. **Given** a hex with presence value P at time T0, **When** the player is absent for the defined inactivity period, **Then** after decay interval the presence value decreases according to decay rate formula.
2. **Given** presence has partially decayed, **When** player re-enters, **Then** further decay stops and accumulation resumes at base (or modified) growth rate.
3. **Given** presence decays to the minimum floor value, **When** additional decay cycles occur, **Then** presence does not go below floor and the record is retained (policy: permanent floor, no deletion to zero).

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- Player rapidly crosses multiple hexes within one tick window (should create all presence records with initial minimal value without double increments in single tick).
- Player disconnects mid-tick (accrual should be based on last confirmed position/time window; no artificial boost or loss).
- Simultaneous presence updates across many adjacent hexes (stress test batching to avoid overloading tick budget).
- Decay processing for thousands of stale tiles (must not exceed performance budget) [Assumption: processed in batches].
- Player attempts to exploit by oscillating across boundary between two hexes each sub-tick (should not grant more than normal continuous presence rate due to rate limiting logic).
- Presence value overflow (cap maximum presence per hex to defined ceiling; further accumulation stops at cap with clear feedback).
- Time skew / clock drift (server authoritative time used; client-provided timestamps ignored).

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST create a presence record the first time a player enters a previously unvisited hex tile.
- **FR-002**: System MUST initialize presence with a non-zero starting value (Assumption: value = 1 unit) and timestamp of creation.
- **FR-003**: System MUST increment a player's presence in the current hex at fixed accumulation intervals while they remain within that hex and are considered "active" (Assumption: active = sending heartbeats/movement within last N seconds).
- **FR-004**: System MUST prevent more than one increment per accumulation interval per hex per player, regardless of micro-movements inside the same tile.
- **FR-005**: System MUST cap presence at a defined maximum per hex (Assumption: 100 units) and stop further increments while at cap.
- **FR-006**: System MUST expose a query/listing of explored hexes and current presence values to the owning player.
- **FR-007**: System MUST provide presence change events (create, increment, decay, cap reached) to the player with bounded latency (Assumption: within 1s of server-side update).
- **FR-008**: System MUST optionally bundle multiple presence updates into a single message if they occur within the same tick to reduce bandwidth (aggregation rule: per player per tick).
- **FR-009**: System MUST apply decay to presence for hexes not visited for a continuous inactivity duration threshold (Assumption: threshold = 24h) reducing value at periodic decay intervals (Assumption: 5% of current value per interval) until floor reached.
- **FR-010**: System MUST enforce a minimum floor presence value (Assumption: floor = 10% of max, rounded up) below which decay will not reduce further; record is never purged automatically (permanent footprint).
- **FR-011**: System MUST resume accumulation (and pause decay) immediately when player re-enters a decaying hex.
- **FR-012**: System MUST ensure presence accumulation uses server-authoritative time only.
- **FR-013**: System MUST prevent exploitation by rapid boundary oscillation (Strategy: track last increment time per hex and require minimum dwell time ≥90% of the accumulation interval for increment eligibility).
- **FR-014**: System MUST allow retrieval of historical presence timeline for a single hex for the last configurable window (Assumption: last 24h) for analytics / UI smoothing (if stored or derived).
- **FR-015**: System MUST log anomalies where update frequency exceeds expected thresholds (possible exploit signal).

### Non-Functional / Constraints (Derived)

- Presence tick processing MUST stay within allocated server tick budget (Assumption: <5% baseline CPU for 10k active presence updates per minute).
- Presence update latency to player MUST be under 1s p95.
- Decay batch job MUST process stale presence entries without causing frame/tick hitches (Assumption: chunked processing <= X ms per batch, distributed over time).
- Data model MUST support at least 1M distinct presence records per shard without performance degradation beyond target latency (indexing / partitioning strategy left for design phase, not specified here).

### Assumptions

- Growth & decay numeric values are placeholders and can be tuned without changing feature scope.
- Presence values are player-specific (no shared faction ownership in this feature scope).
- No PvP contention or conflict mechanics yet; presence is unilateral metric.
- Historical timeline may be derived from delta logs if not stored explicitly.
- Server authoritative coordinate system already exists (from earlier specs) and provides deterministic hex IDs.

### Out of Scope

- Faction / group aggregated presence.
- Territory control bonuses or resource multipliers.
- Leaderboards or comparative presence UI.
- Cross-player visibility of others' presence.
- Persistence eviction / archival policies beyond basic decay.

### Key Entities *(include if feature involves data)*

- **PlayerPresenceRecord**: Represents a player's presence in a single hex. Attributes: playerId, hexId, presenceValue, createdAt, updatedAt, lastIncrementAt, lastVisitedAt, decayState (active|decaying|capped), version.
- **PresenceUpdateEvent**: Transient event surfaced to client summarizing changes (hexId, delta, newValue, reason: create|increment|decay|cap, timestamp, tierAfterChange).
- **PresenceTierDefinition**: (Static config) Defines thresholds mapping numeric presence ranges to display tiers (list of (minValue, tierId, label)).
- **PresenceDecaySchedule**: (Logical concept) Tracks when next decay evaluation should run per record or batch grouping key.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: 95% of first presence creation events appear in the player's client within 1s of entry (instrumented end-to-end latency).
- **SC-002**: Presence increment accuracy variance <= 1 increment per hour compared to theoretical model in load test (i.e., no double counting >0.03% of events under 10k concurrent presence-active tiles).
- **SC-003**: Decay processing completes daily cycle across all stale records within 15 minutes wall-clock while keeping real-time tick loop p95 latency under existing baseline +5%.
- **SC-004**: At least 80% of players with session length >15 minutes explore >=10 new hexes (engagement proxy) after feature launch.
- **SC-005**: <= 0.1% of presence updates flagged as anomalies (spam/oscillation) after anti-exploit rules applied.
- **SC-006**: No data loss incidents: 100% of committed presence increments are durable across a controlled server restart test.

## Authoritative State & Determinism (Constitution P1 & P3)

- Authoritative state touched/created: PlayerPresenceRecord collection keyed by (playerId, hexId); Potential presence config (tiers). Stored within server authoritative state layer.
- Client inputs accepted: Movement inputs producing server-evaluated hex transitions; heartbeats confirming activity. Validation: movement constrained to allowable speed & adjacency; timestamps ignored (server time authoritative).
- Determinism considerations: Presence accumulation deterministic given sequence of verified positions & server tick schedule. No RNG required.
- Replay harness updates needed: YES - extend replay schema to include presence-related events (enterHex, presenceIncrement, presenceDecay) to enable deterministic re-simulation for audit.

## Observability & Performance (Constitution P4)

- New structured log events: presence.create, presence.increment, presence.decay, presence.capReached, presence.anomaly (fields: playerId, hexId, valueBefore, valueAfter, delta, reason, latencyMs).
- Metrics: 
  - Counters: presence_increments_total, presence_decays_total, presence_creates_total, presence_anomalies_total
  - Gauges: active_presence_tiles, capped_presence_tiles
  - Histograms: presence_update_latency_ms, presence_batch_process_duration_ms, hexes_explored_per_session
  - Distribution/Percentiles: increments_per_tick
- Tick budget impact: Estimated <5% at 10k active presence tiles (Assumption: O(1) update per tile per interval with batching).
- Load test requirement: YES - scenario generating 10k simultaneous presence increments and 1M existing records subject to decay sweep.

## Security & Fair Play (Constitution P5)

- Input validation schemas: Movement & heartbeat already validated via existing protocol (extend schema to include presence event types if new messages introduced).
- Anti-cheat / anomaly rules added or impacted: boundary oscillation detection (minimum dwell time), rate limit increments per hex per interval, anomaly logging for rapid multi-hex traversal beyond legitimate speed.
- Data integrity / migration notes: Introduce new presence storage structure; migration script to initialize empty presence collection; no backfill required.
- PII considerations: NO - presence data contains no personally identifiable information beyond internal playerId.

### Resolved Clarifications

1. Presence deletion policy: Permanent floor retained; no automated purge to zero.
2. Minimum dwell time fraction: 90% of interval required for increment eligibility.
3. Decay below floor: Not allowed; floor value is stable and preserved.
