# Feed Key Registration Playbook

**Date:** 2026-05-08
**Purpose:** All the places to grab free API keys so the dashboard's gated feeds light up. Sorted by leverage — top of the list is highest impact for least effort.

When you have a key, paste it into the matching env var in `.env` (local) or Railway → Variables (prod). Restart the backend; the relevant feed activates automatically.

---

## 1. NPS Road Events (free, single web form, highest leverage)

**Why:** Native WZDx 4.0. Single key gives you work zones across **all national parks** — fills WY, MT, ME, TN, SC, VT gaps in one shot.

**Steps:**
1. Go to https://www.nps.gov/subjects/developer/get-started.htm
2. Fill the "Get an API Key" form (name, email, intended use). Approval is instant.
3. The key arrives in the email confirmation.

**Env var:** `NPS_API_KEY`
**Endpoint we'll wire:** `https://developer.nps.gov/api/v1/roadevents?type=workzone&api_key=<KEY>`

**Time:** ~3 min, no waiting.

---

## 2. Arizona 511 (Iteris pattern — same as feeds we already use)

**Why:** Closes a top-15 freight state (I-10/I-40). Same iBi/Iteris API family as Georgia, NY, Alaska, Utah — drops in via the existing WZDx config block.

**Steps:**
1. Go to https://www.az511.com/developers/doc
2. Click "Get a Developer Key" / register an account.
3. Copy the key from your account dashboard.

**Env var:** `ARIZONA_API_KEY`
**Activation:** add a gated entry in `backend_proxy_server.js` mirroring the existing California/Colorado/Michigan blocks (same one-line pattern).

**Time:** ~5 min.

---

## 3. Alaska 511 (Iteris pattern)

**Why:** Only WZDx producer for the entire state of Alaska.

**Steps:**
1. Go to https://511.alaska.gov/developers/doc
2. Register, copy key.

**Env var:** `ALASKA_API_KEY`
**Activation:** same pattern as AZ above.

**Time:** ~5 min.

---

## 4. MAASTO TPIMS extension states (email-based)

Already-shipped layer covers IL/KY/MN. Each of these brings ~10–30 more rest areas:

| State | Contact | What to ask for |
|---|---|---|
| Iowa | dev@tsps.io | TPIMS Static + Dynamic API access for Iowa rest areas. |
| Kansas | https://tpims.ksdot.gov/ (web portal) | Account + key for Kansas TPIMS public feed. |
| Michigan | GormanJ4@michigan.gov | TPIMS access for MDOT rest areas. |
| Wisconsin | tpims@topslab.wisc.edu | Production TPIMS feed credentials (the public test endpoints 404). |
| Indiana | (no listed public TPIMS contact — INDOT publishes a non-spec sign feed at content.trafficwise.org/json/tpims.json) | Skip until INDOT formalizes. |

### Reusable email template

> Subject: TPIMS API access request — [STATE]
>
> Hi,
>
> I'm building a multi-state traffic operations dashboard that surfaces real-time
> truck parking availability alongside work zones, weather, and incident data.
> The dashboard currently consumes TPIMS feeds from Illinois (TravelMidwest),
> Kentucky (TRIMARC), and Minnesota (IRIS), and I'd like to extend coverage to
> include [STATE]'s rest areas.
>
> Could you point me to the production TPIMS Static and Dynamic endpoint URLs,
> and let me know what API key registration looks like? Use case is read-only —
> no rebroadcast, attribution to your agency in the popup.
>
> Thanks,
> Matt Miller
> mattmilleriowa@gmail.com

**Env vars (when keys arrive):** `TPIMS_IA_KEY`, `TPIMS_KS_KEY`, `TPIMS_MI_KEY`, `TPIMS_WI_KEY`
**Activation:** I'll add these to `services/maasto-tpims.js` once the URLs + auth pattern are confirmed (each agency may differ).

---

## 5. PennDOT RCRS (web form, medium effort)

**Why:** PA is the single largest freight corridor we're missing (we only have the Turnpike). Real-time incidents + roadwork + winter conditions.

**Steps:**
1. Go to https://www.pa.gov/services/penndot/request-access-to-transportation-related-data-feeds
2. Fill the access request form. Approval is human-reviewed (days, not minutes).
3. Email follow-up may be required: `penndotdata@pa.gov`

**Format:** RCRS is **not** WZDx — closer to TMDD-derived JSON. We'd need a custom adapter.

**Time:** ~10 min to submit + ~1–2 weeks for approval.

---

## 6. Waze for Cities (CCP) — biggest qualitative gain, slowest cycle

**Why:** Crowdsourced incidents minutes ahead of DOT detection across every state with no public DOT API (CT, AL, MS, MT, TN, WY, etc.). Two-way: also publishes our DOT alerts back to Waze users.

**Steps:**
1. Go to https://www.waze.com/wazeforcities
2. Apply as a partner agency (requires identifying the operating agency / role).
3. After approval, configure the CCP feed in the Waze partner portal.

**Time:** Application is ~15 min; approval can take 4–8 weeks.

---

## Once you have keys

Drop them in your `.env` (local) or Railway Variables (prod). The dashboard auto-detects keys at boot — no code change needed for AZ/AK if you follow the gated-block pattern. Tell me when keys are in and I'll wire any feeds that need a custom adapter (NPS, MAASTO extension states, PennDOT RCRS, Waze).

**Recommended order:** NPS first (instant, highest leverage) → AZ + AK (instant, fills 2 states) → email the 4 MAASTO contacts in one sitting (async wait) → submit Waze + PennDOT (longer wait, run in background).
