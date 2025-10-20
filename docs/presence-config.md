# Presence Configuration Guide

This document explains how to configure the Hex Presence Progression feature across environments. Values apply to both the Colyseus server (`apps/server`) and the load-testing harness (`scripts/load-test.ts`).

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PRESENCE_CAP` | `100` | Maximum presence value per hex. Additional increments emit a `cap` event but do not increase the stored value. |
| `PRESENCE_FLOOR_PERCENT` | `0.10` | Fraction of the cap used to compute the permanent floor (using `ceil(cap * floorPercent)`). Presence never decays below this floor. |
| `PRESENCE_DECAY_PERCENT` | `0.05` | Percentage of the current presence value removed on each decay batch run. Clamped to at least 1 point while above the floor. |
| `PRESENCE_INACTIVITY_MS` | `86400000` | Time in milliseconds after a record’s `lastVisitedAt` before it becomes eligible for decay (default 24 hours). |
| `PRESENCE_INTERVAL_MS` | `10000` | Dwell accumulation interval used by the server tick to validate increments and by the client for heartbeat pacing. |
| `PRESENCE_REQUIRED_DWELL_FRACTION` | `0.9` | Fraction of the interval a player must remain within a hex to earn an increment (prevents boundary hopping exploits). |

These variables are consumed by `apps/server/src/config/env.ts`. The load-test harness also respects equivalent `LOADTEST_*` overrides when simulating increments and decay.

## Recommended Overrides

| Environment | Suggested Changes | Rationale |
| --- | --- | --- |
| Local development | Increase `PRESENCE_DECAY_PERCENT` to `0.25`, set `PRESENCE_INACTIVITY_MS` to `600000` (10 minutes) | Speeds up manual validation of decay without waiting 24 hours. |
| Staging (soak tests) | Keep defaults, but set `PRESENCE_CAP` to `50` and `PRESENCE_FLOOR_PERCENT` to `0.20` | Ensures faster saturation to exercise cap events and higher floor for replay comparisons. |
| Load testing | Mirror production values; adjust via `LOADTEST_CONCURRENCY`, `LOADTEST_PLAYERS`, and `LOADTEST_DECAY_BATCH_SIZE` | Keeps parity with production tuning while varying client counts. |

## Operational Guidance

- **Changing thresholds**: Update the environment variables and restart the server processes. No migration is required because the limits are applied dynamically when increments or decay happen.
- **Monitoring**: Presence metrics (see `apps/server/src/metrics/adapter.ts`) report increment, cap, decay, and anomaly counters. Adjustments to cap or decay settings should be accompanied by dashboard updates.
- **Replay Harness**: The presence replay (`apps/server/src/rooms/presenceReplay.ts`) captures `create`, `increment`, `cap`, and `decay` events. When tuning thresholds, regenerate replay samples to keep regression runs aligned.
- **Client Expectations**: Any reduction of `PRESENCE_CAP` should be communicated to client teams so UI gradients remain calibrated. The web legend (`apps/web/src/components/HexMap/HexLegend.tsx`) reads tier configuration from the snapshot payload.

## Verification Checklist

1. Update `.env` or deployment secret store with the new values.
2. Restart Colyseus server processes or the dev watcher.
3. Run `pnpm --filter @hexmud/server test` to ensure decay and increment tests respect the new limits.
4. Optionally run `pnpm exec tsx scripts/load-test.ts --dry-run` to confirm load-test defaults match expectations.

*Last updated: 2025-10-19*
