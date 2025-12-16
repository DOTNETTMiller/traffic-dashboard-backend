# How to Add New Data Feeds

This guide explains how to add new state DOT or city traffic data feeds to the DOT Corridor Communicator.

## IMPORTANT: Production Deployment

When adding new state feeds, remember that the backend uses **database-driven configuration**. This means:

1. Adding states via code changes **will not** automatically appear in production
2. You must update the production database after deploying code changes
3. Use one of these methods to update production:
   - Run `scripts/update_state_feeds.js` in the production container (recommended)
   - Use the State Admin UI to add/update states directly in production
   - Manually update the SQLite database via SSH

See **DEPLOYMENT.md** for detailed instructions on updating production state configurations.

## Quick Start: Adding a WZDx Feed

Most modern state DOT feeds use the **WZDx (Work Zone Data Exchange)** standard, which makes integration very straightforward.

### Example 1: Adding Wyoming DOT (Simple WZDx Feed)

Since Wyoming is a critical I-80 corridor state, here's how to add it:

1. **Add to State Admin UI** (Recommended Method):
   - Go to http://localhost:5173/ and login as admin
   - Click "State Admin" in the navigation
   - Click "Add New State"
   - Fill in the form:
     - **State Key**: `wyoming`
     - **Display Name**: `Wyoming DOT`
     - **Feed URL**: (Contact Wyoming DOT for their WZDx feed URL)
     - **API Type**: `WZDx`
     - **Format**: `json`
     - **Corridor**: `I-80`
     - **Active**: ✓ Enabled
   - Click "Add State"

2. **Test the Feed**:
   - Click "Test Feed" in the State Admin panel
   - Verify events are loaded correctly
   - Check the map view for Wyoming events

### Example 2: Adding Tennessee DOT (WZDx with API Key)

Tennessee is a major corridor state (I-40, I-24, I-65, I-75):

1. **Obtain API Key**:
   - Visit Tennessee SmartWay 511 website
   - Register for API access
   - Save the API key

2. **Add via State Admin**:
   - State Key: `tennessee`
   - Display Name: `Tennessee DOT`
   - Feed URL: `https://smartway.tn.gov/api/wzdx?api_key=YOUR_KEY`
   - API Type: `WZDx`
   - API Key: (Enter your key)
   - Corridor: `I-40` (or `I-40,I-24,I-65` for multiple)

### Example 3: Adding NYC DOT (Custom XML Feed)

For feeds that don't use WZDx:

1. **Research the Feed Format**:
   - Visit https://www.nyc.gov/html/dot/html/about/datafeeds.shtml
   - Review the feed documentation
   - Identify the feed URL and format

2. **Add to Database**:
   ```sql
   INSERT INTO states (
     state_key,
     display_name,
     feed_url,
     api_type,
     format,
     corridor,
     active
   ) VALUES (
     'nyc',
     'New York City DOT',
     'https://nycdot.feed.url/traffic.xml',
     'Custom',
     'xml',
     'I-95,I-278,I-495',
     1
   );
   ```

3. **Create Custom Parser** (if needed):
   - Add parser function in `backend_proxy_server.js`
   - Follow existing patterns (see Ohio, Caltrans examples)

## Feed Types

### 1. WZDx Feeds (Easiest)

**Automatic handling** - No custom code needed!

States with WZDx feeds:
- Wyoming, Tennessee, Connecticut, Montana, etc.
- Just add via State Admin UI

**Format**: GeoJSON (v4.1 or v4.2)

**Example**:
```json
{
  "road_event_feed_info": {...},
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "core_details": {
          "event_type": "work-zone",
          "road_names": ["I-80"],
          "direction": "eastbound"
        }
      },
      "geometry": {...}
    }
  ]
}
```

### 2. 511 XML Feeds (Moderate)

**Standard 511 format** - Parser already exists

Examples:
- New Jersey
- Iowa, Kansas, Nebraska (CARS)

**Parser**: `normalizeEvents()` function handles these

### 3. Custom Feeds (Advanced)

**Requires custom parser**

Examples:
- Ohio DOT (custom JSON)
- Caltrans LCS (custom XML)
- PennDOT RCRS (SOAP API)

**Steps**:
1. Study the feed format
2. Create parser function
3. Add to event processing pipeline

## Using the State Admin Panel

### Adding a State

1. **Login as Admin**:
   ```
   Email: admin@example.com
   Password: admin123
   ```

2. **Navigate to State Admin**:
   - Click "State Admin" button in navigation
   - You'll see the list of all states

