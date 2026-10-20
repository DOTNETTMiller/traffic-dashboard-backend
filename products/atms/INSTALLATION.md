# PurposeBuilt ATMS installation and acceptance

This is a software-only installation procedure. The current local SNMP lab is a
training implementation; a deployed, manufacturer-tested agency gateway and real
controller acceptance are still required for physical operation. A completed
checklist records human evidence; it does not prove physical wiring or certify
NTCIP interoperability.

## Install the service

1. Install the repository's Node dependencies with `npm ci` and build the console
   with `npm --prefix frontend run build`. Use a supported Node release compatible
   with the installed better-sqlite3 native module.
2. Run the service as a dedicated, unprivileged account on persistent storage.
   Set the live environment using `.env.example`. The example is documentation;
   the application does not automatically read it. Keep training and live DBs
   separate. Limit the database, backups, and device configuration to the service
   account. Do not put secrets in the browser build or source control.
3. Supply individual JWT identities through your agency identity service. Assign
   operators and a different supervisor in the membership lists. Verify a viewer
   cannot mutate records and a requester cannot approve their own command.
4. Place the loopback service behind an agency TLS reverse proxy. Configure the
   service manager to restart it, retain logs, and monitor availability. Keep the
   field network isolated; deploy the agency gateway there and use HTTPS plus
   signed, fresh, replay-protected evidence. See GATEWAY.md for the contract.
5. Configure the Corridor Communicator observation source and licensed basemap.
   Verify observation timestamps, coverage, stale-feed alarms, and source errors.
   The ATMS never derives control authority from public feed inventory.
6. Provision each DMS with ATMS_DEVICE_CONFIG (a JSON array): id, name, type
   `dms`, columns, lines, latitude, longitude, and controlEnabled. Keep IDs aligned
   with the gateway's controller mapping. Configure manufacturer/firmware,
   addressing, credentials, reserved message slots, and network rules at the
   gateway. Control remains blocked pending acceptance.

## Commission each controller

Use **Installation** in the console. An operator records specific evidence for
each of the six checks: authorization; physical identity and geometry; display
readback; expiry/local override/priority; failure and restart recovery; and
operational handover. Include the test record ID, time, controller firmware,
witness, results, and agency contact. Do not mark a failed test as passed.

Conduct field display tests only in an agency-authorized maintenance window,
using an approved test procedure and rollback plan. Confirm display identity
physically; a successful network response alone does not identify the roadway
sign. Exercise blanking and restore the approved operational display afterward.

A separate supervisor who recorded none of the checklist evidence reviews the
records and accepts the installation. Device identity, dimensions, location,
control setting, or gateway URL/secret changes invalidate acceptance. Removing a device from the server manifest disables its control authority. Routine
telemetry updates do not. Replacing evidence also clears acceptance. Supervisors
can revoke it immediately. Request, approval, and dispatch each enforce the gate;
revocation does not automatically clear a message already on a physical sign.

## Verify and hand over

Run `npm run check:atms-install` with the live service environment. This read-only
command returns JSON and exit status 1 for incomplete local checks. It opens no
network listeners and sends no field commands. Its checks are a subset of this
procedure, not a production certification.

Verify the backup tool in backup.cjs and restore a copy to a separate environment;
compare the audit chain and incident records. Exercise the approved recovery
procedure without replaying uncertain commands. Record monitoring ownership,
alert escalation, support contacts, update/rollback instructions, backup retention,
and agency acceptance in the handover check. Train operators using the isolated
training service before assigning live authority.

## Messaging and architecture

The browser calls authenticated, agency-scoped APIs. Incident messages, recipient
acknowledgments, approved sign templates, commissioning evidence, and command
requests live in the SQLite operations store and share its transactional request
deduplication and audit chain. Source adapters remain an observation layer;
command approval and dispatch remain a separate control path.

**Messaging** provides internal incident coordination and approved DMS wording.
Messages appear on the next workspace refresh (normally five seconds); the named
recipient explicitly acknowledges them. Unacknowledged messages raise alarms.
There is no external email, SMS, cross-agency delivery, or push-delivery guarantee
in this implementation. Existing Corridor Communicator interagency messaging
remains separate until an individual-identity federation bridge is implemented.

Approved templates are immutable wording records with use conditions. Command
requests resolve wording on the server and retain the template ID. Operators can
choose custom wording; modifying a selected template in the composer makes it a
custom message. All wording is still constrained by the target sign, validity,
priority, incident state, separate approval, and readback requirements. Approval
of wording never dispatches it automatically.

The control path remains request → independent approval → transactional dispatch
→ signed gateway evidence → device readback. Installation acceptance is a further
gate, never a replacement for command review. The local emulator follows the same
command path but its results and commissioning records remain training-only.
