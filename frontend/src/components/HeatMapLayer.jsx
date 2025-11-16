import { useMemo } from 'react';
import { Circle } from 'react-leaflet';

export default function HeatMapLayer({ events, mode = 'density', isVisible }) {
  // Generate heat map data based on mode
  const heatMapData = useMemo(() => {
    if (!isVisible || !events || events.length === 0) return [];

    // Group events by location to create density clusters
    const clusters = {};
    const now = new Date();

    events.forEach(event => {
      if (!event.latitude || !event.longitude) return;

      // Round coordinates to create clusters (grid size ~0.05 degrees = ~5km)
      const gridSize = 0.05;
      const lat = Math.round(event.latitude / gridSize) * gridSize;
      const lng = Math.round(event.longitude / gridSize) * gridSize;
      const key = `${lat},${lng}`;

      if (!clusters[key]) {
        clusters[key] = {
          latitude: lat,
          longitude: lng,
          events: [],
          totalSeverityScore: 0,
          recentCount: 0
        };
      }

      clusters[key].events.push(event);

      // Calculate severity score
      const severityScore = getSeverityScore(event.severity);
      clusters[key].totalSeverityScore += severityScore;

      // Check if event is recent (within last 24 hours)
      if (event.startTime) {
        const eventTime = new Date(event.startTime);
        const hoursSince = (now - eventTime) / (1000 * 60 * 60);
        if (hoursSince <= 24) {
          clusters[key].recentCount++;
        }
      }
    });

    // Convert clusters to heat map points
    return Object.values(clusters).map(cluster => {
      const count = cluster.events.length;
      const avgSeverity = cluster.totalSeverityScore / count;

      let intensity;
      let color;

      switch (mode) {
        case 'density':
          // Density mode: intensity based on event count
          intensity = Math.min(count / 10, 1); // Normalize to 0-1
          color = getColorForIntensity(intensity);
          break;

        case 'severity':
          // Severity mode: intensity based on average severity
          intensity = avgSeverity;
          color = getSeverityColor(intensity);
          break;

        case 'recent':
          // Recent mode: intensity based on recent events
          intensity = Math.min(cluster.recentCount / 5, 1);
          color = getRecentColor(intensity);
          break;

        default:
          intensity = 0.5;
          color = '#3b82f6';
      }

      return {
        position: [cluster.latitude, cluster.longitude],
        radius: 15000 + (intensity * 25000), // 15km to 40km based on intensity
        color,
        fillColor: color,
        fillOpacity: 0.15 + (intensity * 0.25), // 0.15 to 0.4
        opacity: 0.3 + (intensity * 0.4), // 0.3 to 0.7
        weight: 2,
        count: count,
        intensity: intensity
      };
    });
  }, [events, mode, isVisible]);

  if (!isVisible) return null;

  return (
    <>
      {heatMapData.map((point, index) => (
        <Circle
          key={`heatmap-${index}`}
          center={point.position}
          radius={point.radius}
          pathOptions={{
            color: point.color,
            fillColor: point.fillColor,
            fillOpacity: point.fillOpacity,
            opacity: point.opacity,
            weight: point.weight
          }}
        />
      ))}
    </>
  );
}

// Helper functions
function getSeverityScore(severity) {
  if (!severity) return 0.3;
  const normalized = severity.toString().toLowerCase();
  if (normalized === 'high' || normalized === 'major') return 1.0;
  if (normalized === 'medium' || normalized === 'moderate') return 0.6;
  if (normalized === 'low' || normalized === 'minor') return 0.3;
  return 0.5;
}

function getColorForIntensity(intensity) {
  // Green -> Yellow -> Red gradient
  if (intensity < 0.33) {
    return interpolateColor('#22c55e', '#fbbf24', intensity * 3);
  } else if (intensity < 0.66) {
    return interpolateColor('#fbbf24', '#ef4444', (intensity - 0.33) * 3);
  } else {
    return interpolateColor('#ef4444', '#dc2626', (intensity - 0.66) * 3);
  }
}

function getSeverityColor(severity) {
  // Severity-based colors
  if (severity >= 0.8) return '#dc2626'; // High - Red
  if (severity >= 0.6) return '#ef4444'; // Medium-High - Orange-Red
  if (severity >= 0.4) return '#fbbf24'; // Medium - Yellow
  return '#22c55e'; // Low - Green
}

function getRecentColor(intensity) {
  // Blue gradient for recent activity
  if (intensity < 0.33) {
    return interpolateColor('#60a5fa', '#3b82f6', intensity * 3);
  } else if (intensity < 0.66) {
    return interpolateColor('#3b82f6', '#2563eb', (intensity - 0.33) * 3);
  } else {
    return interpolateColor('#2563eb', '#1d4ed8', (intensity - 0.66) * 3);
  }
}

function interpolateColor(color1, color2, factor) {
  const c1 = parseInt(color1.slice(1), 16);
  const c2 = parseInt(color2.slice(1), 16);

  const r1 = (c1 >> 16) & 0xff;
  const g1 = (c1 >> 8) & 0xff;
  const b1 = c1 & 0xff;

  const r2 = (c2 >> 16) & 0xff;
  const g2 = (c2 >> 8) & 0xff;
  const b2 = c2 & 0xff;

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
