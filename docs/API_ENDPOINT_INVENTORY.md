# Corridor Communicator — API Endpoint Inventory

Auto-extracted from `backend_proxy_server.js` (all `app.get/post/put/delete/patch` registrations). 475 endpoints across ~80 functional groups. Regenerate with:

```bash
grep -nE "^\s*app\.(get|post|put|delete|patch)\(" backend_proxy_server.js
```

`:param` segments are Express path parameters. Endpoints under `admin`, `users`, `states` require auth; `chatgpt/*` uses API-key access; most `GET` data endpoints are public.

## Functional Groups (endpoint counts)

| Area | Groups |
|---|---|
| **Core event data** | events, wzdx, cifs, convert (TIM/CIFS), tomtom, crashes, major-events, weather-alerts, warnings, geofences |
| **Corridor operations** | corridor, corridors, closures, diversion-routes, detour-alerts, dms, corridor-briefing, corridor-regulations, ttri (travel-time reliability) |
| **Truck parking** | parking (28), truck-parking, maasto-tpims, vendors/truck-parking |
| **Data quality & measurement** | data-quality (23), quality, confidence, analysis, coverage-gaps, compliance, reports (state report cards) |
| **Freight & clearance** | bridges, bridge-clearances, bridge-warnings, state-osow-regulations, border-wait-times, border-notifications |
| **Grants** | grants (23), funding-opportunities |
| **ITS / infrastructure** | its-equipment (18), assets, asset-health, equipment, predictive-maintenance, network, v2x, cv (connected vehicle TIM), digital-infrastructure (BIM/IFC), bim, cadd, aerial-overlays, wfs |
| **Emergency alerting** | ipaws (33) |
| **Analytics & prediction** | analytics, predictive, population, nasco |
| **Collaboration** | calendar (I-80 coalition), messages, community, biweekly-reports, feeds (submissions), plugins |
| **Platform** | users, admin (32), states (inter-state messaging), chatgpt (GPT integration), chat (AI assistant), scheduler, documentation, health/db-status/debug, procurement, projects, traveler, osrm (routing) |

## All Endpoints by Group
- `GET *`

### admin
- `DELETE /api/admin/interchanges/:id`
- `DELETE /api/admin/states/:stateKey`
- `DELETE /api/admin/users/:userId`
- `GET /api/admin/feeds/submissions`
- `GET /api/admin/interchanges`
- `GET /api/admin/states`
- `GET /api/admin/test-state/:stateKey`
- `GET /api/admin/users`
- `POST /api/admin/apply-coordinate-offsets`
- `POST /api/admin/detour-alerts/:id/resolve`
- `POST /api/admin/feeds/submissions/:id/resolve`
- `POST /api/admin/fix-tetc-urls`
- `POST /api/admin/generate-token`
- `POST /api/admin/import-facilities`
- `POST /api/admin/interchanges`
- `POST /api/admin/messages`
- `POST /api/admin/migrate-digital-infrastructure`
- `POST /api/admin/migrate-grants`
- `POST /api/admin/migrate-its`
- `POST /api/admin/migrate-state-osow`
- `POST /api/admin/migrate-users`
- `POST /api/admin/parking/availability`
- `POST /api/admin/parking/facility`
- `POST /api/admin/parking/fetch-tpims`
- `POST /api/admin/parking/generate-predictions`
- `POST /api/admin/populate-states`
- `POST /api/admin/states`
- `POST /api/admin/users`
- `POST /api/admin/users/:userId/reset-password`
- `PUT /api/admin/interchanges/:id`
- `PUT /api/admin/states/:stateKey`
- `PUT /api/admin/users/:userId`

### aerial-overlays
- `DELETE /api/aerial-overlays/:id`
- `GET /api/aerial-overlays`
- `GET /api/aerial-overlays/:id/image`
- `PATCH /api/aerial-overlays/:id`
- `POST /api/aerial-overlays/upload-image`
- `POST /api/aerial-overlays/upload-tif`

### analysis
- `GET /api/analysis/feed-alignment`
- `GET /api/analysis/normalization`

### analytics
- `GET /api/analytics/comparison`
- `GET /api/analytics/corridor/:corridor`
- `GET /api/analytics/state/:state`
- `GET /api/analytics/summary`
- `GET /api/analytics/trends`

