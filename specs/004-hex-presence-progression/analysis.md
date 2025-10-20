# Specification Alignment Analysis: Hex Presence Progression

Date: 2025-10-18
Branch: 004-hex-presence-progression
Artifacts Reviewed: spec.md, plan.md, tasks.md, research.md, data-model.md, contracts/

## 1. Method
Mapped each Functional Requirement (FR) and Success Criterion (SC) to existing tasks (T###). Classified coverage as:
- FULL: Clear implementation + at least one test task.
- PARTIAL: Implementation present but missing dedicated test OR test present but logic task missing explicit path.
- GAP: No explicit task found; needs addition.

## 2. Functional Requirements Coverage

| FR | Description | Tasks Mapped | Coverage | Notes / Gaps |
|----|-------------|--------------|----------|--------------|
| FR-001 | Create presence record on first entry | T024 (DAO create), T021 (creation test), T025 (state summary) | FULL | Consider adding explicit field validation test (timestamps). |
| FR-002 | Initialize presence non-zero + creation timestamp | T024, T021 (implicitly) | PARTIAL | No test explicitly asserts timestamp & initial value; add new unit test T0NN. |
| FR-003 | Increment presence on dwell intervals | T026 (accumulation tick), T028 (update push), T022 (dwell fraction calc), T023 (integration increments) | FULL | Load test accuracy later (SC-002). |
| FR-004 | Prevent double increment per interval | T032 (anti-double-increment guard) | PARTIAL | Missing unit/integration test for double increment prevention; add test task. |
| FR-005 | Cap presence at maximum | T033 (cap check/event), T063 (cap event integration test) | PARTIAL | Unit test for cap logic missing; add test task. |
| FR-006 | Query/list explored hexes (snapshot) | T027 (request snapshot), T029 (client apply) | PARTIAL | Need contract test for snapshot schema beyond presenceSnapshot (T039 covers update? It's for snapshot message); verify includes list semantics. Might be sufficient; clarify. |
| FR-007 | Presence change events with latency bound | T028 (update messages), T044 (latency instrumentation), T038 (latency test) | FULL | Latency metrics histogram missing in tasks (see observability gaps). |
| FR-008 | Bundle multiple updates per tick | T043 (batching) | PARTIAL | No test verifying bundling & size; add contract/load test task. |
| FR-009 | Apply decay after inactivity | T050 (processor), T051 (scheduling), T052 (emit decay) T047/T048 tests | FULL | Replay determinism covered by T049. |
| FR-010 | Enforce floor clamp | T047 (unit floor clamp), T050 (processor logic) | FULL | Ensure clamp logic logged (event) - covered by decay events? Add verification in tests. |
| FR-011 | Resume accumulation on re-entry | T048 (integration decay flow) | FULL | Make sure presence increment after re-entry asserted. |
| FR-012 | Server-authoritative time only | (Implicit) T026 uses server tick | GAP | Add explicit task for ignoring client timestamps & unit test. |
| FR-013 | Anti boundary oscillation (≥90% dwell) | T022 (dwell fraction calc), T026 (dwell validation), T016/T055 (anomaly detection integration) | PARTIAL | Need explicit anomaly unit test & scenario test for oscillation exploit prevention. |
| FR-014 | Historical presence timeline retrieval | T056 (timeline retrieval stub) | PARTIAL | Missing implementation details + tests (unit + integration). Add tasks. |
| FR-015 | Log anomalies (frequency thresholds) | T016 (utility), T055 (integration) | PARTIAL | Metrics counters addition T061 but missing unit test verifying anomaly threshold classification. Add task. |

## 3. Success Criteria Coverage

| SC | Description | Tasks Mapped | Coverage | Notes / Gaps |
|----|-------------|--------------|----------|--------------|
| SC-001 | <1s latency for create events (95%) | T044 (instrument), T038 (latency test) | PARTIAL | Need histogram metric task for latency distribution; add new metrics task. |
| SC-002 | Increment accuracy variance <= threshold | T032 (guard), T057 (load test), (missing dedicated accuracy assertion) | GAP | Add load test assertion task to compute theoretical vs actual increments. |
| SC-003 | Decay daily cycle completes in ≤15m without tick impact | T050/T051 (processor), T057 (load test) | PARTIAL | Need performance measurement instrumentation (presence_batch_process_duration_ms histogram) & load test scenario for decay sweep. |
| SC-004 | Engagement metric: ≥10 new hexes for 80% of >15m sessions | (No direct tasks) | GAP | Add metric (hexes_explored_per_session) instrumentation + analysis task. |
| SC-005 | ≤0.1% updates flagged as anomalies | T016 (detection), T061 (metrics counters) | PARTIAL | Need evaluation task computing anomaly ratio post load test. |
| SC-006 | 100% durability across restart test | (No tasks) | GAP | Add integration test simulating restart & verifying persistence & replay determinism. |

## 4. Observability & Metrics Gaps

Spec lists metrics/histograms not all covered by tasks:
- presence_update_latency_ms (histogram) – missing task.
- presence_batch_process_duration_ms (histogram) – missing task.
- hexes_explored_per_session (histogram or gauge) – missing task.
- increments_per_tick distribution – partially implied by T044 but needs explicit metric emission task.

Logging gaps:
- Snapshot diff size measurement addressed by T064 (OK).
- Floor clamp events not explicitly listed; ensure decay events include clamp reason.

Replay harness:
- Presence events capture tasks T036, T053, T065; consider adding explicit test for create+increment+decay sequence determinism before final (currently T049 decay/increment determinism & T065 final verification). Adequate.

## 5. Proposed New / Adjusted Tasks (Accepted & Consolidated)

Accepted additions (metrics consolidated, perf/stress tasks deferred):

| New ID | Phase | Title | Description |
|--------|-------|-------|-------------|
| T067 | Foundational | Authoritative time test | Unit test confirming client timestamps ignored; server tick drives increments (FR-012). |
| T068 | Foundational | Double increment prevention test | Unit test verifying no two increments within one interval per (player,hex) (FR-004). |
| T069 | US1 | Cap logic unit test | Unit test for cap enforcement & event emission (FR-005). |
| T070 | US2 | Update bundling contract test | Contract test for aggregated multi-update message (FR-008). |
| T071 | US3 | Timeline implementation | Implement presenceTimeline DAO & formatting (FR-014). |
| T072 | US3 | Timeline retrieval unit test | Tests window bounds & data correctness (FR-014). |
| T073 | US3 | Oscillation anomaly unit test | Exercise rapid boundary crossing; ensure anomaly flagged (FR-013/FR-015). |
| T074 | Polish | Consolidated metrics instrumentation | Adds latency & decay histograms, increment distribution, engagement gauge, anomaly ratio calc (SC-001–SC-005). |
| T081 | Polish | Restart durability integration test | Simulate restart; verify persistence & replay (SC-006). |
| T083 | Polish | Floor clamp event logging test | Ensures clamp attempts below floor produce log entry (FR-010). |

Deferred tasks (to consider after baseline): prior separate perf/load tasks for increment accuracy, decay sweep throughput, anomaly ratio evaluation, timeline stress (originally T078–T080, T082) are folded into instrumentation or postponed.

## 6. Risk / Ambiguity Findings

| Area | Observation | Recommendation |
|------|-------------|----------------|
| Timeline (FR-014) | Only stub task T056; unclear storage vs derivation | Decide: store periodic snapshots vs reconstruct from events; update data-model & add tasks (T071/T072). |
| Cap Event Timing | Integration test deferred to Polish (T063) may delay early validation | Promote T063 earlier or add unit test T069. |
| Server Time Authority | Implicit only | Add explicit logic comment & test (T067). |
| Dwell Fraction Enforcement | Only dwell calculation test (T022); no exploit scenario test | Add oscillation anomaly test T073. |
| Success Criteria Metrics | Several SCs rely on metrics not instrumented | Add metrics tasks T074–T077, T080. |
| Performance Measurement | Decay duration & increment distribution histograms missing | Add T075, T076, T079. |
| Durability SC-006 | No restart test | Add T081. |

## 7. Prioritized Gap Remediation Order
1. Foundational correctness (T067, T068, T069) before heavy feature build-out to avoid compounding errors.
2. Missing FR coverage (Timeline: T071, T072) prior to US3 completion.
3. Anti-exploit completeness (T073) before load/performance tests to ensure realistic behavior.
4. Metrics instrumentation (T074–T077) before running load tests (T078–T080, T079).
5. Durability & reliability (T081, T083) prior to final verification (T065).
6. Performance/time retrieval stress (T082) optional if timeline likely hot path.

## 8. Summary
Functional coverage is strong for core accumulation & decay loops (FR-001–FR-011). Partial or missing coverage remained for authoritative time, bundling verification, timeline retrieval, anomaly robustness, and metrics. Ten targeted tasks were accepted (with consolidation) to elevate coverage; deferred performance/stress tasks will follow once baseline metrics confirm stability.

Next Step: Confirm acceptance of proposed new tasks; then update `tasks.md` accordingly.

---
Generated by automated analysis tooling.
