#!/bin/bash
# View detailed scorecard for a state
# Usage: ./view_state_scorecard.sh utah

STATE=${1:-utah}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           STATE DATA QUALITY SCORECARD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -s "http://localhost:3001/api/compliance/guide/$STATE" | python3 << 'PYTHON'
import sys, json

data = json.load(sys.stdin)

# Header
print(f"\n🏛️  State: {data['state']}")
print(f"📅 Generated: {data['generatedAt'][:10]}")
print(f"📊 Current Format: {data['currentFormat']['apiType']}")

# Overall Score
score = data['overallScore']
print(f"\n{'='*60}")
print(f"  OVERALL SCORE: {score['percentage']}/100 (Grade {score['grade']})")
print(f"  {score['rank']}")
print(f"{'='*60}")

# Category Breakdown
print(f"\n📋 CATEGORY BREAKDOWN:\n")

for cat_key, category in data['categoryScores'].items():
    emoji = '🔴' if category['percentage'] < 70 else ('🟡' if category['percentage'] < 85 else '🟢')
    print(f"{emoji} {category['name']}")
    print(f"   Score: {category['totalScore']}/{category['maxScore']} ({category['percentage']}%)")
    print(f"   Weight: {category['weight']} points\n")

    for field in category['fields']:
        status_emoji = '✅' if field['status'] == 'PASS' else '❌'
        bar_length = int(field['score'] / 10)
        bar = '█' * bar_length + '░' * (10 - bar_length)
        print(f"   {status_emoji} {field['field']:20s} [{bar}] {field['score']:3.0f}%")
        print(f"      {field['currentPoints']}/{field['maxPoints']} points | {field['impact']}")
    print()

# Action Plan
plan = data['actionPlan']
if plan['immediate']:
    print(f"⚠️  IMMEDIATE ACTIONS REQUIRED: {len(plan['immediate'])}")
    for i, action in enumerate(plan['immediate'], 1):
        print(f"   {i}. {action['field']} (Current: {action['currentScore']}%)")
        print(f"      → Gain {action['pointsGained']} points | {action['impact']}")

if plan['shortTerm']:
    print(f"\n📅 SHORT-TERM IMPROVEMENTS: {len(plan['shortTerm'])}")
    for i, action in enumerate(plan['shortTerm'], 1):
        print(f"   {i}. {action['field']} (Current: {action['currentScore']}%)")
        print(f"      → Gain {action['pointsGained']} points")

if plan['longTerm']:
    print(f"\n🎯 LONG-TERM ENHANCEMENTS: {len(plan['longTerm'])}")
    for i, action in enumerate(plan['longTerm'], 1):
        print(f"   {i}. {action['field']} (Current: {action['currentScore']}%)")

# Improvement Potential
potential = data['improvementPotential']
if potential['immediateActions'] > 0:
    print(f"\n{'='*60}")
    print(f"💡 IMPROVEMENT POTENTIAL")
    print(f"{'='*60}")
    print(f"{potential['message']}")
    print(f"Potential score increase: +{potential['potentialScoreIncrease']} points")

print(f"\n{'='*60}")
PYTHON

echo ""
