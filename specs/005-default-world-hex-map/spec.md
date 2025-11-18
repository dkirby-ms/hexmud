# Feature Specification: Default World Base Map

**Feature Branch**: `005-default-world-hex-map`  
**Created**: 2025-11-16  
**Status**: Draft  
**Input**: User description: "There should be default game world data , with hex map data to allow players to explore and track their presence in the world. The default world should include two major continents separated by oceans, with smaller islands in between. The code for tracking presence should already be implemented in the previous specs. We just need the base game world data."

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

### User Story 1 - Explore Default World Layout (Priority: P1)

A new player joins the game on a fresh deployment and can immediately move through a pre-defined hex world consisting of two major continents, ocean in between, and smaller island chains, without any manual configuration by operators.

**Why this priority**: This is the minimum viable world that makes exploration and presence tracking meaningful. Without a default layout, players cannot experience the core loop and earlier presence features have nothing concrete to operate on.

**Independent Test**: Can be fully tested by starting a clean environment, spawning a test player, and moving along pre-defined paths to confirm that hex tiles exist and connect properly for continents, oceans, and islands, with no reliance on any other new mechanics.

**Acceptance Scenarios**:

1. **Given** a fresh deployment using default configuration, **When** the server starts the game world, **Then** a default hex world is available that includes at least two distinct landmasses (Continents A and B) separated primarily by ocean tiles.
2. **Given** a player spawned on Continent A, **When** they move step by step toward the ocean boundary, **Then** each movement lands on a valid hex tile that transitions from inland land to coastal land to ocean tiles according to the default layout.
3. **Given** a player who continues across the ocean in a valid direction, **When** they follow a defined crossing route, **Then** they eventually reach Continent B via a path of ocean and island tiles with no gaps in the hex map.
4. **Given** test paths defined for internal QA (e.g., from a starting region on Continent A to a specific island chain), **When** those paths are executed in an automated test, **Then** every coordinate in the path resolves to an existing hex with the expected terrain type (land/ocean/island).

---

### User Story 2 - Presence Tracking on Default Map (Priority: P2)

As a player explores the default world, the existing presence tracking logic (from prior specs) records their visits to each hex tile so that their exploration history is meaningful from day one.

**Why this priority**: Presence tracking is already implemented; the default map must be compatible with it so that players gain progression and history from exploring this world, not just raw movement.

**Independent Test**: Can be tested by using existing presence features with the new default world layout: moving a player across sample routes and verifying that presence data is created and updated for those coordinates without changing the underlying presence mechanics.

**Acceptance Scenarios**:

1. **Given** a player with no previous activity, **When** they move through several hexes on Continent A, **Then** presence records are created for those hex coordinates using the existing presence system.
2. **Given** the same player reconnects in a later session, **When** they move again within the same regions, **Then** presence continues from their existing data and does not fail due to missing world tiles.
3. **Given** two different players exploring the same part of the default world, **When** they traverse similar paths, **Then** their presence records are independent but all referenced hex tiles are the same map locations.

---

### User Story 3 - Operators Rely on Stable Default Map (Priority: P3)

Game operators and designers can rely on a stable, versioned default world layout when testing, monitoring, or extending the game, without needing to handcraft world data for each environment.

**Why this priority**: A predictable default world accelerates development, QA, and live operations. It also becomes the baseline for future content and balancing.

**Independent Test**: Can be tested by starting controlled environments (e.g., local, staging) and verifying that the same world layout (continents, oceans, islands) is loaded consistently across them, with a recorded version identifier.

**Acceptance Scenarios**:

1. **Given** two separate environments configured to use the default world, **When** they both start, **Then** the world layout (shape of continents, ocean passages, island locations) is functionally identical.
2. **Given** a specific world version identifier, **When** operators inspect world metadata, **Then** they can confirm which version of the default layout is in use in a given environment.
3. **Given** a deployment where the default world configuration is missing or invalid, **When** the server starts, **Then** it fails clearly with diagnostics indicating that required default world data is not present instead of starting with a broken map.

---

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- Player reaches the logical edge of the defined default world and attempts to move beyond it (e.g., off-map coordinates).
- Player attempts to move into hex tiles that are marked as non-navigable (e.g., deep ocean or blocked regions) within the world definition.
- Multiple players simultaneously exploring remote parts of the world where continents, oceans, and islands meet (to ensure world data is consistent and not partially loaded).
- A deployment starts with a partially missing or corrupted default world definition file or record.
- The default world layout is updated between releases in ways that move or reshape continents or islands (impacting stored presence and spawn locations). Major layout changes are treated as "world reset" events: presence in affected regions is reset and players are relocated to designated safe spawn regions in the new layout.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST include a bundled default world definition that is automatically loaded on fresh deployments without manual data entry.
- **FR-002**: The default world definition MUST describe a hex-based map that includes at least two major, contiguous land regions (continents) separated primarily by ocean tiles.
- **FR-003**: The default world definition MUST include one or more chains of smaller landmasses (islands) between the two major continents that are reachable through valid paths from at least one continent.
- **FR-004**: System MUST ensure every navigable coordinate within the default world resolves to a well-defined hex tile with a terrain type (e.g., land, ocean, island/coastal) such that player movement can be validated against this data.
- **FR-005**: System MUST define one or more designated spawn regions on Continent A (or a chosen starting continent) where new players can appear safely and begin exploring.
- **FR-006**: System MUST ensure that existing presence tracking logic can create and maintain presence records for any hex tile within the default world without encountering missing or undefined tile references.
- **FR-007**: System MUST persist the default world definition and any world metadata in a way that survives server restarts so that the layout remains consistent over time.
- **FR-008**: System MUST expose a way (for internal tools or automated tests) to query which region (e.g., Continent A, Continent B, ocean, specific island chain) a given hex coordinate belongs to.
- **FR-009**: System MUST validate the default world definition on startup, including verifying that the two continents, oceans between them, and at least one island chain exist as required.
- **FR-010**: If validation of the default world definition fails at startup, System MUST fail to start the world and log clear diagnostic information about what is missing or inconsistent.
- **FR-011**: System MUST define and apply a boundary policy for moves that would leave the defined default world: moves that would target coordinates outside the world are rejected and the player remains in their current hex, with clear feedback that they have reached the edge of the world.
- **FR-012**: System MUST provide a stable identifier and version metadata for the default world layout so that environments can be compared and migrations can be planned.

