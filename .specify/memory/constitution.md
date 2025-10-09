<!--
Sync Impact Report
Version change: 1.0.0 → 1.1.0
Modified principles:
  - Principle 4 renamed/relaxed: "Observability, Performance Budgets & Load Protection" → "Lean Observability & Performance Budgets"
Added sections: None
Removed sections: None
Templates requiring updates:
	- .specify/templates/plan-template.md ✅ minor language still compatible (gate wording implicit)
	- .specify/templates/tasks-template.md ✅ no change required (foundational logging still valid)
	- .specify/templates/spec-template.md ✅ still aligned (sections remain applicable)
	- .specify/templates/checklist-template.md ✅ no change needed
	- .specify/templates/agent-file-template.md ⚠ regenerate after next plan to reflect new principle title
Follow-up TODOs: None
Rationale for MINOR bump: Material change in a principle (relaxation & rename) without adding/removing total principle count; gating semantics simplified but backwards-compatible for existing instrumentation.
-->

# HexMUD Constitution

## Core Principles

### 1. Authoritative Server Consistency (NON-NEGOTIABLE)
All game state that affects fairness or shared world progression MUST originate from and be validated by the authoritative backend server. Clients are considered untrusted visualizers and input sources only. Any client-supplied state (e.g., position, action intent) is treated as a request, never a source of truth. Divergence detection (e.g., position reconciliation) MUST be implemented before exposing new real‑time mechanics. No feature may ship that allows client-side prediction to create irreversible authoritative changes without server confirmation.

### 2. Horizontal Scalability & Stateless Session Edges
Gameplay session routing and room lifecycle MUST allow horizontal scaling across processes and nodes without single-machine affinity. Room processes MUST keep only transient, reconstructable state in memory; durable state MUST persist in PostgreSQL (authoritative world and user progression) or explicitly ephemeral in Redis (caches, matchmaking queues, rate limit tokens). Sticky sessions MAY be used only for the lifespan of a room instance; cross-room operations MUST be idempotent and retry-safe. Scaling decisions (spin up/down) must not require code changes.

### 3. Deterministic Simulation & Reproducibility
Simulation logic that influences competitive outcomes MUST be deterministic given (ordered inputs + seed + version). Randomness MUST be seed-controlled and recorded per tick/frame. A replay test harness MUST be added when introducing/altering core simulation loops (input log → identical resulting state hash). Data model migrations MUST preserve ability to replay historical logs for at least one MINOR version window.

### 4. Lean Observability & Performance Budgets
We leverage Colyseus built‑in lifecycle events (`create`, `dispose`, `join`, `leave`, `lock`, `unlock`), debug namespaces (`colyseus:*`), matchmaker stats (roomCount, global CCU), and optional `@colyseus/monitor` for baseline insight. Additional custom instrumentation is ONLY required when:
	- Introducing a new high‑frequency simulation loop outside Colyseus' standard `setSimulationInterval`.
	- Adding logic that materially impacts tick time (>5% projected CPU) OR introduces network fan‑out patterns (e.g., broadcasting large payloads).
	- Requiring replay or anomaly analysis that built‑in logs cannot support (then add structured event logs or metrics).
Minimum required signals per feature touching simulation:
	- Confirm Colyseus monitor/room events are enabled in the target environment OR provide a justification if disabled.
	- If a new custom loop is added: record tick duration sample (histogram or simple p95 in log every N seconds) OR justify omission.
Performance acceptance (initial targets unchanged): p95 end‑to‑end action acknowledgement ≤ 300ms under stated concurrency goals. Degradation risk features must include a short load test plan, but we do not mandate per‑code‑path metrics if Colyseus surface already covers visibility. Use a structured logger (pino/winston) only if/when log aggregation backend is introduced; until then, console output with Colyseus namespaces is acceptable.

