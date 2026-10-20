# NTCIP sign-control lab

The lab now runs a mixed SNMPv1/v2c/v3 fleet. See
[INTEROPERABILITY.md](INTEROPERABILITY.md) for explicit transport profiles,
security, the 48-check matrix, bench inspection and pending physical acceptance.

## Start and exercise

```sh
npm install
npm --prefix frontend run build
npm run start:atms
```

Open <http://127.0.0.1:4432/atms.html>. The training server starts a mixed fleet
of SNMPv1, v2c and v3 agents on randomly allocated loopback UDP ports. Community
and v3 credentials are random, remain server-side, and are not returned to the browser. The third sign starts
offline. No public or agency device address is accepted by the training API.
The emulator instances reset to blank when the service restarts; operations,
audit, and command-attempt history persist in the training SQLite database.

1. Under Training operator, create or claim an active incident and verify it.
2. Request a sign message with 2-60 minutes validity. A separate Training
   supervisor approves it in Command log.
3. The dispatcher sends real UDP SNMP GET/SET packets to the emulator. A result
   appears only after reading the controller's current message, source, owner,
   priority and mode. It is labeled **Simulated result**, with no physical
   verification timestamp.
4. Open Devices. Inspect the sign and expand SNMP exchange evidence for the last
   command and recent polls. This trace exposes object identifiers, not secrets.
5. Apply a scenario, wait for the next poll, and inspect the command and alarms.
   Reset emulator to blank clears an override and volatile slots. It is an
   explicitly audited training operation, not an agency reset command.

## Fault scenarios

| Scenario | Expected behavior |
| --- | --- |
| Healthy | Validated activation followed by matching current-buffer readback |
| No communications | Observation failure blocks new control; prior simulated certainty becomes unknown |
| Local control | Central commands are blocked; adapter never changes controller control mode |
| Reject message validation | Slot validation fails before activation; command is not applied |
| Lose activation acknowledgment | Controller applies once and drops its reply; outcome starts unknown; fresh GET reconciles without another activation |
| Display a different message | Current-buffer mismatch leaves an uncertain outcome |
| Simulate field override | Controller owner/source change invalidates prior command attribution |
| Advance to expiry | Controller applies its configured blank end-duration message; next GET confirms blank |
| Reset emulator to blank | Local-only recovery clears display and volatile memory, with an audit entry |

## Wire profile

The v1/v2c emulators use independently implemented ASN.1 BER directly. The v3
peer uses the net-snmp agent's authentication and encryption with the same
bounded controller model. The adapter uses `net-snmp`; both sides of v3 share
that security library, so this is not independent USM validation. Tests
include an independently published activation/CRC example, not only round trips
through our own encoder. CRC-16 includes MULTI bytes, beacon, and pixel-service
bytes in NTCIP order.

Implemented subset of NTCIP 1203 v02:

- Character and sign pixel dimensions; maximum MULTI length; volatile slot count.
- Message table: MULTI, owner, CRC, beacon, pixel service, runtime priority, status.
- Separate modify-request, modifying, validate-request, valid/error transitions.
- 12-byte activation code, activation error/state, source ID, source mode,
  control mode, and display duration remaining.
- Current-buffer reads use memory type 5, row 1; writes use reserved volatile
  slots (type 4). Blanking uses type 7 and CRC zero.
- Plain printable ASCII and `[nl]` only. Arbitrary MULTI markup, fonts, pages,
  graphics, full/line-matrix sizing and proprietary extensions are unsupported.
  Unsupported readback markup or non-ASCII bytes fail closed.

Application priority 1 is highest. The adapter maps priorities 1-5 to controller
priorities 255, 200, 150, 100, 50 respectively. NTCIP controller priority increases
with its numeric value. Commission this mapping with the agency.

The adapter requires central mode and a precommissioned blank end-duration
policy; it does not change either policy. It rejects a higher-priority active
message. Only explicitly reserved volatile slots may be used. An active slot is
never overwritten. The lab alternates two reserved slots for replacement.

NTCIP activation duration is whole minutes. The adapter rounds remaining absolute
validity **down** and rejects less than one full minute. This avoids extending a
command's deadline, but a controller may expire up to just under one minute
earlier. Approval delays consume validity. Training UI requires at least two
minutes; server/adapter checks remain authoritative.

The durable lab journal records an attempt before the first controller write and
refuses reuse of that command ID. No SET is automatically retried. After an
ambiguous activation result, polling checks message ownership/source before
correlating evidence; matching text alone is insufficient. A restart does not
replay journaled commands. The lab cannot emit physical confirmation.

## Verification

```sh
npm run test:atms
node scripts/atms-smoke.cjs
```

Protocol tests bind to loopback UDP and need permission to open local sockets.
They cover dimensions, unsupported input, priority/local-mode protection,
validation rejection, lost acknowledgments, mismatched readback, expiry,
blanking, authorization, command deduplication and console integration.

## Hardware integration boundary

The adapter is a library, not a production gateway daemon. A deployed gateway
still needs TLS/HMAC command ingress and evidence delivery following `GATEWAY.md`,
durable attempt storage, device provisioning, credential handling, process
supervision, and commissioned reconciliation. The lab's journal is local to the
training workflow; it is not a complete production gateway implementation.

Transports are explicit SNMPv1/v2c or SNMPv3 authPriv over IPv4/UDP, with no
automatic downgrade. Legacy v1/v2c have no message encryption; use a commissioned
agency control network with appropriate protection. Serial/PMPP, traps,
controller fault diagnostics and vendor-specific profiles remain future work.
Controller current-buffer readback proves the
controller-reported message; it does not prove every pixel is illuminated or
replace sign diagnostics/visual verification. Independent controller and network
failure testing is required before enabling any physical control.

Reference: [official NTCIP 1203 v02 document](https://www.ntcip.org/file/2018/11/NTCIP1203v02-35a.pdf),
sections 5.3, 5.5-5.7. The NTCIP site lists v03 as the published successor;
this limited profile makes no universal v02/v03 conformance claim.
