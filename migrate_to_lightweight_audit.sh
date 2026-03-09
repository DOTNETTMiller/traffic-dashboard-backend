#!/bin/bash
# Migrate from Heavy to Lightweight IPAWS Audit Log

echo "🔄 Migrating to Lightweight IPAWS Audit Log"
echo "=========================================="
echo ""

# Backup database first
echo "1️⃣  Creating backup..."
cp states.db states.db.backup-$(date +%Y%m%d-%H%M%S)
echo "   ✅ Backup created"
echo ""

# Create lightweight table
echo "2️⃣  Creating lightweight audit table..."
sqlite3 states.db < migrations/create_ipaws_audit_log_lightweight.sql
echo "   ✅ Table created: ipaws_alert_log_lite"
echo ""

# Optional: Migrate existing data
echo "3️⃣  Migrate existing data? (y/n)"
read -r migrate

if [ "$migrate" = "y" ]; then
  echo "   Migrating data from heavy to lightweight table..."

  sqlite3 states.db <<EOF
INSERT INTO ipaws_alert_log_lite (
  alert_id, user_id, created_at, status,
  alert_data, geofence_data, channels,
  duration_minutes, issued_at, cancelled_at,
  cancellation_reason, sop_version
)
SELECT
  alert_id,
  user_id,
  created_at,
  status,
  json_object(
    'corridor', corridor,
    'direction', direction,
    'location', location,
    'mileMarker', mile_marker_range,
    'eventType', event_type,
    'severity', severity,
    'headline', headline_english,
    'instruction', instruction_english,
    'headlineSpanish', headline_spanish,
    'qualified', qualified,
    'qualificationReason', qualification_reason
  ),
  json_object(
    'polygon', geofence_polygon,
    'buffer', geofence_buffer_miles,
    'area', geofence_area_sq_miles,
    'population', estimated_population,
    'rural', population_rural,
    'urban', population_urban,
    'isAsymmetric', geofence_is_asymmetric,
    'corridorAhead', corridor_ahead_miles,
    'corridorBehind', corridor_behind_miles
  ),
  CASE
    WHEN channel_wea = 1 AND channel_eas = 1 THEN 'WEA,EAS'
    WHEN channel_wea = 1 THEN 'WEA'
    WHEN channel_eas = 1 THEN 'EAS'
    ELSE 'WEA'
  END,
  duration_minutes,
  issued_at,
  cancelled_at,
  cancellation_reason,
  sop_version
FROM ipaws_alert_log;
EOF

  migrated=$(sqlite3 states.db "SELECT COUNT(*) FROM ipaws_alert_log_lite;")
  echo "   ✅ Migrated $migrated records"
  echo ""
fi

# Stats
echo "4️⃣  Database Statistics:"
echo "   ----------------------------------------"
heavy_size=$(sqlite3 states.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='ipaws_alert_log';" 2>/dev/null)
if [ "$heavy_size" = "1" ]; then
  heavy_count=$(sqlite3 states.db "SELECT COUNT(*) FROM ipaws_alert_log;")
  echo "   Heavy table:       $heavy_count records"
fi

lite_count=$(sqlite3 states.db "SELECT COUNT(*) FROM ipaws_alert_log_lite;")
echo "   Lightweight table: $lite_count records"
echo "   ----------------------------------------"
echo ""

# Next steps
echo "5️⃣  Next Steps:"
echo "   1. Update ipaws-alert-service.js to use lightweight logger"
echo "   2. Test with: node test_sop_compliance.js"
echo "   3. Once verified, optionally drop old table:"
echo "      sqlite3 states.db 'DROP TABLE ipaws_alert_log;'"
echo ""
echo "✅ Migration complete!"