### 5. Security, Fair Play & Data Integrity
All external inputs (client messages, HTTP endpoints) MUST be validated against schema contracts before simulation use. Anti-cheat checks (anomaly detection, impossible movement, action rate) MUST run server-side and be auditable. Secrets/config values MUST come from environment management (no hardcoded credentials). Database migrations MUST be forward-only, reversible via additive corrective migration (no destructive rollbacks in production). Personally identifying information (PII) storage MUST be minimized and documented in the spec if required.

## Technical Standards & Constraints

**Language**: TypeScript (strict mode) on Node.js LTS.  
**Real-Time Session Framework**: Colyseus for room/session lifecycle.  
**Database**: PostgreSQL (transactional, relational source of truth).  
**Cache / Fast Ephemeral State**: Redis (no authoritative data; TTL-driven where possible).  
**Frontend**: Vite + React for user client application.  
**Infrastructure**: Processes MUST be twelve-factor: config via env, logs to stdout, stateless except in-room transient state.  
**Schema & Migrations**: Use a migration tool (e.g., Prisma / Knex / node-pg-migrate) with immutable historical migration files.  
**Message Protocols**: Define schema (Zod/protobuf/custom) for all inbound/outbound messages; reject on validation failure.  
**Performance Targets (Initial)**: Support 5k concurrent connected clients across horizontally scaled nodes with ≤ 150ms end-to-end action acknowledgement median, ≤ 300ms p95.  
**Testing Baselines**: Replay determinism tests for simulation layers; contract tests for room join/leave flows; integration tests for persistence boundaries; load test scripts for critical hotspots prior to GA of performance-sensitive features.  
**Caching Discipline**: Redis keys MUST have namespace prefixes (e.g., `matchmaking:*`, `session:*`) and explicit TTL unless documenting rationale for permanence.

## Development Workflow & Quality Gates

1. Spec → Plan → Tasks progression MUST reference Constitution gates before implementation starts.  
2. A feature plan MUST enumerate: authoritative state touched, scaling assumptions, performance budget impact, observability additions, and migration requirements.  
3. Tasks generation MUST group by user story and include mandatory test tasks for simulation, contracts, and schema changes.  
4. PR Quality Gates (all REQUIRED unless marked N/A with justification):  
	 - Lint & TypeCheck: no `any` leakage in public interfaces.  
	 - Determinism: new/changed simulation passes replay harness (if simulation code touched).  
	 - Performance: if a new high‑frequency loop or >5% overhead change → provide evidence (micro benchmark or brief load sample); otherwise rely on Colyseus stats.  
	 - Security: input validation present; no direct trust of client coordinates/state.  
	 - Migration: includes forward-only migration + rollback mitigation strategy (compensating script) if schema change.  
	 - Observability: only add custom logs/metrics when Colyseus built‑ins insufficient for debugging the change.  
5. No merging if a gate fails without an approved waiver recorded in the plan under "Complexity Tracking" or a dedicated waiver note.

## Governance

**Supremacy**: This Constitution supersedes ad-hoc practices; conflicts must be resolved by aligning with or amending this document.  
**Amendments**: Proposed via PR modifying this file + sync impact report; require review from at least one maintainer owning simulation and one owning infrastructure.  
**Versioning Policy**: Semantic for governance itself: MAJOR (principle removed/redefined incompatibly), MINOR (new principle or material expansion), PATCH (clarification/typo).  
**Compliance Review**: Each feature plan includes a "Constitution Check" gate snapshot referencing principle numbers and pass/fail.  
**Drift Audits**: Quarterly audit (or earlier if performance regression) ensures observability signals still meet stated thresholds; create remediation tasks for gaps.  
**Waivers**: Time-bound (≤ 1 MINOR version), must list mitigation and expiry date; recorded in plan's Complexity Tracking table.  
**Source of Truth Dates**: Ratification date is immutable historical anchor; Last Amended updates only on merged changes to this file.  
**Tooling Alignment**: Automation (scripts/CI) may enforce gates; failures block merge.

**Version**: 1.1.0 | **Ratified**: 2025-10-09 | **Last Amended**: 2025-10-09