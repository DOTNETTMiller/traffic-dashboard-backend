# CARS 511 Request Builder — Database Integration Guide

**How to wire the CARS 511 Request Builder into your own system so submissions post directly into your database instead of a paper/email form.** Everything the tool sends and everything your endpoint must do is below, with drop-in server examples.

The tool is a single self-contained HTML file. It already has the client side built in: an operator fills the form, then under **🗄️ Submit to database** enters your endpoint URL (and an optional authorization header) and presses **Submit** — the tool `POST`s the whole request as JSON. Your side is one HTTPS endpoint that accepts that JSON and writes it to your database. Nothing runs on anyone else's servers.

```
CARS 511 Builder (browser)  ──HTTPS POST (JSON)──►  YOUR endpoint  ──►  YOUR database
                                                     (you build this, per below)
```

---

## Who does what

| Role | Their part | Effort |
|---|---|---|
| **Program lead** (no code) | Decide where records land (new table vs. existing CARS intake), issue an auth token, review test records | A few hours |
| **Any web developer** | Stand up the endpoint (copy a reference implementation), map fields to columns, enable CORS | Half a day |

---

## Part 1 — What the tool sends

A single JSON object via `POST`, `Content-Type: application/json`. Example:

```json
{
  "requestor": "M. Miller",
  "email": "matt.miller@iowadot.us",
  "route": "I-35",
  "direction": "Southbound",
  "project": "NHSX-035-1(123)",
  "iwz": "Yes",
  "description": "Right lane closed for PCC patching",
  "beginLoc": "MP 111",
  "endLoc": "MP 72",
  "counties": "Story County",
  "impact": "Lane closure(s)",
  "beginDT": "2026-09-01T07:00",
  "endDT": "2026-09-30T17:00",
  "rWidth": "", "rHeight": "15 ft 6 in", "rWeight": "", "rLength": "",
  "rTiming": "24 hours",
  "detour": "No",
  "oversize": "N/A",
  "detourNotes": "",
  "contact24": "John Doe / 515-555-0100",
  "techContact": "Jane Roe / 515-555-0111",
  "dms": "Requesting messaging on: SS1626 - US 20 EB @ MM 16",
  "addlNotes": "Intelligent Work Zone (Street Smart) devices: SS1626 …\nNearby cameras: DQ - US 20 @ MM 297.2 (https://…)",
  "rce": "District 1 (Ames)",
  "overhead": "No",
  "schedPattern": "Continuous",
  "segment": { "begin": [-93.61, 41.60], "end": [-93.62, 41.03], "miles": 41.2 },
  "geometry": { "type": "LineString", "coordinates": [[-93.61,41.60], [-93.62,41.03]] },
  "detour_geometry": null,
  "schedule": ["Mon Sep 01 2026 → Wed Sep 30 2026 (continuous)"],
  "devices": {
    "dms": ["I-35 SB @ Corp Woods"],
    "arrowBoards": ["QTC-24 - I-35 NB Ramp"],
    "streetSmartIWZ": ["SS1626 - US 20 EB @ MM 16"],
    "cameras": ["DQ - US 20 @ MM 297.2 (JFK Rd - West)"]
  },
  "maps": { "route": "https://www.google.com/maps/dir/…", "detour": null },
  "submitTo": "IowaDOT.Traffic@iowadot.us",
  "rceCc": "firstname.lastname@iowadot.us",
  "generatedAt": "2026-08-25T14:03:00.000Z",
  "source": "CARS 511 Request Builder"
}
```

> Note: `detour` is the *"Marked detour? Yes/No"* string; the drawn detour line (GeoJSON `LineString` or `null`) is a separate key, **`detour_geometry`**.

### Field reference

