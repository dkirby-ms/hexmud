---
description: "Tasks for implementing Default World Base Map feature"
---

# Tasks: Default World Base Map

**Input**: Design documents from `/specs/005-default-world-hex-map/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: The spec mentions load tests and replay validation but does not mandate a pure TDD approach. We'll include targeted test tasks where they materially help validate each story.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm basic project and database setup needed before adding world data.

- [x] T001 Confirm server database connection configuration for PostgreSQL in `apps/server/src/config/env.ts`
- [x] T002 [P] Document default world DB tables and migrations location in `docs/presence-config.md` or a new section in `docs/presence-config.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema and world-loading infrastructure that MUST be complete before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Create SQL migration for world tables (`world_definition`, `world_region`, `world_hex_tile`, `world_spawn_region`) in `apps/server/src/migrations/005_default_world_base_map.sql`
- [x] T004 [P] Add TypeScript types/interfaces for world entities (`WorldDefinition`, `WorldRegion`, `WorldHexTile`, `WorldSpawnRegion`) in `apps/server/src/world/types.ts`
- [x] T005 [P] Implement world database access layer (queries for definitions, regions, tiles, spawn regions) in `apps/server/src/world/repository.ts`
- [x] T006 Implement world module bootstrap entry point that loads and validates default world on server startup in `apps/server/src/world/index.ts`
- [x] T007 Wire world bootstrap into main server startup sequence in `apps/server/src/server.ts`
- [x] T008 [P] Add logging helpers and metrics counters for world load and validation events in `apps/server/src/logging/events.ts`
- [x] T009 [P] Add configuration flag(s) for world key and boundary policy defaults in `apps/server/src/config/env.ts`

**Checkpoint**: World schema, data-loading, and validation infrastructure ready; user stories can now be implemented using the world module.

---

## Phase 3: User Story 1 - Explore Default World Layout (Priority: P1) 🎯 MVP

**Goal**: A new player can spawn into and traverse a bundled default hex world with two continents, oceans between them, and island chains, with all coordinates backed by world data.

**Independent Test**: In a fresh environment, spawn a test player and follow predefined paths across continents, oceans, and islands; all moves must land on valid tiles with expected terrain and no missing coordinates.

### Implementation for User Story 1

- [x] T010 [P] [US1] Define default world seed data (continents, oceans, island chains, tiles, spawn regions) in `apps/server/src/world/defaultWorldSeed.json`
- [x] T011 [P] [US1] Implement seed script to import default world seed data into PostgreSQL in `apps/server/src/world/seedDefaultWorld.ts`
- [x] T012 [US1] Integrate seed script with migration or bootstrap flow so fresh deployments always have the default world in `apps/server/scripts/bootstrap.ts` or equivalent
- [x] T013 [US1] Implement world validation logic (continents, oceans, island chains invariants) in `apps/server/src/world/validator.ts`
- [x] T014 [US1] Implement in-memory indices and lookup helpers for tiles and regions in `apps/server/src/world/index.ts`
- [x] T015 [US1] Expose helper to select a spawn hex from configured spawn regions in `apps/server/src/world/index.ts`
- [x] T016 [US1] Ensure movement logic uses world lookups to validate tile existence and navigability in `apps/server/src/rooms` movement handlers (exact file TBD based on existing movement implementation)
- [x] T017 [US1] Add QA helper paths and internal test utilities for continent-ocean-island traversal in `apps/server/tests/integration/world/defaultWorldPaths.test.ts`

**Checkpoint**: At this point, a fresh deployment loads the default world, validates its structure, and allows exploration across continents, oceans, and islands without missing tiles.

---

## Phase 4: User Story 2 - Presence Tracking on Default Map (Priority: P2)

**Goal**: Existing presence tracking logic records visits to any hex tile in the default world without schema changes or missing tile references.

**Independent Test**: Using existing presence features, move a player through sample routes on the default world and verify presence records are created/updated correctly for all visited coordinates.

### Implementation for User Story 2

- [x] T018 [P] [US2] Add world-module lookup call into presence-record creation path to assert target tile exists before recording presence in `apps/server/src/state/presence` (exact file TBD based on existing presence implementation)
- [x] T019 [US2] Ensure presence logic gracefully handles attempts to record presence for non-existent or non-navigable tiles by rejecting the movement earlier in `apps/server/src/rooms` movement handlers
- [x] T020 [P] [US2] Add integration test that walks a player across sample routes and verifies presence records for each coordinate using default world data in `apps/server/tests/integration/presence/presenceOnDefaultWorld.test.ts`
- [x] T021 [US2] Add regression test ensuring no schema changes to `PlayerPresenceRecord` are required for the default world in `apps/server/tests/unit/presence/presenceSchemaCompatibility.test.ts`

**Checkpoint**: Presence tracking operates correctly on the default world using existing schema and records visits for all valid tiles.