### Key Entities *(include if feature involves data)*

- **WorldDefinition**: Represents the overall default world configuration. Attributes (conceptual): worldId (e.g., "default"), name, description, version, coordinate system description (hex grid parameters), list of regions, boundary policy descriptor, createdAt/updatedAt.
- **HexTile**: Represents a single hex in the default world. Attributes: coordinate identifier, terrain type (land, ocean, island/coastal), regionId (e.g., Continent A, Continent B, Ocean, Island Chain X), movement flags (navigable / non-navigable), display label for notable locations.
- **WorldRegion**: Logical grouping of hex tiles such as continents, oceans, and island chains. Attributes: regionId, name, type (continent/ocean/island-chain), definitions of member tiles or generation rules, narrative description.
- **SpawnRegion**: Subset of hex tiles where new players may be placed at start. Attributes: spawnRegionId, associated regionId, list or description of eligible spawn tiles, any constraints (e.g., minimum distance from edge).
- **PlayerPresenceRecord** (from prior specs): Tracks a player's presence in a specific HexTile; this feature requires that such records can exist for all tiles in the default world but does not change their internal structure.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: On a fresh deployment with default configuration, 100% of new players can spawn into and move within at least one starting region of the default world without encountering missing or invalid hex tiles.
- **SC-002**: In automated path tests, at least one path from Continent A to Continent B via ocean and island tiles is verified end to end with no invalid or undefined coordinates.
- **SC-003**: For 95% of player sessions longer than 15 minutes in environments using only the default world, players have visited at least 20 distinct hex tiles, indicating that the world is navigable and engaging.
- **SC-004**: In production logs over a representative period, no more than 0.5% of movements within the defined world bounds result in errors due to invalid coordinates.
- **SC-005**: During controlled restart tests, 100% of world layout and region metadata (including continent and island definitions) remains consistent across restarts.

## Authoritative State & Determinism (Constitution P1 & P3)

- Authoritative state touched/created: Default `WorldDefinition`; collection of `HexTile` records for the default world; region assignments for continents, oceans, and island chains; spawn region definitions. Existing `PlayerPresenceRecord` entries reference these tiles.
- Client inputs accepted: Movement and navigation inputs that imply transitions between hex coordinates. Validation rules: moves must target neighboring hexes that exist in the default world and are marked as navigable; moves outside the defined world follow the chosen boundary policy.
- Determinism considerations: Given the same default world version and sequence of validated movement inputs, the set of reachable tiles and region transitions is deterministic. If any procedural or random aspects are used to define the layout, they MUST be seeded and versioned so that a given world version always produces the same map.
- Replay harness updates needed: YES – replays that exercise exploration should verify that the same coordinate sequence corresponds to the same terrain and region types for a given world version.

## Observability & Performance (Constitution P4)

- New structured log events: `world.default.load.start`, `world.default.load.success`, `world.default.load.failure` (with reason); `world.default.validation.error` (missing continents/oceans/islands); `world.default.boundary.moveRejected`.
- Metrics (counters/gauges/histograms): Counters for successful and failed default world loads; counter for boundary-policy rejections; gauges for number of hex tiles and regions loaded; histogram for world load/validation time at startup.
- Tick budget impact (estimate % of budget at target load): Lookup of hex tiles and regions should be lightweight; additional runtime cost is limited to world data lookups during movement and presence operations and SHOULD remain negligible relative to existing presence processing.
- Load test requirement: YES – run scenarios where many simulated players traverse long routes across continents, oceans, and islands to confirm that world data lookups and validation checks remain within acceptable latency and do not introduce timeouts or frame hitches.

## Security & Fair Play (Constitution P5)

- Input validation schemas: Movement-related inputs must be validated to ensure they reference only legal hex coordinates in the default world and respect adjacency and terrain rules (e.g., cannot move into non-navigable tiles).
- Anti-cheat / anomaly rules added or impacted: The fixed default world layout enables distance- and step-based checks for implausible movement (e.g., skipping across large ocean distances in too few steps) using the known topology.
- Data integrity / migration notes: Any future changes to the default world layout that affect continent shapes, island positions, or spawn regions MUST include a documented approach for handling existing `PlayerPresenceRecord` data and existing characters, treating major layout changes as world-reset events where affected presence is reset and characters are moved to safe spawn regions.
- PII considerations: NO – world and hex data do not contain personal information. Presence and movement records reference internal player identifiers only.

### Assumptions

- Presence tracking mechanics (creation, increment, decay) are already implemented and tested in prior features; this feature only ensures compatible world data.
- The default world is shared by all players and environments using the "default" configuration unless a future feature introduces multiple world templates.
- Only one default world layout is in scope here; user-created or dynamically generated worlds are not part of this feature.

### Out of Scope

- Designing the numeric rules of presence progression (already handled in previous specs).
- Custom world editors or runtime editing tools.
- Random map generation or per-player procedural worlds.
- Region-specific gameplay bonuses, events, or narrative content attached to specific continents or islands.