### asset-health
- `GET /api/asset-health/asset/:assetId`
- `GET /api/asset-health/coverage-gaps/:stateKey`
- `GET /api/asset-health/dashboard/:stateKey`
- `GET /api/asset-health/maintenance/upcoming`
- `POST /api/asset-health/maintenance/schedule`
- `POST /api/asset-health/monitor/:assetId`

### assets
- `GET /api/assets/critical-alerts`
- `GET /api/assets/health`
- `GET /api/assets/predictive-maintenance`

### bim
- `GET /api/bim/bridges`
- `GET /api/bim/models`
- `GET /api/bim/models/:id`

### biweekly-reports
- `DELETE /api/biweekly-reports/:id`
- `GET /api/biweekly-reports`
- `POST /api/biweekly-reports`
- `PUT /api/biweekly-reports/:id`

### border-notifications
- `GET /api/border-notifications`
- `GET /api/border-notifications/config`
- `POST /api/border-notifications/check`
- `PUT /api/border-notifications/config`

### border-wait-times
- `GET /api/border-wait-times`

### bridge-clearances
- `POST /api/bridge-clearances/bulk-import`
- `POST /api/bridge-clearances/import`
- `POST /api/bridge-clearances/sync-hub`

### bridge-warnings
- `GET /api/bridge-warnings/active`

### bridges
- `GET /api/bridges/all`

### cadd
- `DELETE /api/cadd/models/:id`
- `GET /api/cadd/export-formats`
- `GET /api/cadd/export/:format`
- `GET /api/cadd/map-elements`
- `GET /api/cadd/models`
- `GET /api/cadd/models/:id`
- `GET /api/cadd/models/:id/export/csv`
- `GET /api/cadd/models/:id/export/geojson`
- `POST /api/cadd/upload`

### calendar
- `DELETE /api/calendar/artifacts/:id`
- `DELETE /api/calendar/events/:id`
- `DELETE /api/calendar/progress/:id`
- `GET /api/calendar/events`
- `GET /api/calendar/events/:id`
- `GET /api/calendar/events/:id/artifacts`
- `GET /api/calendar/events/:id/download.ics`
- `GET /api/calendar/i80-coalition.ics`
- `GET /api/calendar/progress`
- `POST /api/calendar/events`
- `POST /api/calendar/events/:id/analyze-minutes`
- `POST /api/calendar/events/:id/artifacts`
- `POST /api/calendar/events/:id/rsvp`
- `POST /api/calendar/progress`
- `POST /api/calendar/progress/upload-minutes`
- `PUT /api/calendar/events/:id`

### chat
- `DELETE /api/chat/history`
- `GET /api/chat/history`
- `POST /api/chat`

### chatgpt
- `GET /api/chatgpt/detour-alerts`
- `GET /api/chatgpt/docs`
- `GET /api/chatgpt/events`
- `GET /api/chatgpt/events/:state`
- `GET /api/chatgpt/events/id/:eventId`
- `GET /api/chatgpt/interchanges`
- `GET /api/chatgpt/messages`
- `GET /api/chatgpt/messages/event/:eventId`
- `GET /api/chatgpt/parking/availability`
- `GET /api/chatgpt/parking/facilities`
- `GET /api/chatgpt/parking/history/:facilityId`
- `GET /api/chatgpt/states`
- `GET /api/chatgpt/users`
- `POST /api/chatgpt/generate-key`

### cifs
- `DELETE /api/cifs/messages/expired`
- `GET /api/cifs/itis/:code`
- `GET /api/cifs/messages`
- `POST /api/cifs/convert/wzdx`
- `POST /api/cifs/cv-tim`
- `POST /api/cifs/feed/:feedId/poll`
- `POST /api/cifs/feed/subscribe`
- `POST /api/cifs/tim`

### closures
- `DELETE /api/closures/:id`
- `GET /api/closures`
- `GET /api/closures/:id`
- `POST /api/closures`
- `POST /api/closures/:id/approve`
- `POST /api/closures/:id/comments`
- `POST /api/closures/:id/submit`
- `PUT /api/closures/:id`