3. **Click "Add New State"**:
   - Fill out the form completely
   - Required fields: State Key, Display Name, Feed URL
   - Optional: API Key, Username, Password (for auth)

4. **Test the Feed**:
   - Click "Test Feed" next to the new state
   - Verify events load correctly
   - Check for any errors

5. **Enable the State**:
   - Make sure "Active" is checked
   - Events will now appear in the main view

### Testing a Feed

The State Admin panel includes a "Test Feed" button for each state:

1. Click "Test Feed" next to any state
2. System will:
   - Fetch data from the feed URL
   - Parse the data
   - Show you the first 5 events
   - Display any errors

3. Review results:
   - Check event structure
   - Verify locations are correct
   - Ensure descriptions are readable

## Feed Requirements

### Minimum Requirements

All feeds must provide:
- Event location (address or coordinates)
- Event type (construction, incident, etc.)
- Event description
- Valid coordinates (latitude/longitude)

### Recommended Fields

For best user experience:
- Event severity
- Lane closures information
- Start/end times
- Direction of travel
- Route/corridor information

### Coordinate Validation

The system automatically filters out events with:
- Zero coordinates (0, 0)
- Invalid coordinates (NaN)
- Missing coordinates

## API Key Management

### Storing API Keys

**Option 1: Environment Variables** (Recommended for production)
```bash
export WYOMING_API_KEY="your_key_here"
export TENNESSEE_API_KEY="your_key_here"
```

**Option 2: Database** (Encrypted storage)
- Add via State Admin panel
- Keys are encrypted in database
- Automatically applied to requests

### Using API Keys

The system supports multiple authentication methods:

1. **URL Parameter**:
   ```
   https://api.example.com/wzdx?api_key={API_KEY}
   ```

2. **Header Authentication**:
   ```javascript
   headers: {
     'Authorization': 'Bearer ' + API_KEY
   }
   ```

3. **Basic Auth** (username/password):
   ```javascript
   auth: {
     username: USERNAME,
     password: PASSWORD
   }
   ```

## Integration Checklist

Before adding a new feed:

- [ ] Feed URL is publicly accessible or you have credentials
- [ ] Feed format is documented
- [ ] Feed updates regularly (at least every 15 minutes)
- [ ] Data quality is good (accurate coordinates, descriptions)
- [ ] Terms of service allow third-party use
- [ ] API key obtained (if required)

After adding:

- [ ] Test feed returns data
- [ ] Events appear on map
- [ ] Coordinates are accurate
- [ ] Descriptions are readable
- [ ] No duplicate events with existing feeds
- [ ] Corridor tagging is correct
- [ ] Auto-refresh works

For production deployment:

- [ ] Update production database using `scripts/update_state_feeds.js`
- [ ] Restart backend service
- [ ] Verify state loads in production logs
- [ ] Check that data appears on production frontend

## Troubleshooting

### Feed Not Loading

1. Check the feed URL in a browser
2. Verify API key is correct
3. Check for CORS issues
4. Review server logs for errors

### Events Not Appearing

1. Check coordinate validity
2. Verify events pass corridor filters
3. Check for duplicate IDs with other states
4. Review event normalization in logs

### Parser Errors

1. Download a sample of the feed data
2. Compare to expected format
3. Check for API version changes
4. Review WZDx specification if applicable

## Common Feed URLs

### WZDx v4.1 Feeds

Most states now use WZDx v4.1 or v4.2:

```
Wyoming: (Contact WyDOT for URL)
Tennessee: https://smartway.tn.gov/api/wzdx
Connecticut: (Check CT DOT website)
Montana: (Check MT DOT website)
```

### 511 Systems

```
511NY: https://511ny.org/api/wzdx
511WI: https://511wi.gov/api/wzdx
511GA: https://511ga.org/api/...
511PA: (Request access via PennDOT)
```

## Resources

- **WZDx Specification**: https://github.com/usdot-jpo-ode/wzdx
- **WZDx Feed Registry**: https://datahub.transportation.gov/Roadways-and-Bridges/Work-Zone-Data-Exchange-WZDx-Feed-Registry/69qe-yiui
- **511 Open Data**: https://511.org/open-data
- **Available Feeds List**: See `AVAILABLE_DATA_FEEDS.md`

## Need Help?

1. Check existing feed parsers in `backend_proxy_server.js`
2. Review WZDx documentation
3. Test with small data samples first
4. Use the State Admin "Test Feed" feature

---

*For questions about specific state feeds, contact the state DOT directly or email avdx@dot.gov for WZDx feeds.*
