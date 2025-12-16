# Texas and Oklahoma WZDx Feed Fix

**Date:** 2025-12-15
**Status:** ✅ RESOLVED

## Problem

Texas and Oklahoma WZDx data feeds were not appearing on the production map despite being configured.

## Root Causes

### 1. PostgreSQL Boolean Conversion Bug
**Location:** `database.js:1016`

**Issue:**
- PostgreSQL returns boolean values as `true/false`
- SQLite returns boolean values as integers `1/0`
- Code was checking `enabled === 1`, which failed for PostgreSQL

**Fix:**
```javascript
// BEFORE (BROKEN for PostgreSQL):
enabled: state.enabled === 1

// AFTER (WORKS for both):
enabled: Boolean(state.enabled)
```

**Impact:** All states showed as `enabled: false`, preventing them from loading.

---

### 2. Missing apiType in normalizeEventData
**Location:** `backend_proxy_server.js:1318, 1648-1650`

**Issue:**
- `normalizeEventData()` was doing a reverse lookup to find `apiType` from `API_CONFIG`
- The lookup used `config.name` which didn't always match the key
- Texas and Oklahoma weren't recognized as WZDx feeds

**Fix:**
```javascript
// Updated function signature to accept apiType and stateKey
const normalizeEventData = (rawData, stateName, format, sourceType = 'events', apiType = null, stateKey = null) => {
  // Use passed apiType instead of reverse lookup
  const detectedApiType = apiType || API_CONFIG[Object.keys(API_CONFIG).find(k => API_CONFIG[k].name === stateName)]?.apiType;

  if (stateName !== 'Utah' && detectedApiType === 'WZDx' && rawData.features) {
    // Process WZDx features
  }
}

// Updated all calls to pass apiType and stateKey
const normalized = normalizeEventData(response.data, config.name, config.format, 'events', config.apiType, stateKey);
```

**Impact:** Texas and Oklahoma WZDx processing logic wasn't triggered.

---

### 3. Texas Interstate Format Not Recognized
**Location:** `backend_proxy_server.js:2318-2329`

**Issue:**
- Texas uses "IH" prefix for interstates (e.g., "IH0010" = Interstate 10)
- `isInterstateRoute()` only matched "I-80", "I 80", "Interstate 80" patterns
- All 555 Texas interstate events were filtered out

**Fix:**
```javascript
const isInterstateRoute = (locationText) => {
  if (!locationText) return false;

  // Match patterns like "I-80", "I 80", "Interstate 80", "IH0010" (Texas format)
  const interstatePattern = /\b(I-?\d{1,3}|IH\d{4}|Interstate\s+\d{1,3})\b/i;

  // Exclude state routes including Texas-specific prefixes
  const stateRoutePattern = /\b(US|SR|KS|NE|IA|IN|MN|UT|NV|OH|NJ|SH|FM|RM|BU|BI|SL|SS)\s*[-\s]?\d+\b/i;

  return interstatePattern.test(locationText) && !stateRoutePattern.test(locationText);
};
```

**Texas Route Formats:**
- Interstates: `IH0010` (I-10), `IH0035` (I-35), `IH0020` (I-20), `IH0635` (I-635)
- State Routes: `SH0121` (State Highway 121), `FM0975` (Farm to Market 975)
- US Routes: `US0069`, `US0281`, `US0287`

**Impact:** 2,209 Texas features were fetched but 0 events were normalized.

---

## Results

### Before Fix
- Total events: 2,647
- States loading: 12
- Texas events: 0
- Oklahoma events: 0

### After Fix
- Total events: 4,345
- States loading: 14
- Texas events: 555 ✅
- Oklahoma events: 3 ✅

### States Now Active
CA, Illinois, Indiana, Iowa, Kansas, Minnesota, Nebraska, Nevada, New Jersey, Ohio, Oklahoma, Pennsylvania, Texas, Utah

---

## Files Modified

1. **database.js**
   - Line 1016: Fixed PostgreSQL boolean handling

2. **backend_proxy_server.js**
   - Line 1318: Updated `normalizeEventData` signature
   - Lines 1648-1650: Fixed apiType detection with direct parameter
   - Lines 2324-2325: Added Texas "IH" interstate pattern
   - Lines 2441, 2459, 2476, 2504, 2515: Pass apiType to all calls

3. **scripts/fix_production_feeds.js**
   - Comprehensive migration script with PostgreSQL and SQLite support
   - Includes all 14 states with correct WZDx URLs

---

## Migration Steps Used

1. Created migration script with all state configurations
2. Ran migration against production PostgreSQL database
3. Verified all states loaded with `enabled=true`
4. Fixed boolean conversion bug
5. Fixed apiType detection
6. Fixed Texas interstate pattern matching
7. Deployed to production

---

## Testing

```bash
# Check total events and state breakdown
curl -s "https://traffic-dashboard-backend-production.up.railway.app/api/events" | \
  jq '{total: .events | length, states: [.events[].state] | unique | sort}'

# Verify Texas and Oklahoma events
curl -s "https://traffic-dashboard-backend-production.up.railway.app/api/events" | \
  jq '{tx_count: ([.events[] | select(.state == "Texas")] | length), ok_count: ([.events[] | select(.state == "Oklahoma")] | length)}'
```

---

## Lessons Learned

1. **Database Type Differences:** Always use type-agnostic comparisons (e.g., `Boolean()`) when working with SQLite and PostgreSQL
2. **Parameter Passing:** Pass critical data directly instead of relying on reverse lookups
3. **State-Specific Formats:** Different states use different road naming conventions - document and test thoroughly
4. **Diagnostic Logging:** Added detailed logging helped identify exact failure points

---

## Related Issues

- PostgreSQL boolean handling affects all database queries with boolean fields
- Interstate pattern matching affects all WZDx feeds with state-specific formats
- apiType detection affects any new states added to the database

---

## Future Improvements

1. Add automated tests for Texas interstate format variations
2. Create documentation of state-specific road naming conventions
3. Add validation to catch boolean conversion issues earlier
4. Consider adding state-specific parsers for unique formats
