# Research: Hex Presence Progression

## Overview
This document resolves all Technical Context unknowns and records decisions, rationale, and alternatives considered for implementing player-specific hex presence.

## Decisions

### 1. Presence State Representation (Room State vs Custom Messages)
- **Decision**: Use hybrid approach: minimal aggregate presence summary (tiers + hexIds) embedded in room state for efficient diffing; detailed deltas (value changes, anomalies) sent via custom presence update messages.
- **Rationale**: Full embedding of all numeric values inflates room state and patch sizes. Pure custom messages increases complexity for late joiners. Hybrid balances join snapshot simplicity and bandwidth efficiency.
- **Alternatives Considered**:
  - Full room state embedding: Simple for clients but heavy; potential performance degradation with thousands of tiles.
  - Only custom messages: Requires separate fetch on join; risk of desync if missed messages.

### 2. Rendering Approach (Canvas vs DOM)
- **Decision**: Use Canvas 2D for hex grid rendering with React-managed overlay components (tooltips, panels).
- **Rationale**: Large hex grid benefits from batched draw operations; DOM approach with thousands of nodes harms performance and memory. Canvas allows dynamic coloring and potential future effects (fog, transitions) efficiently.
- **Alternatives Considered**:
  - DOM (CSS Grid / absolutely positioned divs): Easier accessibility but likely poor performance at scale (>5k hexes).
  - WebGL: Overkill for current static shading; higher implementation complexity.

### 3. Viewport Strategy (Virtualized Infinite Scroll vs Fixed Region)
- **Decision**: Fixed initial viewport with panning (drag) and zoom; implement cell culling outside visible bounds using Canvas re-draw, not full infinite scroll virtualization yet.
- **Rationale**: Early presence feature focuses exploratory loop; infinite scroll adds complexity before scale demands proven. Panning/zoom supplies necessary navigation.
- **Alternatives Considered**:
  - Infinite scroll: More complex coordinate management; benefits unclear until world size beyond performance threshold.
  - Static unzoomed region only: Limits exploration feel.

### 4. Redis Usage for Decay Scheduling
- **Decision**: Avoid Redis for first iteration; rely on DB timestamps + batched queries for decay. Defer Redis introduction until performance profiling indicates need.
- **Rationale**: Reduces moving parts; ensures deterministic decay based on persisted data; avoids premature optimization.
- **Alternatives Considered**:
  - Redis scheduling keys: Lower query cost but adds operational dependency and eventual consistency risks.
  - In-memory queues: Risk of lost scheduling on crash.

### 5. Dwell Interval Mechanics
- **Decision**: Dwell requirement enforced server-side: track entry timestamp per hex; increment only if (timeInHex / intervalDuration) >= 0.9.
- **Rationale**: Directly supports anti-oscillation; simple ratio logic; deterministic.
- **Alternatives Considered**:
  - Movement sample counting: More granular but higher data volume.
  - Speed threshold alone: Insufficient to prevent micro-boundary exploits.

### 6. Presence Increment Interval
- **Decision**: Base interval = 10s with configurable server constant.
- **Rationale**: Balances feedback cadence (not too spammy) with progression pacing; aligns with typical casual exploration loops.
- **Alternatives Considered**:
  - 5s interval: More responsiveness, higher traffic.
  - 30s interval: Too slow feedback, may reduce engagement.

### 7. Persistence Schema Strategy
- **Decision**: Single table `player_presence` (player_id, hex_id, presence_value, created_at, updated_at, last_visited_at, last_increment_at, decay_state) with composite PK (player_id, hex_id).
- **Rationale**: Simplicity; fast lookup per player; composite index suits queries. Future partitioning by region possible.
- **Alternatives Considered**:
  - Separate timeline table: Deferred until analytics demands historical granularity.
  - Wide document store JSON column: Harder for incremental queries.

## Clarifications Resolved
- Presence state hybrid representation chosen.
- Rendering will use Canvas.
- Viewport uses panning/zoom fixed region.
- Redis deferred; DB timestamps only.
- All prior NEEDS CLARIFICATION items now resolved.

## Impact Summary
- No additional high-frequency loop beyond existing tick.
- Moderate new table migration required.
- Adds custom message type: presenceUpdate.
- Replay harness extended to include presence events.

## Next Steps
1. Define data model (`data-model.md`).
2. Draft protocol contracts (messages & optional REST endpoints for analytics).
3. Prepare quickstart instructions for integrating presence into client.

## References
- Colyseus docs: authoritative room schema and patch optimization.
- React Canvas patterns for high-density grids (deferred direct citation; internal knowledge).

*End of Research*