### community
- `GET /api/community/contributions`
- `GET /api/community/gaps`
- `GET /api/community/status`
- `POST /api/community/contribute`
- `POST /api/community/migrate`
- `POST /api/community/vote`

### compliance
- `GET /api/compliance/guide/:state`
- `GET /api/compliance/state/:stateKey`
- `GET /api/compliance/summary`

### confidence
- `GET /api/confidence/events`
- `GET /api/confidence/vendor-reliability`

### convert
- `GET /api/convert/cifs`
- `GET /api/convert/tim`
- `GET /api/convert/tim-cv`

### corridor
- `GET /api/corridor/:corridor/delays`
- `GET /api/corridor/:corridor/travel-time`
- `GET /api/corridor/available`
- `GET /api/corridor/delays/summary`
- `POST /api/corridor/generate-summary`

### corridor-briefing
- `GET /api/corridor-briefing/:corridor`

### corridor-regulations
- `GET /api/corridor-regulations`

### corridors
- `GET /api/corridors/:corridorId/compare-providers`
- `GET /api/corridors/:corridorId/scores`

### coverage-gaps
- `GET /api/coverage-gaps/summary/:stateKey`
- `POST /api/coverage-gaps/analyze/:stateKey`

### crashes
- `GET /api/crashes/historical`
- `GET /api/crashes/live`
- `GET /api/crashes/stats`
- `POST /api/crashes/refresh`
- `POST /api/crashes/report`

### cv
- `GET /api/cv/messages`
- `GET /api/cv/rsus`
- `GET /api/cv/transmissions/:messageId`
- `POST /api/cv/broadcast/:messageId`
- `POST /api/cv/generate-tim`

### data-quality
- `GET /api/data-quality/check-geometries`
- `GET /api/data-quality/check-postgres`
- `GET /api/data-quality/corridor/:corridorId`
- `GET /api/data-quality/corridor/:corridorId/service/:serviceTypeId`
- `GET /api/data-quality/corridors`
- `GET /api/data-quality/corridors/test`
- `GET /api/data-quality/coverage-gaps`
- `GET /api/data-quality/env-check`
- `GET /api/data-quality/gap-analysis`
- `GET /api/data-quality/history/:stateKey`
- `GET /api/data-quality/leaderboard`
- `GET /api/data-quality/national-report-cards`
- `GET /api/data-quality/report-card/:stateKey`
- `GET /api/data-quality/service-types`
- `GET /api/data-quality/state-rankings`
- `GET /api/data-quality/summary`
- `GET /api/data-quality/trending-summary`
- `GET /api/data-quality/votes`
- `POST /api/data-quality/cron/update-corridor-geometry`
- `POST /api/data-quality/fix-corridor-geometries`
- `POST /api/data-quality/migrate`
- `POST /api/data-quality/populate-geometries`
- `POST /api/data-quality/vote`

### db-status
- `GET /api/db-status`

### debug
- `GET /api/debug/coordinates`
- `GET /api/debug/geometries`

### detour-alerts
- `GET /api/detour-alerts/active`

### digital-infrastructure
- `DELETE /api/digital-infrastructure/models/:modelId`
- `GET /api/digital-infrastructure/elements/:modelId`
- `GET /api/digital-infrastructure/gap-report/:modelId`
- `GET /api/digital-infrastructure/gaps/:modelId`
- `GET /api/digital-infrastructure/ids-export/:modelId`
- `GET /api/digital-infrastructure/models`
- `GET /api/digital-infrastructure/models/:modelId`
- `GET /api/digital-infrastructure/models/:modelId/file`
- `GET /api/digital-infrastructure/standards-report/:modelId`
- `GET /api/digital-infrastructure/status`
- `POST /api/digital-infrastructure/upload`
- `POST /api/digital-infrastructure/upload-base64`

### diversion-routes
- `DELETE /api/diversion-routes/:id`
- `GET /api/diversion-routes`
- `GET /api/diversion-routes/:id`
- `GET /api/diversion-routes/activations`
- `GET /api/diversion-routes/auto-check/:eventId`
- `POST /api/diversion-routes`
- `POST /api/diversion-routes/:id/activate`
- `POST /api/diversion-routes/activations/:activationId/deactivate`
- `PUT /api/diversion-routes/:id`

