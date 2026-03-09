# IPAWS Enhanced Population Data Sources

## Overview

The DOT Corridor Communicator IPAWS Alert Generator now integrates with multiple authoritative data sources for highly accurate population impact analysis. This enables precise geofencing that targets rural/highway corridors while intelligently excluding urban areas to prevent false WEA alerts.

## Integrated Data Sources

### 1. **LandScan Global** (Oak Ridge National Lab via Google Earth Engine)
- **Resolution**: 1km x 1km cells
- **Coverage**: Worldwide, updated annually (2024 available)
- **Accuracy**: ★★★★★ (Very High)
- **Access Method**: Google Earth Engine (FREE for non-commercial use)
- **Features**:
  - Ambient population (where people are throughout 24 hours)
  - 1km resolution grid-based data ideal for geospatial queries
  - No downloads required - cloud-based processing
  - Latest LandScan 2024 dataset

**Use Case**: Primary source for population estimates. Provides the most accurate population counts for alert impact analysis without requiring multi-gigabyte data downloads.

**Configuration**:
```bash
# Google Earth Engine Service Account (see setup guide)
railway variables set GEE_SERVICE_ACCOUNT=your-service-account@project.iam.gserviceaccount.com
railway variables set GEE_PRIVATE_KEY=your_base64_encoded_service_account_json
```

**See detailed setup guide:** `/docs/LANDSCAN_GOOGLE_EARTH_ENGINE_SETUP.md`

### 2. **US Census Bureau** (Official Census Data)
- **Resolution**: Census tract level
- **Coverage**: United States
- **Accuracy**: ★★★★☆ (High)
- **Features**:
  - Official population counts from decennial census
  - Demographic breakdowns available
  - Block group and tract boundaries
  - ACS (American Community Survey) 5-year estimates

**Use Case**: Fallback when LandScan unavailable. Provides official population counts with tract-level geographic precision.

**Configuration**:
```bash
export CENSUS_API_KEY="your_census_api_key"
```

Get a free Census API key: https://api.census.gov/data/key_signup.html

### 3. **OpenStreetMap** (Community-Maintained Geographic Data)
- **Resolution**: Varies (building to city level)
- **Coverage**: Worldwide
- **Accuracy**: ★★★☆☆ (Medium)
- **Features**:
  - Urban boundaries (cities, towns)
  - Land use classifications (residential, commercial, industrial)
  - Administrative boundaries
  - No API key required (free, public)

**Use Case**:
- Identify urban areas to exclude from highway incident alerts
- Supplement other data sources with land use information
- Cross-reference urban boundary detection

**APIs Used**:
- Overpass API: Query OSM data spatially
- Nominatim: Geocoding and reverse geocoding

### 4. **Iowa State GIS** (Iowa-Specific Authoritative Data)
- **Resolution**: Municipal/parcel level
- **Coverage**: Iowa only
- **Accuracy**: ★★★★☆ (High)
- **Features**:
  - Municipal boundaries with official populations
  - Land use data (residential, commercial, agricultural)
  - County boundaries
  - Infrastructure data (roads, bridges)

**Use Case**: Primary source for Iowa-specific geofencing. Provides authoritative municipal boundaries and population data maintained by Iowa DNR and Iowa DOT.

**Endpoints**:
- Iowa DOT GIS: `https://maps.iowadot.gov/arcgis/rest/services`
- Iowa DNR Data Gateway: `https://data.iowadnr.gov/arcgis/rest/services`

## Data Source Priority

The system queries all available data sources in parallel and selects the best estimate using this priority:

1. **LandScan** (if API key configured) → Very High confidence
2. **Iowa State GIS** (for Iowa locations) → High confidence
3. **US Census Bureau** (if API key configured) → High confidence
4. **OpenStreetMap** → Medium confidence
5. **Estimation** (fallback) → Low confidence

## API Usage Example

### Basic Usage (Single Source)

```javascript
const populationService = require('./services/population-density-service');

// Get population from specific source
const censusData = await populationService.getCensusPopulation(geofence);
console.log(`Population: ${censusData.total.toLocaleString()}`);
```

### Enhanced Multi-Source Query

```javascript
const populationService = require('./services/population-density-service');

// Query all available sources
const enhancedData = await populationService.getEnhancedPopulation(geofence);

console.log(`Population: ${enhancedData.population.toLocaleString()}`);
console.log(`Confidence: ${enhancedData.confidence}`);
console.log(`Primary Source: ${enhancedData.primarySource}`);
console.log(`Sources Queried: ${enhancedData.sourcesQueried}`);

// Access individual source data
if (enhancedData.sources.landscan) {
  console.log(`LandScan nighttime pop: ${enhancedData.sources.landscan.nighttime}`);
  console.log(`LandScan daytime pop: ${enhancedData.sources.landscan.daytime}`);
}

if (enhancedData.sources.iowaGIS) {
  console.log(`Municipalities: ${enhancedData.sources.iowaGIS.municipalities.length}`);
  console.log(`Land use - Residential: ${enhancedData.sources.iowaGIS.landUse.residential} acres`);
}
```

### Urban Area Exclusion with OSM

```javascript
// Get urban boundaries from OpenStreetMap
const osmData = await populationService.getOSMUrbanBoundaries(geofence);

console.log(`Found ${osmData.urbanAreas.length} urban areas`);
osmData.urbanAreas.forEach(area => {
  console.log(`  - ${area.name} (${area.type}): ${area.population || 'N/A'} people`);
});

// Use OSM data to refine urban exclusion
const refinedGeofence = populationService.excludeUrbanAreas(geofence);
```

## IPAWS Integration

The enhanced population data is automatically integrated into the IPAWS alert generation workflow:

```javascript
// In IPAWS Alert Generator
const ipawsService = require('./services/ipaws-alert-service');

// Generate alert with enhanced population analysis
const alert = await ipawsService.generateAlert({
  event: trafficEvent,
  geofence: alertGeofence,
  enhancedPopulation: true  // ← Enable multi-source population query
});

// Alert metadata now includes:
// - Affected population (high confidence)
// - Data sources used
// - Urban areas excluded
// - Confidence level
```

## Configuration Guide

### Step 1: Install Dependencies

```bash
npm install axios @turf/turf
```

### Step 2: Set Environment Variables

Configure in Railway (recommended) or create a `.env` file:

```bash
# Optional: US Census Bureau API Key (free - get from api.census.gov)
CENSUS_API_KEY=your_census_key_here

# Optional: LandScan via Google Earth Engine (FREE for non-commercial use)
# See /docs/LANDSCAN_GOOGLE_EARTH_ENGINE_SETUP.md for complete setup guide
GEE_SERVICE_ACCOUNT=your-service-account@project.iam.gserviceaccount.com
GEE_PRIVATE_KEY=your_base64_encoded_service_account_json

# OpenStreetMap and Iowa GIS require no API keys
```

**For LandScan Setup:** Follow the comprehensive guide at `/docs/LANDSCAN_GOOGLE_EARTH_ENGINE_SETUP.md`

### Step 3: Test Integration

```bash
node scripts/test_enhanced_population.js
```

## Data Source Comparison

| Source | Resolution | Update Frequency | Cost | API Key Required | Accuracy |
|--------|-----------|------------------|------|------------------|----------|
| **LandScan (GEE)** | 1km | Annual | **FREE** (non-commercial) | Yes (Service Account) | ★★★★★ |
| **Census Bureau** | Tract | Every 10 years | Free | Yes (free) | ★★★★☆ |
| **OpenStreetMap** | Varies | Real-time | Free | No | ★★★☆☆ |
| **Iowa State GIS** | Municipal | Quarterly | Free | No | ★★★★☆ |
| **Estimation** | Custom | N/A | Free | No | ★★☆☆☆ |

## Use Cases

### Highway Incident - Rural Interstate
**Scenario**: Multi-vehicle crash on I-80 west of Iowa City

**Data Sources Used**:
1. **LandScan**: Determine affected population in 5-mile radius
2. **Iowa State GIS**: Identify nearby municipalities to exclude
3. **OSM**: Verify urban boundaries for Iowa City, Coralville
4. **Census**: Cross-reference population densities

**Result**: Alert sent to 2,847 people (rural/highway users) while excluding 153,000 urban residents

### Winter Storm - Statewide
**Scenario**: Blizzard affecting I-35, I-80, I-380 corridors

**Data Sources Used**:
1. **Iowa State GIS**: All Iowa municipal boundaries
2. **Census**: County-level population data
3. **OSM**: Land use to identify agricultural vs. urban areas
4. **LandScan**: Daytime vs. nighttime population (timing matters)

**Result**: Alerts targeted to 487,000 rural/highway travelers while excluding 1.2M urban residents in Des Moines metro, Cedar Rapids, Davenport

### Bridge Closure - Urban Impact
**Scenario**: I-74 bridge closure in Bettendorf/Moline

**Data Sources Used**:
1. **Iowa State GIS** + **Illinois State GIS**: Bi-state coordination
2. **LandScan**: Daytime commuter populations
3. **OSM**: Major employers, hospitals, emergency services
4. **Census**: Commuting pattern data from ACS

**Result**: Targeted alert to 45,000 regular bridge commuters based on commuting patterns

## Error Handling

The service gracefully degrades when data sources are unavailable:

```javascript
try {
  const enhancedData = await populationService.getEnhancedPopulation(geofence);

  if (enhancedData.confidence === 'low') {
    console.warn('⚠️ Using estimation - consider configuring API keys');
  }

  // Always returns a result (falls back to estimation)
  return enhancedData.population;

} catch (error) {
  console.error('Population query failed:', error);

  // Final fallback: simple estimation
  return populationService.estimatePopulation(geofence).total;
}
```

## Performance Considerations

- **Parallel Queries**: All data sources queried simultaneously
- **Caching**: Consider caching results for frequently-used geofences
- **Timeouts**: Each API has 10-30 second timeout
- **Rate Limits**:
  - Census API: 500 requests/day (can request increase)
  - OSM Overpass: Fair use policy (~10,000/day)
  - LandScan: Varies by license
  - Iowa GIS: No published limits

## Future Enhancements

### Planned Integrations
- [ ] **USGS Land Cover Database** - National land use/land cover data
- [ ] **HIFLD** (Homeland Infrastructure Foundation-Level Data) - Critical infrastructure
- [ ] **HERE Traffic** - Real-time traffic volumes for dynamic population
- [ ] **SafeGraph** - Mobile location analytics for actual population presence
- [ ] **Esri Living Atlas** - Curated demographic and infrastructure datasets

### Machine Learning Enhancement
- Train ML model on historical alert performance
- Predict optimal geofence size based on incident type + time + location
- Adaptive population thresholds based on false-positive rates

## Support

For issues or questions:
- **Census API**: https://www.census.gov/data/developers/guidance.html
- **LandScan**: Contact Oak Ridge National Lab
- **OSM**: https://wiki.openstreetmap.org/wiki/Overpass_API
- **Iowa GIS**: data@iowadnr.gov

## References

- US Census Bureau API: https://www.census.gov/data/developers/data-sets.html
- LandScan Global: https://landscan.ornl.gov/
- Overpass API: https://overpass-api.de/
- Iowa Geospatial Data: https://geodata.iowa.gov/
- FEMA IPAWS: https://www.fema.gov/emergency-managers/practitioners/integrated-public-alert-warning-system
