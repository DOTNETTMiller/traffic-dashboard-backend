# ATMS gateway contract

The gateway is an agency-managed service inside the authorized equipment-control
network. It owns the actual NTCIP/vendor protocol driver, device credentials,
message priority mapping, controller-specific capabilities, and field readback.
The ATMS implements the application workflow and evidence boundary. Both sides
must be commissioned together; an HTTP test double is not a field acceptance test.

`services/atms/ntcip/adapter.js` now supplies a bounded character-matrix text
profile. The local training service connects it to independent SNMP/UDP
emulators. See `NTCIP.md` for supported objects, assumptions, test scenarios,
and the remaining production-gateway and hardware acceptance work.
See `INTEROPERABILITY.md` for mixed legacy/current transport profiles and the
per-model acceptance matrix. Legacy serial/PMPP or proprietary equipment needs
its own commissioned gateway driver; the HTTP contract alone does not supply it.

## Authentication

Every message uses `Content-Type: application/json`, `X-ATMS-Timestamp` (epoch
milliseconds as a 13-digit string), and `X-ATMS-Signature` (hex HMAC-SHA256).
The signed bytes are `timestamp + "." + stable(body)`, where `stable` recursively
sorts object keys, preserves array order, and JSON-encodes scalar values.
`services/atms/dispatcher.js` exports the signing helper. Outbound requests use
the same canonical body bytes. TLS certificate validation is enabled.

Use a separate 32+ character `ATMS_GATEWAY_SECRET`. Never put it into a client
bundle, query string, operator form, or log. Incoming evidence needs a unique
16–120 character `nonce`; signatures have a five-minute clock window and nonce
replays are rejected. Synchronize gateway and ATMS clocks.

## Outbound commands

The ATMS POSTs to the configured `ATMS_GATEWAY_URL` with an `Idempotency-Key`
equal to the durable command ID:

```json
{
  "id": "durable-command-uuid",
  "deviceId": "AGENCY-DMS-001",
  "address": "gateway-address-001",
  "operation": "message",
  "message": "INCIDENT AHEAD\nEXPECT DELAYS",
  "priority": 3,
  "expiresAt": "2026-10-18T02:00:00.000Z",
  "nonce": "unique-message-uuid"
}
```

`blank` is the other supported operation and carries an empty message.
Priority 1 is the highest application priority; map it explicitly to the
controller policy. The gateway must durably deduplicate command IDs, serialize
device writes, reject expired requests, enforce device authorization, and honor
the validity period on the equipment. It must not blindly replay uncertain
commands after restart. A 2xx response means only that transport accepted the
request. The ATMS performs no automatic retry after uncertain delivery.

## Inbound evidence

POST signed evidence to `/api/atms/gateway/evidence`. `deviceId` is the ATMS
device ID, not the gateway address. The configured gateway is bound to one
agency; request bodies cannot choose another agency.

Heartbeat / display observation:

```json
{
  "kind": "telemetry",
  "deviceId": "AGENCY-DMS-001",
  "observedAt": "2026-10-18T01:45:00.000Z",
  "message": "",
  "nonce": "unique-event-uuid"
}
```

This updates only a previously provisioned gateway device. Telemetry alone
does not verify a particular command. Control requires an observation no older
than two minutes. Inventory timestamps and source-import times are insufficient.

Command acknowledgment uses `commandId`, `deviceId`, `status: "acknowledged"`,
`observedAt`, and `nonce`. Actual display confirmation requires:

```json
{
  "commandId": "durable-command-uuid",
  "deviceId": "AGENCY-DMS-001",
  "status": "readback",
  "evidence": "device-readback",
  "message": "INCIDENT AHEAD\nEXPECT DELAYS",
  "observedAt": "2026-10-18T01:45:02.000Z",
  "nonce": "another-unique-event-uuid"
}
```

`message` must come from the actual display readback, never the request echo.
Report the exact displayed plain text, using LF line separators. Observation
must be recent, after dispatch, and no older than already accepted device
evidence. A match verifies the command. A different nonblank display leaves an
uncertain outcome. A confirmed blank display records clearance. Successful
readback of a replacement supersedes prior confirmed display records.

For a failure, send `status: "failed"` and `reason`. Set `notApplied: true`
only when the gateway has authoritative evidence the command was not applied.
Otherwise the ATMS records an uncertain outcome requiring reconciliation.

The ATMS's 30-second readback deadline raises a timeout without resending.
Late signed readback may reconcile an uncertain command. Retain correlation
IDs at the gateway so this remains possible after ATMS service recovery.

The gateway must also detect unauthorized/manual field overrides and report
them. Signed telemetry that no longer matches a verified display invalidates
that command's certainty and raises a reconciliation condition. Telemetry does
not re-verify a specific uncertain command; use its correlated readback evidence.
Agency override policy and arbitration still require field acceptance testing.
