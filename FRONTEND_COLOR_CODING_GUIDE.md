# Frontend Event Color Coding Guide

## Event Type Color Scheme

Your backend now provides `eventType` for each event. Use this to color-code the polylines on the map:

### Recommended Colors:

```javascript
const eventColors = {
  'Weather': '#4FC3F7',      // Light blue - for weather/seasonal conditions
  'Construction': '#FF1744', // Red - for construction/roadwork
  'Closure': '#FF6F00',      // Orange - for lane/road closures
  'Incident': '#9C27B0',     // Purple - for accidents/incidents
  'default': '#757575'       // Gray - for unknown types
};
```

## Implementation Example (Leaflet)

If you're using Leaflet for your map, update your polyline creation:

```javascript
// When creating polylines for events
events.forEach(event => {
  if (event.geometry && event.geometry.coordinates) {
    // Convert coordinates from [lng, lat] to [lat, lng] for Leaflet
    const latLngs = event.geometry.coordinates.map(coord => [coord[1], coord[0]]);

    // Get color based on event type
    const color = eventColors[event.eventType] || eventColors.default;

    // Create polyline with color
    const polyline = L.polyline(latLngs, {
      color: color,
      weight: 4,
      opacity: 0.8
    }).addTo(map);

    // Add popup with event details
    polyline.bindPopup(`
      <strong>${event.eventType}</strong><br>
      ${event.description}<br>
      <em>${event.corridor} ${event.direction}</em>
    `);
  }
});
```

## Current Backend Event Types

Based on your Iowa I-80 events:

- **Weather** (21 events) - Seasonal conditions, winter weather
- **Closure** (11 events) - Lane/shoulder closures, work zones
- **Construction** (3 events) - Road work, construction zones

## Lane Separation

The backend now automatically offsets:
- **Westbound (WB)** events: offset NORTH (displays on left side)
- **Eastbound (EB)** events: offset SOUTH (displays on right side)

This creates visual separation between opposing traffic lanes on divided highways.

## Geometry Quality Indicator

You can also show geometry quality in the popup:

```javascript
const qualityBadge = event.geometry.geometrySource === 'interstate'
  ? '✅ High Quality'
  : event.geometry.geometrySource === 'osrm'
  ? '⚠️ Routed'
  : '❌ Straight Line';
```

## Example: Full Event Rendering

```javascript
function renderEvent(event) {
  if (!event.geometry || !event.geometry.coordinates) return;

  // Determine styling
  const color = eventColors[event.eventType] || eventColors.default;
  const weight = event.severity === 'high' ? 5 : 4;

  // Convert coordinates
  const latLngs = event.geometry.coordinates.map(c => [c[1], c[0]]);

  // Create polyline
  const polyline = L.polyline(latLngs, {
    color: color,
    weight: weight,
    opacity: 0.8,
    className: `event-${event.eventType.toLowerCase()}`
  }).addTo(map);

  // Build popup content
  const popup = `
    <div class="event-popup">
      <div class="event-header" style="background-color: ${color}; color: white; padding: 5px;">
        ${event.eventType}
      </div>
      <div class="event-body" style="padding: 10px;">
        <strong>${event.corridor} ${event.direction}</strong><br>
        ${event.description}<br>
        <small>
          ${event.lanesAffected}<br>
          Severity: ${event.severity}<br>
          Geometry: ${event.geometry.coordinates.length} points
          (${event.geometry.geometrySource})
        </small>
      </div>
    </div>
  `;

  polyline.bindPopup(popup);

  return polyline;
}
```

## CSS Styling (Optional)

Add visual effects for different event types:

```css
.event-weather {
  stroke-dasharray: 5, 5; /* Dashed line for weather */
}

.event-closure {
  stroke-width: 5;
  stroke-linecap: round;
}

.event-construction {
  stroke-dasharray: 10, 5, 2, 5; /* Construction pattern */
}
```

## Next Steps

1. Update your frontend map rendering code to use `event.eventType`
2. Apply the color scheme above (or customize to your preference)
3. Test with Iowa I-80 events to see:
   - Light blue for weather events
   - Red for construction
   - Orange for closures
   - Proper WB/EB lane separation

The backend is now ready - all events include:
- ✅ `eventType` for color coding
- ✅ `direction` for lane offset (WB/EB automatically separated)
- ✅ `geometrySource` to show quality
- ✅ Curved geometry for 75% of events
