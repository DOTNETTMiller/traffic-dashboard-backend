# Truck Parking Prediction System

A comprehensive truck parking availability prediction and visualization system with real-time data integration from TPIMS feeds.

## Overview

This system provides:
- Real-time truck parking availability tracking
- ML-based prediction of future availability
- Map visualization with color-coded markers
- Ground truth validation from TPIMS feeds
- Historical trend analysis

## Data Sources

### Real-Time TPIMS Feeds (Auto-updated every 15 minutes)
1. **TRIMARC TPIMS** (Kentucky)
   - URL: http://www.trimarc.org/dat/tpims/TPIMS_Dynamic.json
   - Coverage: Kentucky rest areas and truck stops

2. **Minnesota DOT TPIMS**
   - URL: http://iris.dot.state.mn.us/iris/TPIMS_dynamic
   - Coverage: Minnesota rest areas

### Static Data Sources
- **FHWA Truck Parking Database**
  - National truck stop and rest area locations
  - Import via: `node scripts/import_parking_data.js`

## Architecture

### Database Schema

**truck_parking_facilities**
```sql
- facility_id (unique identifier)
- facility_name
- state
- latitude, longitude
- address
- total_spaces, truck_spaces
- amenities
- facility_type
- last_updated, created_at
```

**parking_availability**
```sql
- facility_id (foreign key)
- available_spaces
- occupied_spaces
- timestamp
- is_prediction (boolean)
- prediction_confidence (0-1)
```

### Prediction Model

The ML prediction engine (`parking_prediction.js`) uses:

1. **Time-Pattern Analysis**
   - Hour-of-day patterns
   - Day-of-week patterns (weekday vs weekend)
   - Historical averages within ±2 hour windows

2. **Confidence Scoring**
   - Sample size score (more data = higher confidence)
   - Variance score (consistent patterns = higher confidence)
   - Combined confidence metric (0-1)

3. **Fallback Strategies**
   - Uses similar time periods when available
   - Falls back to overall average if no similar data exists

### Real-Time Data Integration

The system automatically:
1. Fetches TPIMS data every 15 minutes
2. Updates facility information
3. Records actual availability (not predictions)
4. Validates predictions against real data
5. Calculates prediction accuracy metrics

## API Endpoints

### Public Endpoints

```
GET /api/parking/facilities
  ?state=MN  (optional filter)
  → Returns all parking facilities

GET /api/parking/availability
  → Returns latest availability for all facilities

GET /api/parking/availability/:facilityId
  → Returns latest availability for specific facility

GET /api/parking/history/:facilityId
  ?hours=24  (default 24)
  → Returns historical availability data

GET /api/parking/predict/:facilityId
  ?time=2024-03-15T14:00:00Z  (optional, defaults to now)
  → Returns predicted availability

GET /api/parking/predict-all
  ?time=2024-03-15T14:00:00Z  (optional)
  → Returns predictions for all facilities

GET /api/parking/nearby
  ?lat=41.8781&lon=-87.6298&radius=50&minAvailable=1
  → Find available parking near coordinates

GET /api/parking/analyze/:facilityId
  ?days=7  (default 7)
  → Returns utilization pattern analysis
```

### Admin Endpoints (Require Authentication)

```
POST /api/admin/parking/facility
  Body: { facilityId, facilityName, state, latitude, longitude, ... }
  → Add or update parking facility

POST /api/admin/parking/availability
  Body: { facilityId, availableSpaces, occupiedSpaces }
  → Add availability data

POST /api/admin/parking/generate-predictions
  → Generate predictions for all facilities

POST /api/admin/parking/fetch-tpims
  → Manually trigger TPIMS data fetch

GET /api/parking/validation
  → Get prediction accuracy metrics
```

## Scripts

### Import Static Data
```bash
# Import FHWA parking facility data
node scripts/import_parking_data.js
```

### Fetch Real-Time TPIMS Data
```bash
# Fetch from all TPIMS sources
node scripts/fetch_tpims_data.js
```

