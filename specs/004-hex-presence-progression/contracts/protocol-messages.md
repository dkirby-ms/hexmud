# Protocol Messages: Hex Presence Progression

## Colyseus Room State Additions
```
roomState.presenceSummary: {
  tiers: Array<{ hexId: string; tierId: number }>
  // Optionally minimal numeric value if small enough: value?: number (NOT included for large sets)
}
```

## Custom Messages (Colyseus client->server)
1. `presence:requestSnapshot`
- Purpose: Client requests full numeric snapshot after join.
- Payload: `{ since?: number } // optional timestamp` 
- Response: `presence:snapshot`

2. `presence:debugRequest` (restricted)
- Purpose: Admin/debug request presence for player/hex.
- Payload: `{ playerId?: string; hexId?: string }`
- Response: `presence:debugData`

## Custom Messages (server->client)
1. `presence:update`
- Payload: `{ hexId: string; delta: number; newValue: number; reason: 'create'|'increment'|'decay'|'cap'|'anomaly'; tierAfter: number; ts: number }`

2. `presence:snapshot`
- Payload: `{ entries: Array<{ hexId: string; value: number; tierId: number }>; ts: number }`

3. `presence:anomaly`
- Payload: `{ hexId: string; type: 'oscillation'|'rate'|'other'; valueBefore: number; valueAfter: number; ts: number }`

## Validation (Conceptual using Zod)
- `hexId`: regex `/^[A-Za-z0-9:_-]+$/`
- `delta`: int != 0 unless reason = 'create'
- `value`: int >= 1
- `tierId`: int >= 0
- `reason`: enum

## Error Responses (Server->Client)
- `presence:error` `{ code: 'DENIED'|'INVALID_PAYLOAD'|'TOO_FREQUENT'|'NOT_FOUND'; message: string }`

*End of Protocol Messages*
