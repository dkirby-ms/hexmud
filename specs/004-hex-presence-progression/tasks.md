# Tasks: Hex Presence Progression

**Input**: Design documents from `/specs/004-hex-presence-progression/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Phase 1: Setup (Shared Infrastructure)
**Purpose**: Establish baseline environment, configuration, and folder scaffolding.

- [ ] T001 Create server room file scaffold in `apps/server/src/rooms/WorldRoom.ts`
- [ ] T002 Add presence config constants to `apps/server/src/config/env.ts` (CAP, FLOOR_PERCENT, DECAY_PERCENT, INACTIVITY_MS, INTERVAL_MS, DWELL_FRACTION)
- [ ] T003 [P] Create client hex map component directory `apps/web/src/components/HexMap/` with placeholder `HexMap.tsx`
- [ ] T004 [P] Define protocol presence message types in `packages/protocol/src/messages/presence.ts`
- [ ] T005 Add placeholder replay harness extension file `apps/server/src/rooms/presenceReplay.ts`
- [ ] T006 Setup migration directory (if not existing) `apps/server/src/migrations/` and placeholder migration file `apps/server/src/migrations/placeholder.txt` (will be replaced)
- [ ] T007 Ensure logging events file prepared for new presence events `apps/server/src/logging/events.ts` (add stubs)
- [ ] T008 Verify existing test setup; add presence test helpers file `apps/server/tests/helpers/presence.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)
**Purpose**: Core infrastructure enabling user stories; must complete before story phases.

- [ ] T009 Implement PlayerPresenceRecord TypeScript interface in `apps/server/src/state/presenceTypes.ts`
- [ ] T010 Implement tier configuration loader `apps/server/src/state/presenceTiers.ts`
- [ ] T011 [P] Implement Zod schemas for presence messages in `packages/protocol/src/messages/presenceSchemas.ts`
- [ ] T012 [P] Add migration `apps/server/src/migrations/20251017_add_player_presence_table.sql`
- [ ] T013 Implement PostgreSQL DAO `apps/server/src/state/presenceDao.ts`
- [ ] T014 Implement decay selection query helper `apps/server/src/state/presenceDecayQuery.ts`
- [ ] T015 Add Redis stub integration decision comment (no Redis initial) in `apps/server/src/state/presenceDao.ts`
- [ ] T016 Implement anomaly detection utility `apps/server/src/ratelimit/presenceAnomaly.ts`
- [ ] T017 Extend replay harness to register presence events in `apps/server/src/rooms/presenceReplay.ts`
- [ ] T018 Add structured log event builders in `apps/server/src/logging/events.ts`
- [ ] T019 Add metrics counters/gauges in `apps/server/src/metrics/adapter.ts` (presence_increments_total, etc.)
- [ ] T020 Add environment variable documentation in `README.md` (presence-specific)
- [ ] T067 Add authoritative time enforcement test `apps/server/tests/unit/presenceAuthoritativeTime.test.ts` (ignore client timestamps, server tick only)
- [ ] T068 Add double-increment prevention test `apps/server/tests/unit/presenceNoDoubleIncrement.test.ts` (FR-004 guard validation)

**Checkpoint**: Foundational complete; proceed to user stories.

---

## Phase 3: User Story 1 - First-Time Exploration & Presence Claim (Priority: P1) 🎯 MVP
**Goal**: Create and increment presence records upon first entry and dwell completion; expose snapshot to player.
**Independent Test**: Fresh player movement across new hexes results in presence creation and increment events visible via snapshot + updates.

### Tests (US1)
- [ ] T021 [P] [US1] Unit test presence creation logic in `apps/server/tests/unit/presenceCreate.test.ts`
- [ ] T022 [P] [US1] Unit test dwell fraction calculation in `apps/server/tests/unit/presenceDwell.test.ts`
- [ ] T023 [US1] Integration test movement → presence increments in `apps/server/tests/integration/presenceIncrement.test.ts`
- [ ] T069 [US1] Unit test cap logic & event emission `apps/server/tests/unit/presenceCap.test.ts`