### dms
- `GET /api/dms/activations`
- `GET /api/dms/auto-rules`
- `GET /api/dms/templates`
- `GET /api/dms/templates/:id`
- `GET /api/dms/templates/pending-approval/:stateCode`
- `POST /api/dms/activate`
- `POST /api/dms/auto-activate`
- `POST /api/dms/deactivate/:activationId`
- `POST /api/dms/templates`
- `POST /api/dms/templates/:templateId/approve`
- `PUT /api/dms/auto-rules/:id`

### docs
- `GET /docs/:filename`

### documentation
- `GET /api/documentation`
- `GET /api/documentation/:docName`
- `GET /api/documentation/auto`
- `GET /api/documentation/list`
- `GET /api/documentation/roadmap`

### equipment
- `GET /api/equipment/:equipmentId/telemetry`
- `GET /api/equipment/health`
- `GET /api/equipment/issues`
- `GET /api/equipment/offline`
- `GET /api/equipment/outages`

### events
- `DELETE /api/events/:eventId/geofence`
- `DELETE /api/events/comments/:id`
- `GET /api/events`
- `GET /api/events/:eventId/comments`
- `GET /api/events/:eventId/compliance`
- `GET /api/events/:state`
- `GET /api/events/comments/all`
- `GET /api/events/stats`
- `POST /api/events/:eventId/comments`
- `POST /api/events/:eventId/geofence`

### feeds
- `POST /api/feeds/submit`

### fix-texas
- `GET /api/fix-texas`

### funding-opportunities
- `GET /api/funding-opportunities`
- `GET /api/funding-opportunities/evidence`

### geofences
- `GET /api/geofences`

### grants
- `DELETE /api/grants/applications/:id`
- `GET /api/grants/applications`
- `GET /api/grants/applications/:id`
- `GET /api/grants/applications/:id/its-equipment`
- `GET /api/grants/letter-templates`
- `GET /api/grants/monitor-deadlines`
- `GET /api/grants/opportunity/:id`
- `GET /api/grants/success-rates`
- `GET /api/grants/templates`
- `POST /api/grants/analyze-proposal`
- `POST /api/grants/applications`
- `POST /api/grants/applications/:id/attach-its-equipment`
- `POST /api/grants/applications/:id/generate-metrics`
- `POST /api/grants/applications/:id/proposal`
- `POST /api/grants/applications/:id/supporting-data`
- `POST /api/grants/connected-corridors-match`
- `POST /api/grants/generate-content`
- `POST /api/grants/generate-letter`
- `POST /api/grants/generate-narrative`
- `POST /api/grants/recommend`
- `POST /api/grants/score-application`
- `POST /api/grants/search-live`
- `PUT /api/grants/applications/:id`

### health
- `GET /api/health`

### interchanges
- `GET /api/interchanges`

### ipaws
- `DELETE /api/ipaws/alerts/:alertId`
- `DELETE /api/ipaws/rules/:id`
- `GET /api/ipaws/after-action-reviews`
- `GET /api/ipaws/after-action-reviews/outstanding`
- `GET /api/ipaws/alerts`
- `GET /api/ipaws/alerts/:alertId`
- `GET /api/ipaws/alerts/active`
- `GET /api/ipaws/certifications/expiring`
- `GET /api/ipaws/rules`
- `GET /api/ipaws/summary/:eventId`
- `GET /api/ipaws/templates`
- `GET /api/ipaws/users`
- `GET /api/ipaws/users/:userId`
- `GET /api/ipaws/users/:userId/violations-summary`
- `GET /api/ipaws/users/refresher-due`
- `GET /api/ipaws/violations`
- `POST /api/ipaws/after-action-reviews`
- `POST /api/ipaws/alerts/:alertId/cancel`
- `POST /api/ipaws/alerts/:alertId/issue`
- `POST /api/ipaws/alerts/:alertId/review`
- `POST /api/ipaws/alerts/:alertId/update`
- `POST /api/ipaws/alerts/export-hsemd`
- `POST /api/ipaws/evaluate`
- `POST /api/ipaws/evaluate-rules`
- `POST /api/ipaws/generate`
- `POST /api/ipaws/rules`
- `POST /api/ipaws/submit`
- `POST /api/ipaws/templates/recommend`
- `POST /api/ipaws/training`
- `POST /api/ipaws/users`
- `POST /api/ipaws/violations`
- `PUT /api/ipaws/rules/:id`
- `PUT /api/ipaws/users/:userId`

