# Protocol Messages: Authentication Context

## Join Request Envelope

The client initiates an authenticated session by joining the placeholder room via Colyseus. The join payload extends the baseline envelope with an optional `accessToken` field when authentication is enabled.

```jsonc
{
  "type": "room.join",
  "v": <PROTOCOL_VERSION>,
  "ts": 1672531200000,
  "payload": {
    "protocolVersion": <PROTOCOL_VERSION>,
    "accessToken": "<optional bearer token>"
  }
}
```

- `protocolVersion` remains required. Clients must continue to advertise the negotiated version to avoid `VERSION_MISMATCH` rejections.
- `accessToken` is optional at the protocol level, but required whenever the server is configured with MSAL credentials. Clients should omit the field entirely when authentication is disabled to preserve backwards compatibility.

> **Note:** Adding new required fields to the payload is a breaking change and must be accompanied by an increment of `PROTOCOL_VERSION`. Optional fields, such as `accessToken`, do not require a version bump provided their absence maintains parity with existing behavior.

## Error Envelope Reminder

Authentication failures continue to surface through the existing error envelope:

```jsonc
{
  "type": "error",
  "v": <PROTOCOL_VERSION>,
  "ts": 1672531200001,
  "payload": {
    "code": "AUTH_REQUIRED",
    "message": "AUTH_REQUIRED: <reason>"
  }
}
```

Server implementations should avoid leaking raw cryptographic errors in the `message` field. Instead, map failures to standardized reason codes (see FR-005) for client display and analytics.