| JSON key | Meaning | Suggested column |
|---|---|---|
| `requestor`, `email` | Who filed it | `requestor_name`, `requestor_email` |
| `route`, `direction` | Roadway + travel dir (N/S/E/W/Both) | `route`, `direction` |
| `project` | DOT project number | `project_number` |
| `iwz` | Intelligent Work Zone (Street Smart/SRF) Yes/No | `is_iwz` (bool) |
| `description` | Work description | `description` |
| `beginLoc`, `endLoc` | Begin/end (posted mileposts) | `begin_location`, `end_location` |
| `counties` | County/counties | `counties` |
| `impact` | Traffic impact (dropdown) | `traffic_impact` |
| `beginDT`, `endDT` | Start/end date-time (local ISO) | `start_dt`, `end_dt` |
| `rWidth`,`rHeight`,`rWeight`,`rLength`,`rTiming` | Restrictions | `restr_*` |
| `detour` (string) / `detour` (object) | Yes/No / GeoJSON line | `has_detour`, `detour_geom` |
| `oversize`, `detourNotes` | Oversize allowed, detour notes | `oversize`, `detour_notes` |
| `contact24`, `techContact` | Contacts ("Name / Phone") | split into name+phone |
| `dms`, `addlNotes` | DMS request, additional info | `dms_request`, `additional_info` |
| `rce` | Responsible RCE office | `rce_office` |
| `overhead` | Temp overhead signals Yes/No | `overhead_signals` |
| `segment`, `geometry` | Coords + WGS84 line | `geom` (PostGIS `geometry(LineString,4326)`) |
| `schedule` | Built occurrences | `schedule` (jsonb) |
| `devices` | Associated field devices by type | `devices` (jsonb) |
| `maps` | Google Maps route/detour links | `route_map_url`, `detour_map_url` |
| `generatedAt`, `source` | Provenance | `created_at`, `source` |

Unmapped keys are safe to store whole in a `jsonb`/`nvarchar(max)` `raw_payload` column — recommended so nothing is ever lost.

---

## Part 2 — Endpoint contract

| Requirement | Value |
|---|---|
| Method | `POST` |
| Path | your choice (e.g. `/api/cars511`) |
| Request body | the JSON above |
| Content-Type | `application/json` |
| Auth (optional) | tool sends the exact string from its "Authorization header" box as the `Authorization` header — e.g. `Bearer <token>` or an API key. Validate it. |
| **CORS** | must allow the origin the HTML runs from (see Part 4) |
| Success response | HTTP `200`/`201` with JSON `{ "id": "<record id>" }` — the tool shows "✓ Submitted — record `<id>`" |
| Failure | any non-2xx; the tool shows the status and the operator can fall back to **Download JSON** |

---

## Part 3 — Reference implementations (copy one)

### ASP.NET Core (C#) — closest to the existing CARS/.NET stack

```csharp
// Program.cs (minimal API). dotnet add package Npgsql if using PostgreSQL.
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors(o => o.AddPolicy("cars511", p => p
    .WithOrigins("https://YOUR-HOST")   // or .AllowAnyOrigin() if the tool is opened from files/intranet
    .AllowAnyHeader().AllowAnyMethod()));
var app = builder.Build();
app.UseCors("cars511");

app.MapPost("/api/cars511", async (HttpRequest req) =>
{
    // 1) auth
    var expected = Environment.GetEnvironmentVariable("CARS511_TOKEN");
    if (!string.IsNullOrEmpty(expected) &&
        req.Headers.Authorization.ToString() != $"Bearer {expected}")
        return Results.Unauthorized();

    // 2) read payload
    using var doc = await System.Text.Json.JsonDocument.ParseAsync(req.Body);
    var root = doc.RootElement;
    string S(string k) => root.TryGetProperty(k, out var v) ? v.ToString() : "";

    // 3) write to your DB (pseudo — use Npgsql/EF/your CARS API here)
    var id = Guid.NewGuid().ToString("N");
    // INSERT INTO cars511_requests (id, route, direction, begin_location, end_location,
    //   description, start_dt, end_dt, rce_office, raw_payload) VALUES (..., root.GetRawText())
    Console.WriteLine($"CARS511 {id}: {S("route")} {S("direction")} {S("beginLoc")}-{S("endLoc")}");

    return Results.Ok(new { id });
});
app.Run();
```

### Node.js / Express

