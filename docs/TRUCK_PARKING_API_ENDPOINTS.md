# Sandbox Truck Parking API Endpoints

All truck-parking endpoints served by the Corridor Communicator sandbox
(`backend_proxy_server.js`), grouped by function. 40 endpoints total.
Prefix each path with the sandbox base URL; `:param` segments are path
parameters. `GET` data endpoints are public unless noted; `POST` admin and
retraining endpoints require auth. Line numbers reference
`backend_proxy_server.js` for maintainers.

These are the operational instruments behind the ATTAIN application's
truck-parking element — availability, prediction, ground truth, calibration,
and accuracy tracking are all live services, not proposals.

## 1. Facilities & Live Availability

| Method | Endpoint | Purpose | Line |
|---|---|---|---|
| GET | `/api/parking/facilities` | All known truck parking facilities (location, capacity, amenities) | 35040 |
| GET | `/api/parking/availability` | Current space availability across all facilities | 35199 |
| GET | `/api/parking/availability/:facilityId` | Current availability for one facility | 35210 |
| GET | `/api/parking/nearby` | Facilities near a point (lat/lon radius search) | 35336 |
| GET | `/api/parking/history/:facilityId` | Availability history for one facility | 35227 |
| GET | `/api/maasto-tpims` | Raw MAASTO TPIMS feed passthrough (IL, KY, MN sources) | 35183 |

## 2. Prediction Engine

| Method | Endpoint | Purpose | Line |
|---|---|---|---|
| GET | `/api/parking/predict/:facilityId` | Occupancy prediction for one facility | 35305 |
| GET | `/api/parking/predict-all` | Predictions across all facilities | 35324 |
| GET | `/api/truck-parking/predictions` | Prediction summary feed (consumer-facing) | 17281 |
| GET | `/api/parking/historical/predict/:facilityId` | Hourly prediction from the historical model, one facility | 35390 |
| GET | `/api/parking/historical/predict-all` | Hourly predictions from the historical model, all facilities | 35480 |
| GET | `/api/parking/analyze/:facilityId` | Facility-level pattern analysis (peak hours, fill behavior) | 35356 |

## 3. Ground Truth & AI Occupancy Counts

| Method | Endpoint | Purpose | Line |
|---|---|---|---|
| GET | `/api/parking/ground-truth` | Ground-truth observations on record | 35616 |
| POST | `/api/parking/ground-truth/observations` | Submit a manual ground-truth observation | 35746 |
| POST | `/api/parking/ground-truth/ai-count` | AI occupancy count from a rest-area camera image (Iowa cameras live) | 35819 |
| POST | `/api/parking/ground-truth/ai-count-consensus` | Multi-pass AI count with consensus scoring | 36074 |
| GET | `/api/parking/ground-truth/accuracy` | Prediction-vs-ground-truth accuracy metrics | 36376 |
| POST | `/api/parking/ground-truth/retrain` | Retrain the prediction model against accumulated ground truth | 36488 |

## 4. Calibration & Validation

| Method | Endpoint | Purpose | Line |
|---|---|---|---|
| POST | `/api/parking/calibrate` | Run model calibration against observed availability | 18263 |
| GET | `/api/parking/calibration/status` | Current calibration state | 18274 |
| GET | `/api/parking/calibration/weights` | Model weights in use | 18279 |
| GET | `/api/parking/validation` | Validation report — predicted vs. actual | 36813 |

## 5. Historical Data (model training layer)

| Method | Endpoint | Purpose | Line |
|---|---|---|---|
| GET | `/api/parking/historical/summary` | Coverage summary of the historical occupancy archive | 35573 |
| GET | `/api/parking/historical/state/:stateCode` | Historical data for one state | 35556 |
| GET | `/api/parking/historical/diagnose` | Data-quality diagnostics on the archive | 36645 |
| POST | `/api/parking/historical/reload` | Reload historical dataset | 35589 |
| POST | `/api/parking/historical/migrate` | Migrate archive schema | 36727 |
| POST | `/api/parking/historical/fix-volume` | Repair volume anomalies in archive | 36682 |
| POST | `/api/parking/historical/update-coordinates` | Fix facility coordinates in archive | 36755 |

## 6. Work Zone / Closure Linkage

| Method | Endpoint | Purpose | Line |
|---|---|---|---|
| GET | `/api/parking/closure-impact` | Facilities likely to fill due to active closures/work zones nearby — the closure→parking linkage in the ATTAIN architecture | 35057 |

## 7. Admin / Ingest (auth required)

| Method | Endpoint | Purpose | Line |
|---|---|---|---|
| POST | `/api/admin/parking/facility` | Create/update a facility record | 35240 |
| POST | `/api/admin/parking/availability` | Manually post availability | 35273 |
| POST | `/api/admin/parking/fetch-tpims` | Trigger TPIMS feed fetch | 36783 |
| POST | `/api/admin/parking/generate-predictions` | Force prediction generation run | 35375 |
| POST | `/api/admin/import-facilities` | Bulk facility import | — |

## 8. Vendor / Partner Data (private-data on-ramp)

| Method | Endpoint | Purpose | Line |
|---|---|---|---|
| GET | `/api/vendors/truck-parking` | Vendor-submitted parking data on record | 16698 |
| GET | `/api/vendors/truck-parking/:facilityId/latest` | Latest vendor reading for a facility | 16723 |
| POST | `/api/vendors/truck-parking/predict/:facilityId` | Vendor-data-driven prediction for a facility | 16777 |

## 9. Assistant / GPT Integration (API-key access)

| Method | Endpoint | Purpose | Line |
|---|---|---|---|
| GET | `/api/chatgpt/parking/facilities` | Facilities list for GPT integration | 37605 |
| GET | `/api/chatgpt/parking/availability` | Availability for GPT integration | 37622 |
| GET | `/api/chatgpt/parking/history/:facilityId` | History for GPT integration | 37638 |

---

**Upstream sources feeding these endpoints** (see `EXTERNAL_DATA_SOURCES.md`):
Illinois TPIMS (TravelMidwest), Kentucky TRIMARC, Minnesota IRIS, Nevada
nvroads, and Iowa rest-area camera snapshots (`atmsqf.iowadot.gov`) used by
the AI ground-truth counting endpoints.

**ATTAIN mapping:** groups 1–2 = the availability/prediction product;
groups 3–5 = the performance measurement plan (accuracy tracked against
ground truth, models trained on historical archives); group 6 = the
closure→parking linkage; group 8 = the private-partner data on-ramp
(fleet telematics / ELD / crowd-sourced inputs land here).
