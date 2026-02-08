# Segment Extraction Fix - February 8, 2026

## Problem

Events were extending far beyond their actual geographic span. For example:
- **Event**: IO-IADOT-21173403930WB (different one from cache)
- **Raw coordinates**: Start at 41.119744, -96.212528 → End at 41.591784, -93.809588
- **Actual event distance**: ~120 km (75 miles) straight-line
- **Displayed segment**: 252 points, 226.26 km (140.53 miles)

The segment was extending much further than the event's actual span.

## Root Cause

The `extractSegment` function found the **globally closest points** on the highway to the event's start and end coordinates. However:

1. If those closest points were far apart along the highway route
2. Or if the highway had detours/loops between them
3. The extracted segment could be much longer than the actual event

**Example**: Highway makes a 40-mile detour between the two closest points, even though the event only covers 75 miles straight-line distance.

## The Fix (Commits 88a6d71, bf0520f)

Added **Validation 3**: Segment path length should be reasonable compared to event distance

```javascript
// Validation 3: Simple validation approach
// 1. Find closest points on highway to event start and end
// 2. Extract segment between those points
// 3. Validate segment path length is reasonable

const maxPathMultiplier = eventDistance < 5 ? 2.5 : 1.5;
const maxReasonablePathLength = eventDistance * maxPathMultiplier;

if (segmentPathLength > maxReasonablePathLength && eventDistance > 1) {
  // Reject - highway makes detours beyond event extent
  return null;
}
```

### Algorithm:

**Simple and straightforward:**

1. Find the closest point on the highway to the event **start** coordinate
2. Find the closest point on the highway to the event **end** coordinate
3. Extract the highway segment between those two points
4. Calculate the path length (sum of distances between consecutive points)
5. Compare to the straight-line event distance:
   - **For events ≥ 5km**: Allow up to 1.5x (highway curves add ~50%)
   - **For events < 5km**: Allow up to 2.5x (small detours matter more)
6. If path length exceeds the threshold: **reject** (fall back to straight line)

**Key insight**: Highway curves should add at most 50-150% to the distance. If the segment path is 2x+ longer than the event distance, it means the highway makes detours or loops that extend way beyond the actual event extent.

## Expected Results

After Railway restart (to clear cache):

### Better Segment Matching
- Events will only show highway segments that correspond to their actual extent
- No more 140-mile displays for 75-mile events
- Segments will be 2x event distance at most (accounting for highway curves)

### Some Events May Not Snap
- Events where the highway makes extreme detours may not find a good match
- These will fall back to straight lines (as they should)
- Better to show straight line than wrong segment

## Testing

After Railway service restart, test this event:
```bash
curl -s "https://corridor-communication-dashboard-production.up.railway.app/api/events?state=Iowa" | \
jq '.events[] | select(.description | contains("MM 141-MM 143")) | {
  id,
  points: .geometry.coordinates | length,
  source: .geometry.geometrySource,
  start: .geometry.coordinates[0],
  end: .geometry.coordinates[-1]
}'
```

**Expected**:
- Should have 10-50 points (not 252)
- Path length should be ~150 km max (not 226 km)
- Should match the actual event span

## Next Steps

1. **Restart Railway service** to clear event cache:
   ```bash
   # Go to Railway dashboard and restart the service
   # OR use CLI: railway service restart
   ```

2. **Verify the fix** by checking long-distance events:
   - Look for events with 80+ km spans
   - Verify they don't extend beyond 2x their actual distance
   - Check that they still snap to curved geometry

3. **Monitor success rate**:
   - Some events may now fall back to straight lines
   - This is expected and correct behavior
   - Better to show straight line than incorrect long segment

## Code Location

**File**: `backend_proxy_server.js`
**Function**: `extractSegment` (lines 1080-1230)
**New Validation**: Lines 1135-1185 (Validation 3)

## Summary

This fix ensures that snapped segments respect the actual geographic extent of events. Events will no longer extend 140 miles when they should only cover 75 miles. The tradeoff is that some events with extreme highway detours may not snap, but they'll correctly fall back to straight lines instead of displaying misleading geometry.
