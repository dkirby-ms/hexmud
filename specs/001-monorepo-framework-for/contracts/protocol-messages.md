# Protocol Messages (Baseline)

All WebSocket messages transit inside the envelope:
```ts
interface Envelope<T = unknown> { type: string; v: number; ts: number; payload: T }
```
`v` MUST equal `PROTOCOL_VERSION` exported by `packages/protocol`.

## Error Codes
| Code | Meaning | Action |
|------|---------|--------|
| AUTH_REQUIRED | Token missing/invalid | Acquire token then retry join |
| VERSION_MISMATCH | Client protocol differs | Rebuild/update client |
| RATE_LIMIT | Message exceeded rate limit | Backoff |

## Messages
| Type | Dir | Payload Schema | Notes |
|------|-----|----------------|-------|
| heartbeat | C->S | `{}` | Ack optional; server updates lastHeartbeatAt |
| session.join | C->S | `{ token:string, protocolVersion:number }` | First message after connect |
| session.welcome | S->C | `{ sessionId:string, playerId:string, protocolVersion:number }` | Sent on successful join |
| room.state | S->C | `{ roomId:string, snapshot:any }` | Placeholder world broadcast |
| error | S->C | `{ code:string, message:string }` | Generic structured error |

### Validation Strategy
1. Parse envelope (Zod) enforcing `type`, numeric `v`, numeric `ts` (± skew tolerance ignored for baseline).
2. Dispatch to type-specific schema.
3. Reject & send `error` if invalid.

### Version Negotiation
Client sends `session.join` including its `protocolVersion`. Server compares to constant; mismatch → `error{VERSION_MISMATCH}` and closes connection.

### Future Reserved Types
| Type | Purpose |
|------|---------|
| room.chat | Basic chat once persistence/ moderation added |
| action.move | Player movement (requires deterministic sim harness) |
| session.renew | Token refresh flow bridging |

