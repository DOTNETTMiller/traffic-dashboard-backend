# Iowa DMS read-only field run

Goal: read one real Iowa DOT message sign through the ATMS NTCIP adapter, with
no writes, and corroborate the readback against Iowa's public DMS_View feed.
This fills nothing in the physical acceptance matrix by itself. It establishes
that discovery and readback work against real equipment.

## Proven without a field run (2026-10-20)

Agency authorization for a controller read is unlikely, so the same chain was
run against Iowa's real message content instead. DMS_View publishes each
sign's raw MULTI string. Every permanent Iowa DMS (68) had its live MULTI
loaded into an emulated controller, read back over SNMP by the ATMS adapter,
and compared against the live feed with `atms-bench-compare-iowa.cjs`.

Result: 68/68 exact MULTI readback, 68/68 fully decoded to their words, and
all 68 kept the strict `message` null so none could verify an ATMS command.

This first failed 0/135 (permanent DMS plus portable boards): the read path
only accepted `[nl]`, and every Iowa sign uses `[pt] [jp] [jl] [fo] [nl] [np]
[sc]`. A real sign would have failed the same way. Reads now return the raw
`multi`, a `display` decode (pages, text, `complete`, `unrenderable`), and
`message` only for plain profile text. Fields, graphics and other
controller-substituted content are listed, never guessed. The feed
HTML-escapes MULTI (`&amp;`, `&gt;`); the compare tool unescapes it.

Still unproven without hardware: real controller SNMP behaviour (agent quirks,
MIB edition, varbind limits, timing), network/credential handling, and every
write-side item in the acceptance matrix.

## Before the day — from Iowa DOT

Nothing here can be obtained by probing. Every item comes from the agency.

1. **Written authorization** from the Iowa DOT owner of the sign system (TMC /
   ITS operations) to send SNMP GET requests to the named sign from a named
   machine, on a named date. Keep it with the report.
2. **Network path.** A machine on the ITS network or the agency's VPN/jump host
   that can reach the controller's SNMP port (usually UDP 161). The tool binds
   no listener and sends GETs only.
3. **One sign**, preferably one that is currently displaying a message and that
   has a DMS_View name (e.g. `I-80 EB @ Morningstar - SM`). Its controller IP.
4. **Asset record:** manufacturer, model, exact firmware, NTCIP 1203 edition.
   The tool refuses to run without them.
5. **Credentials — read-only.** Ask for a read-only community (v1/v2c) or a v3
   user with read-only access. Never accept the read-write community for this
   run. Record which SNMP version the sign is commissioned for.
6. **Reserved slot number** the agency would assign to the ATMS (the tool only
   checks that it exists).

## On the day

On the field machine, from the repository root:

```sh
npm run check:atms-bench          # 19/19 against emulators; a pass means any
                                  # field failure is the sign or network
```

Write the config outside the repository (it holds the controller address):

```json
{
  "identity": {
    "agency": "IADOT",
    "deviceId": "I-80 EB @ Morningstar - SM",
    "manufacturer": "<from asset record>",
    "model": "<from asset record>",
    "firmware": "<exact>",
    "ntcipEdition": "<1203 edition and options>"
  },
  "controller": {
    "host": "<controller IP>",
    "port": 161,
    "snmpVersion": "2c",
    "slot": 1,
    "maxVarbinds": 1,
    "communityEnv": "ATMS_BENCH_COMMUNITY"
  }
}
```

Start with `maxVarbinds: 1`; older controllers reject larger requests. Then:

```sh
read -s ATMS_BENCH_COMMUNITY && export ATMS_BENCH_COMMUNITY
node scripts/atms-bench.cjs --config ~/iadot-bench/controller.json --output ~/iadot-bench/report-1.json
node scripts/atms-bench-compare-iowa.cjs ~/iadot-bench/report-1.json "I-80 EB @ Morningstar - SM"
unset ATMS_BENCH_COMMUNITY
```

Each report file can be written once; use a new name for each attempt.

## Reading the result

| Bench | Compare | Meaning |
| --- | --- | --- |
| `observed` | `exact-match` | Readback works and the controller is the named sign. Record it. |
| `observed` | `text-match-formatting-differs` | Same message; the feed or controller reformats MULTI. Note which tags differ. |
| `observed` | `different` | Read both again together. If they still differ, the IP may belong to another sign. |
| `failed` | — | Check reachability and SNMP version, then `maxVarbinds: 1`. The report stays credential-free, so diagnose on-site. |

Also have someone look at the sign, or its camera, and note the displayed text.
Controller readback, public feed and visible display agreeing is the evidence.

## Keep

Authorization, the report JSON (owner-only, contains no address or credentials),
the compare output, the asset record and the visual check. Note who ran it,
when, and from which machine. Then revoke or rotate the credentials if the
agency issued them only for this run.
