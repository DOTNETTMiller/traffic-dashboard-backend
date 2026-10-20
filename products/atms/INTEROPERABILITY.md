# New and legacy device acceptance

Compatibility is selected per device, manufacturer, model, firmware, MIB edition,
network path and feature set. A fleet may mix profiles. SNMPv3 describes transport
security; it does not mean NTCIP 1203 v03. This adapter implements a bounded
NTCIP 1203 v02 character-matrix ASCII text subset across the transports below.

| Equipment / connection | Implemented path | Evidence / remaining work |
| --- | --- | --- |
| Legacy character-matrix DMS, SNMPv1 over UDP/IP | Explicit v1 session, default one object per read, single-object writes | Independent local BER peer; physical model/firmware acceptance pending |
| Installed character-matrix DMS, SNMPv2c over UDP/IP | Explicit v2c session, configurable read batch 1–16 | Independent local BER peer; physical acceptance pending |
| Character-matrix DMS exposing the selected objects over SNMPv3 | authPriv, SHA or SHA256 authentication, AES privacy | Local SHA256/AES agent; shared net-snmp security library, physical acceptance pending |
| Full-matrix / color / graphic DMS | Outside current text adapter | Requires commissioned fonts, pixel layout, MULTI tags and corresponding tests; never silently truncate or strip formatting |
| Serial RS-232/RS-485, PMPP, modem or proprietary controllers | Agency gateway extension boundary | Serial framing/vendor driver and bench acceptance required; a serial-to-IP converter alone does not establish compatibility |
| CCTV/PTZ, signals, detectors and RWIS | Separate device drivers required | DMS test results do not establish support for other device classes |

Legacy v1/v2c communities have no message encryption. Keep these connections
inside the agency control network or its approved secure tunnel. Do not expose
controllers directly to the Internet. There is no automatic version downgrade,
credential fallback, protocol scan or activation retry after an uncertain result.

## Automated local matrix

```sh
npm run test:atms-interop -- --output /private/tmp/atms-interop.json
npm run test:atms
```

The standalone runner contacts loopback emulators only, writes a new JSON report,
and exits nonzero on failure. It tests 16 cases per profile: capability discovery,
correlated activation/readback, explicit blank, controller expiry, layout and
format rejection, expired commands, local control, higher priority, foreign slot
ownership, active-slot preservation, validation rejection, lost acknowledgment
without retry, mismatched display, offline controller, bad credentials and
protocol mismatch. The three profiles total 48 checks. Each report has a SHA256
of its compact JSON before adding `sha256`; credentials are excluded. A hash
detects changes against a trusted copy; it is not a digital signature.

The training console cycles through v1, v2c and v3 profiles for its virtual
devices. Its normal incident/recovery exercises therefore run a mixed fleet.
Simulated evidence remains simulated and cannot verify a physical command.

## Read-only controller bench inspection

Run only on equipment and networks the agency has authorized you to inspect.
The tool sends GET requests only; it never reserves/modifies a slot or activates
a message. It checks the configured reserved slot exists and the end-duration
policy already points to blank. It does not commission either setting.

Create a local controller config, with identity supplied from the asset record:

```json
{
  "identity": {
    "agency": "YOUR-AGENCY",
    "deviceId": "BENCH-DMS-001",
    "manufacturer": "RECORD MANUFACTURER",
    "model": "RECORD MODEL",
    "firmware": "RECORD EXACT FIRMWARE",
    "ntcipEdition": "RECORD SELECTED MIB EDITION AND OPTIONS"
  },
  "controller": {
    "host": "127.0.0.1",
    "port": 161,
    "snmpVersion": "1",
    "slot": 1,
    "maxVarbinds": 1,
    "communityEnv": "ATMS_BENCH_COMMUNITY"
  }
}
```

Provide credentials in the named environment variable, then:

```sh
node scripts/atms-bench.cjs --config /private/tmp/controller.json --output /private/tmp/controller-inspection.json
```

For v3, replace `communityEnv` with a `user` object containing `name`,
`authProtocol` (`sha` or `sha256`), `privProtocol` (`aes`), `authKeyEnv` and
`privKeyEnv`. Optional `context` is supported. Keys must have at least eight
characters. Keep credentials on the gateway host. Reports exclude host and
credential configuration; they include asset identity and actual display text,
and are written with owner-only permissions.

An `observed` result is discovery/readback evidence only. Missing/unsupported
objects leave inspection failed. No report enables live control or changes
installation acceptance. Do not rerun destructive tests against live roadside
signs: control tests require isolated bench equipment and agency supervision.

## Per-model physical acceptance matrix

Copy one row set for every model/firmware/profile/network path. Retain date,
tester, agency witness, expected result, actual result, trace/report path and
visible-display evidence for each case. A simulator pass cannot fill these rows.

| Required acceptance item | Initial status | Evidence needed |
| --- | --- | --- |
| Manufacturer/model/firmware, MIB edition and selected options | Not tested | Asset and protocol documentation |
| Network isolation, credentials and access revocation | Not tested | Agency-approved security and rejected-access test |
| Reserved slots, fonts/layout, priority map and expiry blank policy | Not tested | Commissioning record and boundary cases |
| Visible display matches correlated controller readback | Not tested | Witnessed display plus command/source/owner evidence |
| Local control, higher priority and another manager preserved | Not tested | No unauthorized overwrite in each case |
| Lost acknowledgment without replay and fresh reconciliation | Not tested | Packet-loss trace and exactly one activation |
| Power loss, gateway/ATMS restart, partition and clock behavior | Not tested | No stale replay, fresh state and bounded expiry |
| Operator approval, durable audit and agency signoff | Not tested | End-to-end workflow and signed acceptance record |

The JSON matrix carries these same pending field requirements for every profile.
The existing gateway contract still requires durable deduplication, signed
evidence, agency authorization and installation acceptance. Implementing a new
driver never bypasses those controls. No manufacturer compatibility or full
NTCIP certification is claimed by these software tests.

References: [NTCIP MIBs and testing tools](https://www.ntcip.org/how-to-get-mibs/),
[NTCIP 1203 v02](https://www.ntcip.org/file/2018/11/NTCIP1203v02-35a.pdf),
[net-snmp session/agent documentation](https://github.com/markabrahams/node-net-snmp).