```js
const express = require('express');
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {                       // CORS
  res.set('Access-Control-Allow-Origin', 'https://YOUR-HOST'); // or '*'
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.post('/api/cars511', async (req, res) => {
  if (process.env.CARS511_TOKEN &&
      req.headers.authorization !== `Bearer ${process.env.CARS511_TOKEN}`)
    return res.sendStatus(401);
  const p = req.body;
  // await db.query('INSERT INTO cars511_requests (route, direction, ..., raw_payload) VALUES (...)',
  //   [p.route, p.direction, ..., JSON.stringify(p)]);
  const id = Date.now().toString(36);
  res.json({ id });
});
app.listen(8080);
```

### Python / Flask

```python
from flask import Flask, request, jsonify
import os, json, uuid
app = Flask(__name__)

@app.after_request
def cors(r):
    r.headers['Access-Control-Allow-Origin'] = 'https://YOUR-HOST'  # or '*'
    r.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    r.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    return r

@app.route('/api/cars511', methods=['POST', 'OPTIONS'])
def cars511():
    if request.method == 'OPTIONS':
        return ('', 204)
    token = os.environ.get('CARS511_TOKEN')
    if token and request.headers.get('Authorization') != f'Bearer {token}':
        return ('', 401)
    p = request.get_json(force=True)
    rec_id = uuid.uuid4().hex
    # cursor.execute("INSERT INTO cars511_requests (route, direction, ..., raw_payload) VALUES (%s, ...)",
    #                (p.get('route'), p.get('direction'), ..., json.dumps(p)))
    return jsonify(id=rec_id)
```

### Suggested table (PostgreSQL / PostGIS)

```sql
CREATE TABLE cars511_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route         text, direction text, project_number text,
  begin_location text, end_location text, counties text,
  description   text, traffic_impact text, is_iwz boolean,
  start_dt      timestamptz, end_dt timestamptz,
  rce_office    text, requestor_name text, requestor_email text,
  dms_request   text, additional_info text,
  geom          geometry(LineString, 4326),
  devices       jsonb, schedule jsonb,
  raw_payload   jsonb NOT NULL,               -- keep the whole thing
  source        text, created_at timestamptz DEFAULT now()
);
```

---

## Part 4 — CORS (the #1 thing that trips people up)

The tool runs in a browser, so the endpoint must return the right CORS headers or the browser blocks the POST. Two clean options:

1. **Host the HTML on the same origin as the API** (e.g. serve `cars511-request.html` from the same site/domain as `/api/cars511`) → no CORS config needed.
2. **Allow the tool's origin** in the endpoint (`Access-Control-Allow-Origin`). If operators open the file locally (`file://`), browsers send `Origin: null` — allow `*` on an internal, token-protected endpoint, or (better) host the HTML on the intranet.

Also handle the preflight `OPTIONS` request (the examples above do).

---

## Part 5 — Auth & security checklist

- [ ] Serve the endpoint over **HTTPS** only.
- [ ] Set a shared secret in `CARS511_TOKEN`; operators paste `Bearer <token>` into the tool's Authorization box (stored only in that browser's localStorage).
- [ ] **Validate/sanitize** every field server-side; never trust client input. Store the whole payload in `raw_payload` for audit.
- [ ] Rate-limit and log submissions.
- [ ] The token lives in the operator's browser — treat it as a low-privilege intake key (write-only to the intake table), not a broad credential. Rotate if a device is lost.

---

## Part 6 — Configure the tool & test

1. Open the CARS 511 Builder, expand **🗄️ Submit to database**.
2. Enter your **endpoint URL** and (if used) the **Authorization header** value. These are saved on that device.
3. Fill a test request, press **Submit to database** → confirm you see "✓ Submitted — record …" and the row appears in your table.
4. Test from the command line without the browser:

```bash
curl -X POST https://YOUR-HOST/api/cars511 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d @cars511_example.json      # use the tool's "Download JSON payload" button to create this
```

If the browser POST is ever blocked (CORS/offline), operators can use **⬇ Download JSON payload** and hand the file to an automated importer — same schema.

---

## Bonus — it's WZDx-ready

The `geometry` object is already a WGS84 GeoJSON `LineString`, and `devices`/dates map cleanly to WZDx `RoadEventFeature` fields. The same endpoint that fills your database can emit a WZDx feed (see `docs/wzdx-diy/`), so a closure an inspector files can also feed the national Work Zone Data Exchange.
