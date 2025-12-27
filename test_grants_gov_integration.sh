#!/bin/bash

# Test script for Grants.gov API Integration
# This script tests all the new endpoints to verify they're working correctly

echo "🧪 Testing Grants.gov API Integration"
echo "======================================"
echo ""

# Set the base URL (adjust if needed)
BASE_URL="http://localhost:3001"

# Test 1: Live Grant Search
echo "1️⃣  Testing Live Grant Search..."
echo "POST ${BASE_URL}/api/grants/search-live"
curl -s -X POST "${BASE_URL}/api/grants/search-live" \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "intelligent transportation systems",
    "fundingAgency": "DOT",
    "status": "forecasted,posted"
  }' | jq '.success, .totalResults, .opportunities[0].title // "No opportunities found"'
echo ""
echo ""

# Test 2: Connected Corridors Match
echo "2️⃣  Testing Connected Corridors Matcher..."
echo "POST ${BASE_URL}/api/grants/connected-corridors-match"
curl -s -X POST "${BASE_URL}/api/grants/connected-corridors-match" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Deploy V2X infrastructure and connected vehicle systems along I-80 corridor with multi-state coordination",
    "primaryCorridor": "I-80",
    "requestedAmount": 8500000,
    "geographicScope": "multi-state",
    "stateKey": "IA"
  }' | jq '.success, .connectedCorridorsStrategy.alignmentScore, .curatedGrants[0].name // "No matches", .liveOpportunities[0].title // "No live opportunities"'
echo ""
echo ""

# Test 3: Deadline Monitoring
echo "3️⃣  Testing Deadline Monitoring..."
echo "GET ${BASE_URL}/api/grants/monitor-deadlines?daysAhead=60"
curl -s "${BASE_URL}/api/grants/monitor-deadlines?daysAhead=60" \
  | jq '.success, .deadlineAlerts.total, .deadlineAlerts.critical[0].title // "No critical deadlines"'
echo ""
echo ""

# Test 4: Original Grant Recommender (ensure still works)
echo "4️⃣  Testing Original Grant Recommender..."
echo "POST ${BASE_URL}/api/grants/recommend"
curl -s -X POST "${BASE_URL}/api/grants/recommend" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Connected vehicle V2X deployment",
    "primaryCorridor": "I-35",
    "requestedAmount": 5000000,
    "geographicScope": "state",
    "stateKey": "IA"
  }' | jq '.success, .recommendations.topMatches[0].name // "No recommendations", .context'
echo ""
echo ""

echo "✅ Integration tests complete!"
echo ""
echo "Expected Results:"
echo "- Live search should return current DOT grants from Grants.gov"
echo "- Connected Corridors match should return 85%+ alignment score"
echo "- Deadline monitoring should list upcoming DOT grants"
echo "- Original recommender should still work (backward compatibility)"
echo ""
echo "If any tests fail, check:"
echo "1. Server is running on port 3001"
echo "2. Grants.gov API is accessible (no firewall issues)"
echo "3. Database tables exist (its_equipment, truck_parking_facilities)"
