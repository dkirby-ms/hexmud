# Data Model: Wire Up Authentication

## Entities

### User Identity
- Description: Abstract player identity derived from token claims.
- Fields:
  - id (string; from `oid` or `sub` claim)
  - displayName (string | null; from `name` claim if present)
  - username (string | null; from `preferred_username` claim if present)
  - roles (array<string>; includes 'moderator' if claim/flag present; otherwise empty)
- Validation:
  - id: non-empty, stable across sessions.
  - roles: limited to known set ['moderator'] initial iteration.
- Lifecycle: Exists implicitly per validated token; not persisted.

### Auth Token (Identity Assertion)
- Description: Signed time-bound credential from identity provider.
- Fields (claims subset):
  - iss (issuer)
  - aud (audience)
  - exp (expiry epoch)
  - nbf (not-before)
  - iat (issued-at)
  - sub (subject)
  - oid (object id; preferred stable id if present)
  - name, preferred_username (optional display metadata)
- Validation Rules:
  - Signature must validate against current/rotated JWK.
  - exp > now; (exp - now) can trigger renewal if <5m.
  - nbf - now <= allowed skew (<=120s).
  - aud matches configured clientId.
  - iss matches configured authority.
  - One of oid or sub required.

### Session
- Description: Server-side binding of a connected client to a User Identity.
- Fields:
  - sessionId (string; from Colyseus client)
  - playerId (string; maps to User Identity id)
  - connectedAt (timestamp)
  - lastActivityAt (timestamp)
  - roles (array<string>)
- Validation:
  - playerId: must match extracted token id when authenticated.
  - lastActivityAt monotonic >= connectedAt.
- Lifecycle: Created on successful join; destroyed on leave/disconnect.

### Authorization Claim / Role
- Description: Simple flag set.
- Values: 'moderator' | (future expansions)
- Source: Token claim (e.g., roles / custom extension) or future mapping.

### Tenant Policy (Open)
- Description: Accept any issuer matching configured authority; no domain restrictions.
- Fields: none (placeholder for future allowlist/denylist arrays).

## Relationships
- Session references User Identity (playerId) and duplicates roles snapshot for quick lookup.
- User Identity derived solely from Auth Token; no forward persistence link.

## State Transitions
1. unauthenticated → authenticated: token validated; session created.
2. authenticated → renewing: silent renewal in progress (internal state, no server change).
3. renewing → authenticated: new token acquired.
4. renewing → unauthenticated: renewal failed & token expired.
5. authenticated → signedOut: user triggers signOut; session invalidated client-side; server session ends when connection closes or explicit action.

## Validation Sources
- Token validation: `apps/server/src/auth/validateToken.ts`
- Join processing: `apps/server/src/handlers/join.ts`
- Client acquisition & renewal: `apps/web/src/hooks/useAuth.ts`

## Open Extension Points
- Future: Add persisted profile table, role mapping service, tenant allowlist config.
