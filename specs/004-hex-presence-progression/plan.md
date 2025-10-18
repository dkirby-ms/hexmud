# Implementation Plan: Hex Presence Progression

**Branch**: `004-hex-presence-progression` | **Date**: 2025-10-17 | **Spec**: `specs/004-hex-presence-progression/spec.md`
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement player-specific presence accumulation, visualization, and decay for explored hex tiles in the world. Server authoritative (Colyseus rooms) track per-player per-hex presence state, incrementing on dwell intervals and decaying after inactivity thresholds. Web client (React + Canvas) renders hex map with presence tiers and real-time updates via hybrid room state summary + custom presence update messages. Permanent floor (no record deletion); anti-exploit via high dwell time (≥90%) requirement and anomaly logging (oscillation/rate). Research resolved state representation, rendering, viewport, and scheduling strategy (see `research.md`).

**Phase Status**:
- Phase 0 (Research): COMPLETE
- Phase 1 (Data Model, Contracts, Quickstart): COMPLETE
- Phase 2 (Task breakdown) pending via `/speckit.tasks`.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript (strict) Node.js 22 LTS (repo standard)  
**Primary Dependencies**: Colyseus (rooms/state sync), Zod (message validation), React + Vite (web UX), Logging (existing logger), Future: PostgreSQL (persistence), Redis (optional for decay batching)  
**Storage**: PostgreSQL (PlayerPresenceRecord table), Redis (optional ephemeral decay scheduling keys)  
**Testing**: Vitest (unit/integration), add replay determinism harness extension for presence events; load test script (scripts/load-test.ts) extended  
**Target Platform**: Linux server backend; Web SPA (desktop browser primary)  
**Project Type**: Monorepo multi-app (apps/server + apps/web + packages/protocol)  
**Performance Goals**: ≤300ms p95 presence update delivery; <5% tick CPU at 10k active presence tiles; stable memory growth for 1M presence records  
**Constraints**: Dwell time ≥90% interval; single increment per interval per (player,hex); decay batch MUST not exceed 5% tick budget; message payload size (presence updates) aggregated per tick  
**Scale/Scope**: Target 5k concurrent players; each exploring average 50 new hexes per session; total presence records potential 250k/day; design for 1M retained records before archival strategy required.

### Server Design (Colyseus)
- Extend existing room (or introduce `WorldRoom`) to manage presence state keyed by playerId+hexId.
- Hybrid representation: minimal per-hex presence tier + hexId list embedded in room state; detailed numeric deltas & anomaly events via custom `presenceUpdate` messages.
- Accumulation via existing server tick with dwell validation (≥90% interval).
- Decay processing: low-frequency batch job using DB timestamps (no Redis in initial iteration) with chunked queries.

### Web UX
- Hex map component rendered using Canvas 2D for grid cells (performance) with React overlay components (tooltips, info panels).
- Live updates via room state diff (tier changes) plus custom `presenceUpdate` messages for numeric changes.
- Tooltip/overlay shows numeric value + tier label on hover/focus.
- Viewport: Fixed initial map with pan + zoom; no infinite scroll yet; Canvas redraw culls off-screen hexes.

### Unknowns (Resolved via research.md)
None pending.

### Initial Risks
- Large room state growth if embedding all presence records → may exceed Colyseus patch diff efficiency.
- Canvas performance vs accessibility trade-offs.
- Decay batch spikes if not chunked.

### Acceptance Test Hooks
- API/room join returns baseline presence list.
- Presence increment events observable in integration test with time mocking.
- Decay simulation via forced inactivity interval.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design and before merge.*

List each core principle (P1–P5) with pass/fail + evidence:

| Principle | Description (summary) | Status | Evidence / Notes |
|-----------|-----------------------|--------|------------------|
| P1 | Authoritative Server Consistency | PASS | Presence maintained only server-side; client sends movement intents validated server-side. |
| P2 | Horizontal Scalability & Stateless Edges | PASS | Presence persistence in PostgreSQL; room holds transient increments only; design considers sharding by world region. |
| P3 | Deterministic Simulation & Reproducibility | PASS | Accumulation deterministic (time intervals + dwell rule); plan includes replay harness extension for presence events. |
| P4 | Lean Observability & Performance Budgets | PASS | Reuse existing tick; no new high-frequency loop; custom logs limited to anomalies & cap events (<5 new events). |
| P5 | Security, Fair Play & Data Integrity | PASS | Input validation via existing movement schema + anti-oscillation rules; no PII; decay logic server-only. |

Performance & Resource Impact Summary:
- Tick budget impact: Estimated <5% CPU at 10k active presence increments.
- Custom high-frequency loop introduced: NO (extend existing heartbeat/tick).
- Added custom metrics/logs (justify if added): presence.create, presence.increment, presence.decay, presence.capReached, presence.anomaly (support debugging & SC metrics).
- Schema migrations: YES (migration file: YYYYMMDD_add_player_presence_table.sql). Exact date TBD.
- Redis keys (namespace + TTL): None initial (DB timestamps only); Redis deferred.

Waivers (if any): Reference Complexity Tracking table.

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: Use existing monorepo apps/server for backend Colyseus logic (extend `rooms/PlaceholderRoom.ts` or create `rooms/WorldRoom.ts`) and apps/web for React hex map components (`components/HexMap/`). Protocol additions in `packages/protocol`. No new top-level packages until reuse emerges.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