### Implementation (US1)
- [ ] T024 [P] [US1] Implement presence creation & retrieval in DAO `apps/server/src/state/presenceDao.ts`
- [ ] T025 [P] [US1] Add room state presenceSummary structure in `apps/server/src/rooms/WorldRoom.ts`
- [ ] T026 [US1] Implement accumulation tick (dwell validation ≥90%) `apps/server/src/rooms/WorldRoom.ts`
- [ ] T027 [US1] Implement `presence:requestSnapshot` handler in `apps/server/src/rooms/WorldRoom.ts`
- [ ] T028 [US1] Implement server push `presence:update` messages `apps/server/src/rooms/WorldRoom.ts`
- [ ] T029 [US1] Implement client request & apply snapshot in `apps/web/src/components/HexMap/usePresenceSnapshot.ts`
- [ ] T030 [US1] Implement client listener for update messages in `apps/web/src/components/HexMap/usePresenceUpdates.ts`
- [ ] T031 [US1] Add tier calculation utility `apps/server/src/state/presenceTiers.ts` (update with logic)
- [ ] T032 [US1] Add anti-double-increment guard (interval tracking) `apps/server/src/rooms/WorldRoom.ts`
- [ ] T033 [US1] Add cap check & cap event emission `apps/server/src/rooms/WorldRoom.ts`
- [ ] T034 [US1] Client hex cell rendering basic tier shading `apps/web/src/components/HexMap/HexMap.tsx`
- [ ] T035 [US1] Add loading skeleton while snapshot pending `apps/web/src/components/HexMap/HexMap.tsx`
- [ ] T036 [US1] Update replay harness capture on create/increment/cap `apps/server/src/rooms/presenceReplay.ts`

**Checkpoint**: US1 fully functional & testable independently.

---

## Phase 4: User Story 2 - Presence Visibility & Feedback (Priority: P2)
**Goal**: Real-time visualization updates and tier transitions; user sees timely updates with p95 <1s.
**Independent Test**: Pre-populated presence data renders tiers; updates propagate visually within latency budget.

### Tests (US2)
- [ ] T037 [P] [US2] Unit test tier transition detection `apps/server/tests/unit/presenceTierTransition.test.ts`
- [ ] T038 [P] [US2] Integration test visual update latency measurement `apps/web/tests/integration/presenceLatency.test.ts`
- [ ] T039 [US2] Contract test snapshot message schema `packages/protocol/tests/contract/presenceSnapshot.contract.test.ts`
- [ ] T070 [US2] Contract test update bundling (multiple deltas aggregated) `packages/protocol/tests/contract/presenceBundledUpdates.contract.test.ts`

### Implementation (US2)
- [ ] T040 [P] [US2] Implement tier transition detection event emission `apps/server/src/rooms/WorldRoom.ts`
- [ ] T041 [P] [US2] Add client tier change visual effect (color intensity update) `apps/web/src/components/HexMap/HexMap.tsx`
- [ ] T042 [US2] Add tooltip overlay with numeric value & tier label `apps/web/src/components/HexMap/HexTooltip.tsx`
- [ ] T043 [US2] Implement batching of updates per tick `apps/server/src/rooms/WorldRoom.ts`
- [ ] T044 [US2] Add latency measurement instrumentation (timestamp diff) `apps/web/src/components/HexMap/usePresenceUpdates.ts`
- [ ] T045 [US2] Add map legend component `apps/web/src/components/HexMap/HexLegend.tsx`
- [ ] T046 [US2] Optimize Canvas redraw for changed hexes only `apps/web/src/components/HexMap/HexMap.tsx`

**Checkpoint**: US2 independently testable (requires presence data but not decay mechanics).

---

## Phase 5: User Story 3 - Presence Decay & Re-Engagement (Priority: P3)
**Goal**: Apply decay after inactivity threshold; halt decay and resume growth on re-entry; maintain floor.
**Independent Test**: Simulated inactivity triggers decay events; re-entry pauses decay and increments resume.

### Tests (US3)
- [ ] T047 [P] [US3] Unit test decay computation & floor clamp `apps/server/tests/unit/presenceDecay.test.ts`
- [ ] T048 [P] [US3] Integration test inactivity → decay → re-entry `apps/server/tests/integration/presenceDecayFlow.test.ts`
- [ ] T049 [US3] Replay determinism test for decay vs increments `apps/server/tests/integration/presenceReplayDeterminism.test.ts`
- [ ] T072 [US3] Timeline retrieval unit test & window bounds `apps/server/tests/unit/presenceTimeline.test.ts`
- [ ] T073 [US3] Oscillation anomaly unit test (rapid boundary crossing) `apps/server/tests/unit/presenceOscillationAnomaly.test.ts`

