# Data Model (Baseline In-Memory Entities)

> Persistence deferred. These entities describe authoritative in-memory runtime state & shared protocol constructs.

## Entity: PlayerIdentity
- **Fields**: `playerId:string` (GUID/subject), `displayName?:string`, `authClaims:Record<string,unknown> (filtered)`, `sessionPolicy:{ allowConcurrent:boolean }`
- **Relationships**: 1..* PlayerSession
- **Validation**: `playerId` non-empty; claims size limit (e.g. < 4KB serialized)

## Entity: PlayerSession
- **Fields**: `sessionId:string`, `playerId:string`, `connectedAt:Date`, `lastHeartbeatAt:Date`, `connectionState:'joining'|'active'|'closing'`, `protocolVersion:number`
- **Relationships**: Belongs to PlayerIdentity; can join 0..1 GameRoom
- **Transitions**:
  - `joining -> active` (after auth & version check)
  - `active -> closing` (disconnect or timeout)
  - Timeouts: heartbeat stale > configurable (default 30s) triggers cleanup

## Entity: GameRoom
- **Fields**: `roomId:string`, `protocolVersion:number`, `players: Set<sessionId>`, `stateSummary:{ message:string } (placeholder world)`
- **Relationships**: Contains PlayerSessions; ephemeral only
- **Validation**: `protocolVersion` === current exported PROTOCOL_VERSION

## Entity: ProtocolMessage (Envelope)
- **Fields**: `type:string`, `v:number` (protocol version), `ts:number` (epoch ms), `payload:any`
- **Validation**: Envelope schema enforced; `v` must equal `PROTOCOL_VERSION`
- **Derived**: Dispatch to per-message schema

### Message Types (Initial)
| Type | Direction | Payload Schema | Purpose |
|------|-----------|----------------|---------|
| `heartbeat` | client->server | `{}` | keep-alive & latency measurement |
| `session.welcome` | server->client | `{ sessionId:string, playerId:string, protocolVersion:number }` | Acknowledge join |
| `room.state` | server->client | `{ roomId:string, snapshot:any }` | Placeholder world broadcast |
| `error` | server->client | `{ code:string, message:string }` | Structured errors (e.g., AUTH_REQUIRED, VERSION_MISMATCH) |

## Entity: AuthToken (Validated Claims Subset)
- **Fields**: `subjectId:string`, `expiresAt:Date`, `scopes:string[]`
- **Validation**: `expiresAt > now`; required scope (future) for privileged actions

## Entity: SharedConstants
- **Fields**: `PROTOCOL_VERSION:number`, `HEARTBEAT_INTERVAL_MS:number`, `HEARTBEAT_TIMEOUT_MS:number`

## Entity: MetricsEvent (Interface Stub)
- **Fields**: `name:string`, `dimensions?:Record<string,string>`, `value:number`, `timestamp:number`
- **Usage**: Emits only if future metrics adapter plugged in.

## Validation Rules Summary
- All inbound messages: envelope + specific schema (Zod) else reject & increment `messages_rejected` counter placeholder.
- Heartbeat rate: >1 per second from same session -> throttled (ignored).
- Join requires valid token & matching protocol version.

## Extension Points
- `persistence/` adapters (future): implement interfaces for PlayerIdentity profile & durable session logs.
- `metrics/adapter.ts`: noop → vendor implementation later.
- `auth/claims-mapper.ts`: extract minimal stable subset of JWT claims to avoid coupling to IdP internal fields.

## State Diagrams (Simplified)
```
PlayerSession:
 [joining] --(auth+version ok)--> [active] --(disconnect|timeout)--> [closing] --(cleanup)--> [removed]
```

## Open Issues / Deferred
- Persistent identity profile storage (PostgreSQL) – future feature.
- Replay / deterministic simulation entities – future when gameplay logic added.
