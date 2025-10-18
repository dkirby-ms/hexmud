# Quickstart: Hex Presence Progression

## Server Integration Steps
1. Create `WorldRoom.ts` (or extend existing placeholder) adding presence hybrid state: `presenceSummary` with tier + hexId list.
2. Add accumulation tick logic (reuse existing heartbeat) verifying dwell fraction ≥ 0.9 before increment.
3. Implement decay batch (interval cron) selecting stale records and applying percentage decrease capped by floor.
4. Add custom messages:
   - Client request snapshot: `presence:requestSnapshot` → server responds `presence:snapshot`.
   - Server pushes `presence:update` deltas.
5. Add anomaly detection (oscillation) comparing lastIncrementAt times across adjacent hex transitions.
6. Add migration for `player_presence` table.
7. Extend replay harness to capture presence events (create/increment/decay/cap/anomaly).

## Client Integration Steps (React)
1. Join room via existing auth flow; after join, send `presence:requestSnapshot`.
2. Maintain local map structure keyed by hexId storing { value, tier }.
3. Render Canvas grid; on updates, repaint affected hex cells only.
4. Show tooltip overlay with numeric value & tier label on hover.
5. Pan/zoom by adjusting transform and recalculating visible hexes.
6. Handle `presence:update`: apply delta & recompute tier if needed.
7. Gracefully degrade if snapshot delayed (loading state / skeleton).

## Testing Outline
- Unit: dwell fraction calculation; decay math; tier assignment.
- Integration: sequence of movement increments & decay transitions.
- Load: simulate 10k presence increments; measure tick CPU and update latency.
- Replay: feed recorded movement and verify identical presence evolution.

## Configuration
Environment vars (suggested):
- PRESENCE_CAP (default 100)
- PRESENCE_FLOOR_PERCENT (default 0.10)
- PRESENCE_DECAY_PERCENT (default 0.05)
- PRESENCE_INACTIVITY_MS (default 86400000)
- PRESENCE_INTERVAL_MS (default 10000)
- PRESENCE_REQUIRED_DWELL_FRACTION (default 0.9)

## UX Notes
- Color gradient tiers ensure contrast; accessible palette (consider user setting for high contrast).
- Avoid frequent reflows: Canvas draws targeted cells.
- Provide legend explaining tiers.

*End of Quickstart*
