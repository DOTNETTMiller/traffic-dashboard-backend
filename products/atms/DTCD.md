# DTCD closure push

DTCD (Digital Traffic Control Diary) pushes each closure change to the ATMS
within about a second, through DTCD's existing premium webhook lane
(`supabase/WEBHOOK_PUSH.md` in the DTCD repository). Each change becomes an
ATMS road event `DTCD:<closure id>` with the field-recorded route, timing and
the MUTCD signs photographed on site (`fieldEvidence`). Operators review and
promote it like any other source event; nothing is published automatically.

## Endpoint

`POST /api/atms/dtcd/closures`, exactly as DTCD's `signAndPost` sends it:

- `X-DTCD-Timestamp`: epoch seconds, accepted within five minutes.
- `X-DTCD-Signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<raw body>">`.
- Body: `{ event_id, event_type: insert|update|delete, closure_id, update_date, work_zone }`.

The signature covers the exact bytes, so the Corridor backend's JSON parser
keeps them for this path only (`req.rawBody`).

| Case | Response | Effect |
| --- | --- | --- |
| New change | 200 `stored` | Event created or updated |
| Same `event_id` again (DTCD retry) | 200 `duplicate` | None |
| `update_date` not newer than stored | 200 `older` | None; a late retry never overwrites a newer change |
| `delete`, training or voided closure, `is_active: false` | 200 `ended` | Event marked not present |
| Bad or missing signature, stale timestamp, altered body | 401 | None |
| Not configured | 503 | None |

DTCD retries any non-2xx with backoff, so every accepted-but-ignored case
answers 200. Corridor snapshot imports do not retire events DTCD pushed.

## Configure

ATMS: set `ATMS_DTCD_WEBHOOK_SECRET` (32+ characters) with `ATMS_AGENCY`.
Unset, the endpoint answers 503.

DTCD (production changes, done by the DTCD owner):

1. Make sure `feed_webhook_config` holds the dispatch URL and secret
   (`WEBHOOK_PUSH.md`, "Enable"). Without it the trigger sends nothing.
2. Register the ATMS as a consumer. The owning account must hold
   `v2x_addon`, which delivery re-checks on every change:
   ```sql
   insert into public.feed_webhooks (user_id, url, label)
   values ('<account id>', 'https://<atms host>/api/atms/dtcd/closures', 'PurposeBuilt ATMS')
   returning secret;
   ```
3. Put the returned secret in `ATMS_DTCD_WEBHOOK_SECRET`.

## Overlap with the CWZ feed

Corridor also reads DTCD's public CWZ feed (`dtcdcwz`), which the ATMS
receives through its Corridor snapshot. The same closure can therefore appear
twice, under `DTCD:<closure id>` and under the feed's own identifier. DTCD
remains the publisher of contractor closures; do not republish pushed events
from the ATMS feed.
