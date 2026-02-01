/**
 * Corridor Geometry Diff Visualization
 *
 * Shows before/after comparison of corridor geometries:
 * - Grey line: Old geometry (before update)
 * - Red line: New geometry (after update)
 *
 * Useful for:
 * - Visualizing geometry improvements
 * - Verifying route changes
 * - Quality assurance after updates
 */

import { useEffect, useState } from 'react';
import { Polyline, Popup } from 'react-leaflet';
import { config } from '../config';

export default function CorridorGeometryDiff({ showDiff = false }) {
  const [diffs, setDiffs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!showDiff) {
      setDiffs([]);
      return;
    }

    fetchGeometryDiffs();
  }, [showDiff]);

  const fetchGeometryDiffs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${config.apiUrl}/api/corridors/geometry-diffs`);
      const data = await response.json();

      if (data.success) {
        setDiffs(data.diffs || []);
      }
    } catch (error) {
      console.error('Error fetching geometry diffs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!showDiff || diffs.length === 0) {
    return null;
  }

  return (
    <>
      {diffs.map((diff, idx) => {
        // Old geometry - grey line
        const oldPositions = diff.old_geometry?.coordinates?.map(coord => [coord[1], coord[0]]);

        // New geometry - red line
        const newPositions = diff.new_geometry?.coordinates?.map(coord => [coord[1], coord[0]]);

        const updateDate = diff.updated_at ? new Date(diff.updated_at).toLocaleDateString() : 'Unknown';
        const daysSinceUpdate = diff.updated_at
          ? Math.floor((new Date() - new Date(diff.updated_at)) / (1000 * 60 * 60 * 24))
          : null;

        return (
          <div key={idx}>
            {/* Old geometry (grey) */}
            {oldPositions && oldPositions.length >= 2 && (
              <Polyline
                positions={oldPositions}
                pathOptions={{
                  color: '#9ca3af',
                  weight: 3,
                  opacity: 0.6,
                  dashArray: '5, 10'
                }}
              >
                <Popup>
                  <div style={{ minWidth: '250px' }}>
                    <div style={{
                      background: '#9ca3af',
                      color: 'white',
                      padding: '8px',
                      margin: '-10px -10px 8px -10px',
                      fontWeight: 'bold'
                    }}>
                      OLD: {diff.corridor_name}
                    </div>
                    <div style={{ fontSize: '13px' }}>
                      <div><strong>Status:</strong> Previous geometry</div>
                      <div><strong>Points:</strong> {oldPositions.length}</div>
                      <div><strong>Replaced:</strong> {updateDate}</div>
                      {daysSinceUpdate !== null && (
                        <div><strong>Age:</strong> {daysSinceUpdate} days ago</div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Polyline>
            )}

            {/* New geometry (red) */}
            {newPositions && newPositions.length >= 2 && (
              <Polyline
                positions={newPositions}
                pathOptions={{
                  color: '#ef4444',
                  weight: 4,
                  opacity: 0.9,
                  dashArray: null
                }}
              >
                <Popup>
                  <div style={{ minWidth: '250px' }}>
                    <div style={{
                      background: '#ef4444',
                      color: 'white',
                      padding: '8px',
                      margin: '-10px -10px 8px -10px',
                      fontWeight: 'bold'
                    }}>
                      NEW: {diff.corridor_name}
                    </div>
                    <div style={{ fontSize: '13px' }}>
                      <div><strong>Status:</strong> Current geometry</div>
                      <div><strong>Points:</strong> {newPositions.length}</div>
                      <div><strong>Updated:</strong> {updateDate}</div>
                      {diff.improvement_notes && (
                        <div style={{ marginTop: '8px', fontStyle: 'italic' }}>
                          {diff.improvement_notes}
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Polyline>
            )}
          </div>
        );
      })}
    </>
  );
}
