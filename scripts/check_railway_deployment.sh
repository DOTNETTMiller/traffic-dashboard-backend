#!/bin/bash

echo "🔍 Railway Deployment Diagnostic"
echo "================================="
echo ""

echo "1. Checking current production version..."
PROD_VERSION=$(curl -s 'https://corridor-communication-dashboard-production.up.railway.app/api/health' | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).version)")
echo "   Production version: $PROD_VERSION"
echo ""

echo "2. Checking local git commit..."
LOCAL_COMMIT=$(git log -1 --oneline)
echo "   Latest commit: $LOCAL_COMMIT"
echo ""

echo "3. Checking I-80 Iowa event snapping..."
SNAPPED=$(curl -s 'https://corridor-communication-dashboard-production.up.railway.app/api/events' | node -e "
const events = require('fs').readFileSync(0,'utf8');
const json = JSON.parse(events);
const i80 = json.events.filter(e => e.corridor?.includes('I-80') && e.state === 'Iowa');
const curved = i80.filter(e => e.geometry?.coordinates?.length > 2);
console.log(curved.length + '/' + i80.length);
")
echo "   Events with curved geometry: $SNAPPED"
echo ""

echo "4. Expected status after deployment:"
echo "   ✓ Version should include commit hash (1.1.1-xxxxxx)"
echo "   ✓ Snapped events should be: ~41/41 (100%)"
echo ""

if [[ "$PROD_VERSION" == "1.1.1" ]]; then
  echo "❌ PROBLEM DETECTED: Version shows no commit hash"
  echo ""
  echo "Possible causes:"
  echo "  1. Railway auto-deployment not enabled for GitHub repo"
  echo "  2. Railway watching wrong branch (should be 'main')"
  echo "  3. Railway service not linked to GitHub repo"
  echo ""
  echo "To fix:"
  echo "  1. Go to: https://railway.app/"
  echo "  2. Open project: corridor-communication-dashboard"
  echo "  3. Settings → Check 'Auto Deploy' is enabled"
  echo "  4. Settings → Check 'Source' is linked to GitHub repo"
  echo "  5. Settings → Check 'Branch' is set to 'main'"
  echo ""
else
  echo "✅ Production is running latest code"
fi