### Implementation (US3)
- [ ] T050 [P] [US3] Implement decay batch processor `apps/server/src/state/presenceDecayProcessor.ts`
- [ ] T051 [US3] Integrate decay processor scheduling (low-frequency) `apps/server/src/server.ts`
- [ ] T052 [US3] Emit decay events as `presence:update` reason 'decay' `apps/server/src/rooms/WorldRoom.ts`
- [ ] T053 [US3] Update replay harness capture for decay events `apps/server/src/rooms/presenceReplay.ts`
- [ ] T054 [US3] Client handler for decay updates (visual subtle fade) `apps/web/src/components/HexMap/usePresenceUpdates.ts`
- [ ] T055 [US3] Implement anomaly detection integration (oscillation events) `apps/server/src/ratelimit/presenceAnomaly.ts`
- [ ] T056 [US3] Add timeline retrieval stub (FR-014) `apps/server/src/state/presenceTimeline.ts`
- [ ] T071 [US3] Implement timeline DAO logic & endpoint message formatting `apps/server/src/state/presenceTimeline.ts`

**Checkpoint**: US3 functional independently (decay logic + re-entry recovery).

---

## Phase 6: Polish & Cross-Cutting Concerns
**Purpose**: Refinements, performance tuning, documentation, security hardening.

- [ ] T057 [P] Add performance load test scenario updates in `scripts/load-test.ts`
- [ ] T058 [P] Add documentation section in `docs/presence-config.md`
- [ ] T059 Refactor shared hex utilities `apps/web/src/components/HexMap/hexUtils.ts`
- [ ] T060 Add accessibility improvements (high-contrast toggle) `apps/web/src/components/HexMap/HexLegend.tsx`
- [ ] T061 Add additional anomaly metrics counters `apps/server/src/metrics/adapter.ts`
- [ ] T062 Security review note update in `specs/004-hex-presence-progression/spec.md` (document no PII)
- [ ] T063 Add integration test for cap event behavior `apps/server/tests/integration/presenceCap.test.ts`
- [ ] T064 Add snapshot diff size measurement logging `apps/server/src/logging/events.ts`
- [ ] T065 Final replay harness verification test `apps/server/tests/integration/presenceReplayFinal.test.ts`
- [ ] T066 Code cleanup & comments in `apps/server/src/rooms/WorldRoom.ts`
- [ ] T074 Consolidated metrics & engagement instrumentation `apps/server/src/metrics/adapter.ts` (histograms: presence_update_latency_ms, presence_batch_process_duration_ms; distribution: increments_per_tick; gauge/counter: hexes_explored_per_session; anomaly ratio evaluation logic emitting percentage)
- [ ] T081 Restart durability integration test (simulate server restart & verify persistence) `apps/server/tests/integration/presenceRestartDurability.test.ts`
- [ ] T083 Floor clamp event logging test (decay attempts below floor) `apps/server/tests/unit/presenceFloorClampLog.test.ts`

---

## Dependencies & Execution Order
- Setup → Foundational → US1 → US2 → US3 → Polish.
- US2 depends on US1 presence data but is separately testable using seeded presence records.
- US3 depends on foundational + presence creation from US1 (for decay targets) but can simulate pre-existing records.

## Parallel Examples
- US1: T024 & T025 can run in parallel; T026 depends on completion of DAO logic and presenceSummary.
- US2: T040, T041, T043 can run in parallel; T042 depends on HexTooltip component file creation.
- US3: T050 & T055 parallel; T051 depends on processor implementation (T050).

## Implementation Strategy
**MVP Scope**: Complete US1 tasks (presence creation + increments + snapshot + basic map rendering). Deploy for early player feedback. Proceed to visualization polish (US2), then decay (US3).

**Task Count Summary**:
- Setup: 8
- Foundational: 14
- US1: 17 (Tests 4, Impl 13)
- US2: 15 (Tests 4, Impl 11)
- US3: 16 (Tests 5, Impl 11)
- Polish: 13
- Total: 84

**Format Validation**: All tasks follow required `- [ ] T### [P]? [US?] Description with file path` pattern.

*End of Tasks*
