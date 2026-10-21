# Hosted training beta

A hosted copy of the training workspace for invited testers. It is separate
from the integrated ATMS and from the local training service.

- **Sign-in:** a PurposeBuilt account, the shared Supabase account service
  that DTCD and StormwaterCheck use, with the same Turnstile check.
- **Access:** a row in `public.atms_beta_access`. No row, a revoked row or an
  expired row is refused.
- **Workspace:** one private training sandbox per account, with simulated
  sources and sign emulators. It sends no physical commands and reads no live
  data. A sandbox is deleted after `ATMS_BETA_IDLE_MINUTES` without use
  (default 60) or `ATMS_BETA_LIFETIME_HOURS` (default 8), or when the tester
  presses **Delete my workspace**. A restart deletes every sandbox.

`products/atms/beta-server.cjs` runs it; `services/atms/beta.js` holds the
account check and the sandbox lifecycle. A sandbox costs about 3 MB and half a
second to start. Tests: `tests/atms/beta.test.js`.

## How a session works

1. The browser signs in to the account service (email, password, Turnstile)
   and sends the access token once to `POST /api/atms/beta/session`.
2. The server verifies the token against the project's published signing keys
   (`/auth/v1/.well-known/jwks.json`, ES256), then reads the account's own
   `atms_beta_access` row with that token under row security. It needs no
   service-role key.
3. It opens the account's sandbox and returns a beta token (at most 2 hours,
   never past the sandbox or the access expiry). The PurposeBuilt token is not
   stored.
4. Choosing a training role (`/training/session` with `X-ATMS-Beta`) returns a
   role token bound to that sandbox and account; every other request is routed
   to that sandbox only.

Sign-in attempts are limited to 10 per minute per address. At
`ATMS_BETA_MAX_SANDBOXES` (default 8) new sandboxes are refused until one ends.

## Database (shared PurposeBuilt project)

`beta/202610210001_atms_beta_access.sql` is additive and touches no DTCD or
StormwaterCheck object. Accounts can read only their own row and cannot write.
Tested against Postgres 17: applies twice; own-row reads; insert, update,
grant function and anonymous reads refused.

Grant, renew and revoke from the Supabase SQL editor:

```sql
select public.atms_beta_grant('tester@agency.gov', 60, 'Iowa DOT TMC');
select public.atms_beta_revoke('tester@agency.gov');
select u.email, a.* from public.atms_beta_access a join auth.users u on u.id = a.user_id;
```

The tester needs a PurposeBuilt account first (created in StormwaterCheck's
organization sign-up or DTCD).

## Deploy (Railway, separate service)

Same repository; the existing Nixpacks build already builds `frontend/dist`.
Override the start command:

```sh
NODE_ENV=production node products/atms/beta-server.cjs
```

Attach a volume and set:

| Variable | Value |
| --- | --- |
| `ATMS_BETA_SUPABASE_URL` | `https://lqmlwtlvoltdaxiwixqq.supabase.co` |
| `ATMS_BETA_SUPABASE_ANON_KEY` | The project's public anon key (as in StormwaterCheck's `backend/public-config.json`) |
| `ATMS_BETA_TURNSTILE_SITE_KEY` | The public Turnstile site key the account service accepts |
| `ATMS_BETA_SECRET` | New random value, 32+ characters (`openssl rand -hex 32`) |
| `ATMS_BETA_DATA_DIR` | A directory on the volume, e.g. `/data/atms-beta` |
| `ATMS_BETA_MAX_SANDBOXES`, `ATMS_BETA_IDLE_MINUTES`, `ATMS_BETA_LIFETIME_HOURS` | Optional limits |

Then point `atms.purposebuilt.systems` at the service (CNAME), and confirm the
Turnstile widget's allowed hostnames cover it. The service does not set
`ATMS_ENABLED`, and nothing in it reaches the Corridor service.
