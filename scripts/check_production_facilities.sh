#!/bin/bash
# Query production facilities directly via Railway bash
# Usage: railway run bash scripts/check_production_facilities.sh

echo "🔍 Checking production facilities..."
echo ""

# Count all facilities
echo "📊 Total facilities:"
echo "SELECT COUNT(*) as total FROM parking_facilities;" | psql $DATABASE_URL -t

# Count by state
echo ""
echo "Facilities by state:"
echo "SELECT state, COUNT(*) as count FROM parking_facilities GROUP BY state ORDER BY state;" | psql $DATABASE_URL -t

# Show Iowa facilities
echo ""
echo "🌽 Iowa facilities:"
echo "SELECT facility_id, site_id, latitude, longitude FROM parking_facilities WHERE state = 'IA' ORDER BY facility_id;" | psql $DATABASE_URL -t

# Check for zero coordinates
echo ""
echo "⚠️  Facilities with zero coordinates:"
echo "SELECT state, COUNT(*) as count FROM parking_facilities WHERE latitude = 0 OR longitude = 0 GROUP BY state;" | psql $DATABASE_URL -t
