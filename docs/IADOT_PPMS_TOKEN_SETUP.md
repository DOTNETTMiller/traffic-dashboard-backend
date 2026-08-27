# Iowa DOT PPMS Token Setup — Readable Project Numbers in the Request Builder

**Purpose:** wire *current, readable* project numbers (e.g. `NHSX-069-4(68)--3H-77`) into the
CARS 511 request builder's project lookup.

**Why a token is needed:** the public RAMS layers give current project *locations* + internal
`PID` + mileposts, but **not** the readable federal-style project number. That number lives only
in the token-gated **agshost PPMS** service:

```
https://gis.iowadot.gov/agshost/rest/services/Project_Management/PPMS_MW_data/FeatureServer
```

This service is **Portal-federated** (ArcGIS Enterprise 11.3), so tokens come from your Iowa DOT
Portal using your DOT login — not a separate API key you buy.

- Token service: `https://gis.iowadot.gov/portal/sharing/rest/generateToken`
- OAuth (app) service: `https://gis.iowadot.gov/portal/sharing/rest/oauth2/token`

---

## ⚠️ Never paste the token or your password into chat, tickets, or logs
Put credentials **directly into the Railway service's environment variables**. They live only
there; the code reads them from the environment. If you must move a token between machines, use a
secure channel (password manager), not email/Slack/chat.

---

## Route A — Quick token (proves it works; expires in ~2 weeks)

Run this **on your own machine** so your password never leaves it. Replace the two `YOUR_…` values.

```bash
curl -s "https://gis.iowadot.gov/portal/sharing/rest/generateToken" \
  --data-urlencode "username=YOUR_DOT_ARCGIS_USER" \
  --data-urlencode "password=YOUR_PASSWORD" \
  --data-urlencode "client=referer" \
  --data-urlencode "referer=https://corridor-communication-dashboard-production.up.railway.app" \
  --data-urlencode "expiration=20160" \
  --data-urlencode "f=json"
```

- Returns `{"token":"<LONG STRING>","expires":<ms epoch>}`.
- `client=referer` + `referer=…` binds the token to that referer. The backend proxy will send the
  **same** referer when it calls agshost — that's why it must match exactly.
- `expiration=20160` = 14 days (in minutes). That's typically the max for a manual token; for a
  longer-lived, unattended setup use **Route B**.

If it returns an error instead of a token:
- `Invalid username or password` → wrong Portal credentials (it's your **ArcGIS Portal** login,
  which may differ from your Windows/AD login).
- `Unable to generate token` / referer error → try `--data-urlencode "client=requestip"` and drop
  the `referer` line (binds to the caller's IP instead — less ideal for a cloud backend, but fine
  for a quick test from your own machine).

---

## Route B — Durable token (recommended for leaving it running)

A manual token expires. For an unattended backend, register an **Application** in the Portal so the
backend can mint/refresh its own tokens — no person, no 2-week clock.

1. In the Iowa DOT Portal (`https://gis.iowadot.gov/portal`) → **Content → Add Item → An
   application** (or ask your GIS admin to register an app / OAuth app for this integration).
2. Copy the app's **Client ID** and **Client Secret**.
3. Make sure the app's identity has **read access to the PPMS_MW_data service** (a GIS admin may
   need to grant this — federated server services are permissioned by role/group).
4. The backend then does OAuth2 client-credentials automatically:
   ```
   POST https://gis.iowadot.gov/portal/sharing/rest/oauth2/token
     client_id=<ID>&client_secret=<SECRET>&grant_type=client_credentials&expiration=20160&f=json
   ```
   → returns a short-lived `access_token` the backend caches and re-mints on expiry.

You provide the **Client ID + Secret** (as env vars); the code handles the refresh loop.

---

## Set the env vars in Railway

On the **"Corridor Communication Dashboard"** service → **Variables**:

**Route A (quick token):**
| Variable | Value |
|---|---|
| `IADOT_AGS_TOKEN` | the `token` string from Route A |
| `IADOT_AGS_REFERER` | `https://corridor-communication-dashboard-production.up.railway.app` (must match the referer you generated with) |

**Route B (durable app):**
| Variable | Value |
|---|---|
| `IADOT_AGS_CLIENT_ID` | app Client ID |
| `IADOT_AGS_CLIENT_SECRET` | app Client Secret |

Adding a variable triggers a redeploy — that's expected.

---

## One decision: who can use it

The backend proxy is CORS-open (`*`), so re-serving a token-gated DOT service through it means, by
default, anyone could query PPMS via our backend using DOT's token. Project numbers/locations are
largely public, but it's still your internal service. **Recommended:** I add a lightweight shared
key so **only the request-builder tool** can hit that one endpoint. If you want that, also set:

| Variable | Value |
|---|---|
| `IADOT_PPMS_KEY` | any long random string (the tool sends it as a header; requests without it are refused) |

RAMS stays fully open (it's already public); only the token-backed PPMS endpoint gets the key.

---

## What happens after the vars are set (my side)

1. I add a scoped, read-only `GET /api/ia/ppms/:layer/query` proxy that:
   - attaches `IADOT_AGS_TOKEN` (or an app-minted token) server-side — the secret never reaches the browser,
   - sends the matching `Referer`,
   - is restricted to the PPMS FeatureServer + safe ArcGIS query params,
   - requires `IADOT_PPMS_KEY` if set.
2. I query the live service (with the token) to find the exact field carrying the readable project
   number/description, then wire the CARS 511 tool's project lookup + autocomplete to it.
3. Deploy + verify end-to-end.

**To hand it back to me:** set the env vars above, then say "PPMS token is set" (don't paste the
values). I'll take it from there.

---

## Quick reference — what each source gives

| Source | Access | Current? | Project # | Locations | Mileposts | Clearances |
|---|---|---|---|---|---|---|
| Public bid layers | CORS-open | ❌ stale | ✅ | ✅ | — | — |
| **RAMS** (via `/api/ia/rams/*`, already live) | public, proxied | ✅ | ❌ PID only | ✅ | ✅ true LRS | ✅ posted+per-lane |
| **agshost PPMS** (this doc) | token, proxied | ✅ | ✅ | ✅ | — | — |

RAMS already covers current locations, precise mileposts, and bridge clearances with **no token**.
This token adds only the one missing piece: the **readable current project number**.