---

## Phase 5: User Story 3 - Operators Rely on Stable Default Map (Priority: P3)

**Goal**: Operators and developers can rely on a stable, versioned default world layout across environments and inspect world metadata and layout via internal tools.

**Independent Test**: Start multiple environments and verify that the same default world layout and version metadata are loaded; optional internal endpoints can be used to inspect and compare layouts.

### Implementation for User Story 3

- [x] T022 [P] [US3] Expose world metadata accessor (world key, name, version, boundary policy) from world module in `apps/server/src/world/index.ts`
- [x] T023 [US3] Implement internal API endpoint `GET /worlds/default` to return world metadata, aligned with contracts, in `apps/server/src/handlers/world/defaultWorldMetadata.ts`
- [x] T024 [P] [US3] Implement internal API endpoint `GET /worlds/default/regions` to list regions, aligned with contracts, in `apps/server/src/handlers/world/listRegions.ts`
- [x] T025 [P] [US3] Implement internal API endpoint `GET /worlds/default/tiles` with optional `regionKey` filter, aligned with contracts, in `apps/server/src/handlers/world/listTiles.ts`
- [x] T026 [P] [US3] Implement internal API endpoint `GET /worlds/default/spawn-regions` aligned with contracts in `apps/server/src/handlers/world/listSpawnRegions.ts`
- [x] T027 [US3] Add version metadata checks in startup logging to confirm which world version is active in `apps/server/src/logging/logger.ts`
- [x] T028 [US3] Add integration test verifying that two environments with the same seed produce identical world layouts and metadata in `apps/server/tests/integration/world/worldStability.test.ts`

**Checkpoint**: Operators can inspect and rely on a stable, versioned default world layout via internal APIs and logs.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements affecting multiple user stories and overall robustness.

- [x] T029 [P] Review and refine world-related logging and metrics to match spec events in `apps/server/src/logging/events.ts`
- [x] T030 [P] Add additional unit tests for world module helpers and validators in `apps/server/tests/unit/world/worldModule.test.ts`
- [x] T031 Perform code cleanup and refactoring for world-related modules in `apps/server/src/world/`
- [x] T032 [P] Update feature documentation and quickstart validation steps in `specs/005-default-world-hex-map/quickstart.md`
- [ ] T033 Run manual and automated load tests for world traversal and boundary rejections using `scripts/load-test.ts`
  - 2025-02-14: Attempted `pnpm load:test -- --scenario placeholder --concurrency 5 --iterations 1 --session-ms 1000`; every worker failed with `ECONNREFUSED 127.0.0.1:2567` because no game server (and therefore no world data) was running locally. Re-run after starting the Colyseus server against a PostgreSQL instance seeded with the default world.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories.
- **User Stories (Phase 3+)**: All depend on Foundational phase completion.
  - User stories can then proceed in parallel (if staffed).
  - Or sequentially in priority order (P1 → P2 → P3).
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories.
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Depends on basic world lookups from User Story 1 for meaningful presence paths.
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Depends on world metadata and structure from User Story 1.

### Within Each User Story

- Seed and schema tasks before queries and runtime helpers.
- World helpers before movement/presence integrations.
- Internal APIs after core world model is available.
- Tests validate behavior after implementation but can be written earlier as needed.

### Parallel Opportunities

- Setup tasks T001–T002 have no ordering constraints and can run in parallel.
- Foundational tasks T004, T005, T008, T009 can be done in parallel after T003 is defined.
- Within User Story 1, T010–T011 can proceed in parallel before integration steps.
- Within User Story 2, T018 and T020 can be developed in parallel, then integrated by T019 and T021.
- Within User Story 3, endpoint implementations T024–T026 can proceed in parallel once world metadata accessor is available.
- Polish tasks T029, T030, T032, T033 can often be parallelized near the end.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: Run integration tests for default world load and traversal; confirm no missing tiles and correct terrain classification.
5. Deploy/demo if ready.

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready.
2. Add User Story 1 → Test independently → Deploy/Demo (MVP).
3. Add User Story 2 → Test independently → Deploy/Demo.
4. Add User Story 3 → Test independently → Deploy/Demo.
5. Each story adds value without breaking previous stories.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together.
2. Once Foundational is done:
   - Developer A: User Story 1 (world seeding, validation, movement integration).
   - Developer B: User Story 2 (presence integration, presence tests).
   - Developer C: User Story 3 (internal world APIs, stability tests).
3. Stories complete and integrate independently.

---

## Notes

- [P] tasks target different files and have minimal dependencies.
- [Story] label maps task to specific user story for traceability.
- Each user story is independently completable and testable given the foundational world module.
- Commit after each task or logical group to keep changes reviewable.
- Follow the spec and plan documents for invariants and validation rules.