### its-equipment
- `DELETE /api/its-equipment/clear-state/:stateKey`
- `GET /api/its-equipment`
- `GET /api/its-equipment/compliance-report`
- `GET /api/its-equipment/export`
- `GET /api/its-equipment/export/radit`
- `GET /api/its-equipment/nearby`
- `GET /api/its-equipment/routes`
- `GET /api/its-equipment/states`
- `GET /api/its-equipment/summary`
- `GET /api/its-equipment/v2x-analysis`
- `GET /api/its-equipment/verify-count`
- `POST /api/its-equipment/along-corridor`
- `POST /api/its-equipment/fix-il-to-ia`
- `POST /api/its-equipment/fix-multi-state`
- `POST /api/its-equipment/reassign-state`
- `POST /api/its-equipment/regenerate-iowa-ids`
- `POST /api/its-equipment/remove-duplicates`
- `POST /api/its-equipment/upload`

### maasto-tpims
- `GET /api/maasto-tpims`

### major-events
- `GET /api/major-events`

### messages
- `DELETE /api/messages/:id`
- `DELETE /api/messages/event/:eventId`
- `GET /api/messages`
- `GET /api/messages/event/:eventId`
- `POST /api/messages`

### nasco-corridor-ai-analysis
- `POST /api/nasco-corridor-ai-analysis`

### nasco-corridor-summary
- `GET /api/nasco-corridor-summary`

### network
- `GET /api/network/connections/:deviceId`
- `GET /api/network/topology`

### osrm
- `GET /api/osrm/route`

### parking
- `GET /api/parking/analyze/:facilityId`
- `GET /api/parking/availability`
- `GET /api/parking/availability/:facilityId`
- `GET /api/parking/calibration/status`
- `GET /api/parking/calibration/weights`
- `GET /api/parking/closure-impact`
- `GET /api/parking/facilities`
- `GET /api/parking/ground-truth`
- `GET /api/parking/ground-truth/accuracy`
- `GET /api/parking/historical/diagnose`
- `GET /api/parking/historical/predict-all`
- `GET /api/parking/historical/predict/:facilityId`
- `GET /api/parking/historical/state/:stateCode`
- `GET /api/parking/historical/summary`
- `GET /api/parking/history/:facilityId`
- `GET /api/parking/nearby`
- `GET /api/parking/predict-all`
- `GET /api/parking/predict/:facilityId`
- `GET /api/parking/validation`
- `POST /api/parking/calibrate`
- `POST /api/parking/ground-truth/ai-count`
- `POST /api/parking/ground-truth/ai-count-consensus`
- `POST /api/parking/ground-truth/observations`
- `POST /api/parking/ground-truth/retrain`
- `POST /api/parking/historical/fix-volume`
- `POST /api/parking/historical/migrate`
- `POST /api/parking/historical/reload`
- `POST /api/parking/historical/update-coordinates`

### plugins
- `GET /api/plugins/analytics/:providerId`
- `GET /api/plugins/events`
- `GET /api/plugins/providers`
- `POST /api/plugins/events`
- `POST /api/plugins/register`

### population
- `GET /api/population/heatmap`
- `POST /api/population/estimate`
- `POST /api/population/exclude-urban`
- `POST /api/population/suggest-adjustment`
- `POST /api/population/visualization`

### predictive
- `GET /api/predictive/congestion-forecast`
- `GET /api/predictive/dynamic-routing`
- `GET /api/predictive/incident-impact`
- `GET /api/predictive/safety-risk`

### predictive-maintenance
- `GET /api/predictive-maintenance/cost-savings/:stateKey`
- `GET /api/predictive-maintenance/critical-alerts/:stateKey`
- `POST /api/predictive-maintenance/predict/:stateKey`