### Generate Predictions (CLI)
```bash
# Predict specific facility
node parking_prediction.js predict tpims-ky-facility-1

# Generate all predictions and store in database
node parking_prediction.js predict-all

# Analyze utilization patterns
node parking_prediction.js analyze tpims-ky-facility-1

# Find nearby parking
node parking_prediction.js nearby 38.2527 -85.7585 50
```

## Frontend Integration

### Toggle Parking Layer

In the main dashboard, use the "🚛 Truck Parking" checkbox to show/hide parking markers.

### Marker Colors

- 🟢 **Green**: Plenty available (< 50% occupancy)
- 🟠 **Orange**: Moderately full (50-80% occupancy)
- 🔴 **Red**: Nearly full (> 80% occupancy)
- **Dashed Border**: Predicted data (not real-time)

### Auto-Refresh

The parking layer automatically refreshes every 5 minutes to show the latest availability.

## Prediction Validation

The system automatically validates predictions against real TPIMS data:

1. **Accuracy Metrics**
   - Compares predicted vs actual availability
   - Calculates percentage error
   - Considers predictions "accurate" if within 20% of actual

2. **Continuous Improvement**
   - As more real data is collected, predictions improve
   - Historical patterns become more refined
   - Confidence scores increase with more data

3. **Validation API**
   ```bash
   curl http://localhost:4000/api/parking/validation \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

## Deployment

### Automatic Operations

The backend automatically:
1. ✅ Fetches TPIMS data every 15 minutes
2. ✅ Updates facility information
3. ✅ Records real-time availability
4. ✅ Validates predictions

### Manual Operations

Admins can:
- Manually trigger TPIMS fetch via API
- Generate predictions on demand
- View validation/accuracy reports
- Add/update facilities

### Environment Variables

No additional environment variables required. The system uses existing database configuration.

## Performance Considerations

### Database Growth

With 100 facilities updating every 15 minutes:
- ~9,600 records per day
- ~67,200 records per week
- ~3.5M records per year

**Recommendation**: Implement data retention policy to archive old availability data after 30 days.

### API Rate Limits

TPIMS feeds are public but should be respectful:
- Current: 15-minute intervals (4 requests/hour per feed)
- Recommended: Don't go below 5-minute intervals

### Prediction Performance

- Generating predictions for 100 facilities: ~100-200ms
- Single facility prediction: <10ms
- Historical analysis (7 days): ~50ms

## Future Enhancements

1. **Machine Learning Improvements**
   - Traffic event correlation
   - Weather impact analysis
   - Route/corridor analysis
   - Seasonal patterns

2. **Additional Data Sources**
   - More state TPIMS feeds
   - Private truck stop APIs
   - Crowdsourced availability

3. **Advanced Features**
   - Route planning with parking recommendations
   - Reservation system integration
   - Driver notifications
   - Capacity forecasting

## Troubleshooting

### No Parking Data Showing

1. Check if TPIMS feeds are accessible:
   ```bash
   curl http://www.trimarc.org/dat/tpims/TPIMS_Dynamic.json
   ```

2. Manually trigger fetch:
   ```bash
   node scripts/fetch_tpims_data.js
   ```

3. Check backend logs for errors

### Predictions Not Working

1. Verify historical data exists:
   ```bash
   # Check database
   sqlite3 states.db "SELECT COUNT(*) FROM parking_availability"
   ```

2. Need at least 24-48 hours of data for meaningful predictions

3. Check prediction generation:
   ```bash
   node parking_prediction.js predict-all
   ```

### Low Accuracy

- Predictions improve with more historical data
- Check validation report: `GET /api/parking/validation`
- Ensure TPIMS feeds are updating regularly
- Review data quality in database

## Support

For issues or questions:
1. Check backend logs
2. Review validation metrics
3. Test TPIMS feeds directly
4. Verify database schema and data

---

**Last Updated**: 2025-10-22
**Version**: 1.0.0
