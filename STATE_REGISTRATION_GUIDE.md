# State Traffic API Registration Guide

## Welcome!

The DOT Corridor Communicator is a multi-state traffic event monitoring and communication platform. We welcome additional state DOT agencies to integrate their traffic data feeds.

## Registration Process

To add your state to the platform, please provide the following information to the system administrator:

### Required Information

1. **State Name**: Full name of your state (e.g., "Wyoming", "New Mexico")
2. **State Key**: Short identifier (lowercase, no spaces, e.g., "wyoming", "newmexico")
3. **API Endpoint URL**: The full URL to your traffic events API
4. **API Type**: The format of your API (see supported formats below)
5. **Data Format**: Response format (json, xml, rss, etc.)

### Optional: API Credentials

If your API requires authentication, please securely provide:
- **API Key**: If using API key authentication
- **Username/Password**: If using Basic Authentication
- **Other**: Custom authentication headers or tokens

Note: All credentials are encrypted using AES-256-CBC encryption before storage.

## Supported API Formats

### 1. WZDx (Work Zone Data Exchange)
**Recommended**: Industry standard format for work zone data.
- Format: JSON
- Standard: [WZDx Specification](https://github.com/usdot-jpo-ode/wzdx)
- Example: `https://your-state-dot.gov/api/wzdx/v4/feed`

### 2. FEU-G (Field Equipment Update - General)
- Format: Custom JSON
- Common fields: event type, location, severity, timestamps
- Example: `https://your-state-dot.gov/api/feu-g/events`

### 3. RSS Feed
- Format: RSS/XML
- Must include: title, description, lat/long coordinates
- Example: `https://your-state-dot.gov/api/traffic/rss`

### 4. Custom JSON
- Format: Custom JSON structure
- We can work with your existing format
- Please provide sample response

## Sample Data Requirements

Your API response should include:
- **Location**: Description or coordinates (lat/long)
- **Event Type**: Type of incident (construction, accident, closure, etc.)
- **Description**: Details about the event
- **Severity**: Impact level (if available)
- **Timestamps**: Start time, end time, last updated
- **Status**: Active, planned, completed, etc.

## Example API Responses

### WZDx Format
```json
{
  "road_event_feed_info": {
    "feed_info_id": "state-dot-feed",
    "update_date": "2024-01-15T10:30:00Z"
  },
  "features": [
    {
      "type": "Feature",
      "properties": {
        "core_details": {
          "event_type": "work-zone",
          "data_source_id": "state-dot",
          "road_names": ["I-80"],
          "direction": "eastbound",
          "description": "Bridge maintenance",
          "creation_date": "2024-01-10T00:00:00Z",
          "update_date": "2024-01-15T10:30:00Z"
        }
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [[-110.5, 41.3], [-110.4, 41.3]]
      }
    }
  ]
}
```

### Custom JSON Format
```json
{
  "events": [
    {
      "id": "12345",
      "type": "construction",
      "location": "I-25 MM 123",
      "latitude": 35.0844,
      "longitude": -106.6504,
      "description": "Road work - Right lane closed",
      "severity": "moderate",
      "start_time": "2024-01-15T08:00:00Z",
      "end_time": "2024-01-15T17:00:00Z",
      "status": "active"
    }
  ]
}
```

### RSS Feed Format
```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>State DOT Traffic Events</title>
    <item>
      <title>I-80 Construction - Lane Closure</title>
      <description>Left lane closed for bridge repair</description>
      <georss:point>41.3 -110.5</georss:point>
      <pubDate>Mon, 15 Jan 2024 10:30:00 GMT</pubDate>
      <category>construction</category>
    </item>
  </channel>
</rss>
```

## Testing Your API

Before registration, please verify:
1. ✅ API endpoint is publicly accessible (or credentials provided)
2. ✅ CORS headers allow cross-origin requests
3. ✅ Response includes location data (coordinates or description)
4. ✅ Data is updated regularly
5. ✅ API is stable and production-ready

## Registration Submission

### Method 1: Contact Administrator
Email your API details to the system administrator who will add your state using the admin panel.

### Method 2: Self-Service Registration (If Enabled)
If you have been provided an admin token:

1. Navigate to the Corridor Communicator admin panel
2. Click "Admin" in the navigation
3. Enter your admin token
4. Click "Add New State"
5. Fill in the form with your state's information
6. Click "Add State"
7. Use "Test Connection" to verify the integration

## After Registration

Once your state is added:
1. **Test the Integration**: View your events on the map and table views
2. **Verify Data Quality**: Check that all fields are mapping correctly
3. **Monitor Performance**: Ensure your API can handle regular polling
4. **Update as Needed**: Contact admin if API endpoints or credentials change

## API Requirements

### Performance
- Response time: < 5 seconds
- Availability: > 99% uptime recommended
- Rate limiting: Should support at least 1 request per minute

### Data Refresh
- Update frequency: Minimum every 15 minutes
- Real-time updates preferred for active incidents

### CORS Configuration
If hosting your own API, ensure CORS headers are set:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## Support

For questions or assistance:
- Review the [Database Integration Plan](DATABASE_INTEGRATION_PLAN.md)
- Check the [Deployment Documentation](DEPLOYMENT.md)
- Contact the system administrator

## Privacy and Security

- All API credentials are encrypted using AES-256-CBC
- Credentials are never exposed in logs or client-side code
- Admin access requires secure token authentication
- Database is backed up regularly

## Benefits of Integration

By joining the DOT Corridor Communicator:
- 🗺️ **Multi-State Visibility**: Your events displayed alongside neighboring states
- 💬 **Communication Tools**: Built-in messaging for event coordination
- 📊 **Data Quality Reports**: Automated analysis of your data feed
- 🔄 **Standardization**: Encourages adoption of industry standards like WZDx
- 🤝 **Collaboration**: Coordinate cross-border events with other states

## Example States Currently Integrated

The platform currently includes:
- Utah (WZDx format)
- Colorado (WZDx format)
- Wyoming (WZDx format)
- Nevada (WZDx format)
- Arizona (WZDx format)
- New Mexico (WZDx format)
- Kansas (FEU-G format)
- Montana (RSS format)
- Idaho (WZDx format)

## Technical Specifications

### Supported Coordinate Systems
- WGS84 (EPSG:4326) - Latitude/Longitude decimal degrees
- Other formats can be converted if documented

### Data Retention
- Events are fetched in real-time (not stored long-term)
- Messages and annotations are stored for 90 days

### Map Display
- Events automatically plotted on interactive Leaflet map
- Color-coded by severity
- Clustered for performance with many events
- Click for detailed information

## Change Management

If your API changes:
1. **URL Changes**: Update via admin panel or contact administrator
2. **Credential Changes**: Use admin panel to update encrypted credentials
3. **Format Changes**: May require code updates - please provide advance notice
4. **Deprecation**: Give 30 days notice if discontinuing API access

## Compliance

Please ensure your API data:
- Does not include personally identifiable information (PII)
- Complies with state and federal data sharing regulations
- Includes only public traffic information
- Has appropriate authorization for public display

---

**Ready to integrate?** Please prepare the information above and contact the system administrator to begin the registration process.

**Questions?** Review the technical documentation or reach out for assistance.