### procurement
- `DELETE /api/procurement/contracts/:id`
- `GET /api/procurement/contracts`
- `GET /api/procurement/cost-analysis`
- `GET /api/procurement/expiration-alerts`
- `POST /api/procurement/contracts`
- `PUT /api/procurement/contracts/:id`

### projects
- `DELETE /api/projects/:id`
- `GET /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects`
- `PUT /api/projects/:id`

### quality
- `GET /api/quality/anomalies`
- `GET /api/quality/event/:eventId`
- `GET /api/quality/feed/:feedKey`
- `GET /api/quality/feeds`

### reports
- `GET /api/reports/:stateCode/:month`
- `GET /api/reports/contact/:stateCode`
- `GET /api/reports/history/:stateCode`
- `GET /api/reports/rankings/:month`
- `POST /api/reports/generate/:month`
- `POST /api/reports/send-all`
- `POST /api/reports/send/:stateCode`
- `PUT /api/reports/contact/:stateCode`

### scheduler
- `GET /api/scheduler/status`
- `POST /api/scheduler/trigger/:jobName`

### state-osow-regulations
- `GET /api/state-osow-regulations`
- `GET /api/state-osow-regulations/:stateKey`
- `PUT /api/state-osow-regulations/:stateKey`

### states
- `DELETE /api/states/messages/:id`
- `DELETE /api/states/messages/bulk/detour-advisories`
- `GET /api/states/inbox`
- `GET /api/states/list`
- `GET /api/states/sent`
- `POST /api/states/login`
- `POST /api/states/messages`
- `POST /api/states/messages/:id/read`
- `POST /api/states/password`

### tomtom
- `GET /api/tomtom/incidents`

### traveler
- `GET /api/traveler/corridors`
- `GET /api/traveler/events`
- `GET /api/traveler/status`

### truck-parking
- `GET /api/truck-parking/predictions`

### ttri
- `GET /api/ttri/corridor/:corridor`
- `GET /api/ttri/corridors`
- `GET /api/ttri/observations`
- `POST /api/ttri/aggregate-monthly`
- `POST /api/ttri/calculate`

### users
- `DELETE /api/users/subscriptions/:stateKey`
- `GET /api/users/me`
- `GET /api/users/subscriptions`
- `POST /api/users/change-password`
- `POST /api/users/login`
- `POST /api/users/register`
- `POST /api/users/request-password-reset`
- `POST /api/users/subscriptions/:stateKey`
- `PUT /api/users/notifications`
- `PUT /api/users/password`
- `PUT /api/users/profile`
- `PUT /api/users/subscriptions`

### v2x
- `GET /api/v2x/deployments`
- `GET /api/v2x/rsus`

### vendors
- `GET /api/vendors/:vendorId/capabilities`
- `GET /api/vendors/:vendorId/quality-score`
- `GET /api/vendors/api-usage/:providerId`
- `GET /api/vendors/quality-scores`
- `GET /api/vendors/segment-enrichment`
- `GET /api/vendors/truck-parking`
- `GET /api/vendors/truck-parking/:facilityId/latest`
- `GET /api/vendors/uploads/:providerId`
- `GET /api/vendors/votes`
- `POST /api/vendors/truck-parking/predict/:facilityId`
- `POST /api/vendors/upload`
- `POST /api/vendors/vote`

### warnings
- `GET /api/warnings`
- `GET /api/warnings/corridor/:corridorName`

### weather-alerts
- `GET /api/weather-alerts`

### wfs
- `DELETE /api/wfs/connections/:connectionId`
- `GET /api/wfs/connections`
- `GET /api/wfs/sync-history/:connectionId`
- `POST /api/wfs/connections`
- `POST /api/wfs/sync/:connectionId`
- `POST /api/wfs/test`

### wzdx
- `GET /api/wzdx/feed`
- `GET /api/wzdx/feed/:state`
- `GET /api/wzdx/stats`
- `GET /api/wzdx/upgraded/feed`
- `GET /api/wzdx/upgraded/feed/:state`
- `GET /api/wzdx/upgraded/states`
- `GET /api/wzdx/upgraded/stats`
- `POST /api/wzdx/validate`

### xapi
- `POST /xapi/admin/apply-coordinate-offsets`
- `POST /xapi/admin/import-facilities`
