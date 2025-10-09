# Task Breakdown: Project Framework

**Feature Branch**: `001-we-need-a`
**Generated**: 2025-10-09

Statuses: ☐ Todo | ▶ In Progress | ✓ Done | ✖ Blocked

---
## Milestone M1: Core Scaffold

| ID | Task | Status | Notes |
|----|------|--------|-------|
| M1-01 | Add root workspace config (pnpm-workspace.yaml or npm workspaces) | ☐ | |
| M1-02 | Create base directory tree & placeholder READMEs | ☐ | |
| M1-03 | Initialize shared TypeScript config (tsconfig.base.json) | ☐ | |
| M1-04 | Backend package init + express/fastify server skeleton (choose) | ☐ | Evaluate fastify for perf |
| M1-05 | Frontend Vite + React app init (TypeScript template) | ☐ | Constitution alignment |
| M1-06 | Shared package with initial types (auth, user, permissions) | ☐ | |
| M1-07 | Logging utility (pino) with correlation id middleware | ☐ | |
| M1-08 | Validation library setup (zod) & sample schema | ☐ | |
| M1-09 | Structure validation script (`validate-structure.ts`) | ☐ | |
| M1-10 | Secret detection script (regex patterns) | ☐ | |
| M1-11 | Dev orchestration script (`dev-all.sh`) | ☐ | |
| M1-12 | Basic tests (backend route + shared type + frontend render) | ☐ | |
| M1-13 | Documentation stubs (architecture.md, contributing.md) | ☐ | |
| M1-14 | `.env.example` creation & env loading docs | ☐ | FR-003 explicit |
| M1-15 | React base App component + routing placeholder | ☐ | |
| M1-16 | PostgreSQL migration tool init (empty initial migration) | ☐ | FR-020 |
| M1-17 | Database health check endpoint | ☐ | FR-020 |

## Milestone M2: Confidential Auth Foundation
| ID | Task | Status | Notes |
|----|------|--------|-------|
| M2-01 | Add `openid-client` dependency & config loader | ☐ | |
| M2-02 | Implement confidential client token acquisition module | ☐ | |
| M2-03 | Session token issuance (HTTP-only cookie) | ☐ | |
| M2-04 | Auth route & middleware (protect sample endpoint) | ☐ | |
| M2-05 | Error envelope handler (standard format) | ☐ | |
| M2-06 | Security/audit structured logging events | ☐ | |
| M2-07 | Metrics instrumentation for token requests | ☐ | |
| M2-08 | Mock identity provider stub for local dev | ☐ | |
| M2-09 | Tests: token acquisition success/failure paths | ☐ | |
| M2-10 | Token renewal scheduler & test (pre-expiry) | ☐ | FR-012 |
| M2-11 | Least-privilege scope configuration + validation test | ☐ | FR-008 |
| M2-12 | Security boundaries documentation draft | ☐ | FR-015 |
| M2-13 | Secret/material boundary bundle scan (no confidential creds) | ☐ | FR-006 |
| M2-14 | Unauthorized response compliance test (100% standardized) | ☐ | SC-004 |

## Milestone M3: Authorization & Module Generation
| ID | Task | Status | Notes |
|----|------|--------|-------|
| M3-01 | Roles & permissions registry | ☐ | |
| M3-02 | Authorization middleware (requirePermissions / requireRole) | ☐ | |
| M3-03 | Colyseus integration baseline (server + sample room) | ☐ | |
| M3-04 | Module scaffold script (inputs, templates) | ☐ | |
| M3-05 | Collision detection & logging for scaffolds | ☐ | |
| M3-06 | Tests for scaffold script | ☐ | |
| M3-07 | Permission naming convention & lint rule placeholder | ☐ | FR-011 |
| M3-08 | Module creation time measurement script (SC-002) | ☐ | |

## Milestone M4: Observability & Performance Baseline
| ID | Task | Status | Notes |
|----|------|--------|-------|
| M4-01 | OpenTelemetry setup (tracing + metrics) | ☐ | |
| M4-02 | Metrics endpoint exposure (/metrics) | ☐ | Placeholder only |
| M4-03 | Performance baseline script (startup timing, memory) | ☐ | |
| M4-04 | Token latency histogram integration | ☐ | |
| M4-05 | Logging sampling or volume guard (if needed) | ☐ | Optional |
| M4-06 | Correlation id completeness sampling test (SC-006) | ☐ | |
| M4-07 | CI gating for memory & startup thresholds | ☐ | FR-019 |

## Milestone M5: Hardening & Documentation
| ID | Task | Status | Notes |
|----|------|--------|-------|
| M5-01 | Expand security docs (rotation, renewal) | ☐ | |
| M5-02 | Contribution guide enhancements (dependency policy) | ☐ | |
| M5-03 | Accessibility & i18n placeholder verification | ☐ | |
| M5-04 | Final FR/SC mapping checklist update | ☐ | |
| M5-05 | Add risk review / retrospective doc | ☐ | |
| M5-06 | Developer onboarding time trial & report (SC-001) | ☐ | |
| M5-07 | Documentation satisfaction survey execution (SC-007) | ☐ | |
| M5-08 | Final secret scan & zero-secrets attestation (SC-003) | ☐ | |

---
## Cross-Cutting / Automation
| ID | Task | Status | Notes |
|----|------|--------|-------|
| CC-01 | Add ESLint + Prettier config & root scripts | ☐ | |
| CC-02 | Husky + lint-staged pre-commit hooks | ☐ | |
| CC-03 | CI workflow skeleton (lint + typecheck + tests) | ☐ | |
| CC-04 | Badge generation / README updates | ☐ | Nice-to-have |
| CC-05 | Constitution Check update script (optional automation) | ☐ | |
| CC-06 | Secret separation enforcement test (frontend bundle scan) | ☐ | FR-006 |

---
## Acceptance Mapping
- M1 covers FR-001..FR-009, FR-017, part of FR-018, FR-020 (init only)
- M2 covers FR-005, FR-006, FR-008, FR-012, FR-013, FR-014, FR-015
- M3 covers FR-010, FR-011, Colyseus foundational extension
- M4 covers FR-007 (metrics refinement), FR-019, SC-005/006 instrumentation
- M5 completes docs & non-functional polish (SC-001..SC-007 validation scripts)

---
## Dependencies / Sequencing Notes
- Choose express vs fastify at M1-04; if fastify selected, integrate its plugin system early.
- Colyseus requires HTTP server; integrate after base auth to leverage session context for room join validation.

---
## Definition of Done (Framework)
- All FRs have code/tests/docs references.
- Baseline scripts pass without manual intervention.
- No hard-coded secrets.
- Performance baseline script reports metrics within targets.

