import { useEffect, useState } from 'react';
import { Marker, Popup, Polyline } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import api from '../services/api';

// CADD element type icons and colors
const elementStyles = {
  its_equipment: {
    Sign: { icon: '🚏', color: '#f59e0b', label: 'Sign' },
    'Traffic Signal': { icon: '🚦', color: '#ef4444', label: 'Traffic Signal' },
    Camera: { icon: '📹', color: '#3b82f6', label: 'Camera' },
    DMS: { icon: '📺', color: '#8b5cf6', label: 'DMS' },
    Detector: { icon: '🌡️', color: '#10b981', label: 'Detector' },
    RSU: { icon: '📡', color: '#6366f1', label: 'RSU' },
    Beacon: { icon: '💡', color: '#eab308', label: 'Beacon' },
    Flasher: { icon: '⚡', color: '#f97316', label: 'Flasher' }
  },
  road_geometry: {
    icon: '🛣️',
    color: '#6b7280',
    label: 'Road Geometry'
  }
};

// Create custom marker icon for CADD elements
const createCADDIcon = (elementType, equipmentType) => {
  let style;

  if (elementType === 'its_equipment') {
    style = elementStyles.its_equipment[equipmentType] ||
            { icon: '📍', color: '#9ca3af', label: 'ITS Device' };
  } else {
    style = elementStyles.road_geometry;
  }

  return L.divIcon({
    html: `
      <div style="
        background: ${style.color};
        width: 30px;
        height: 30px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        opacity: 0.9;
      ">
        <span style="
          transform: rotate(45deg);
          font-size: 14px;
        ">${style.icon}</span>
        <div style="
          position: absolute;
          top: -4px;
          right: -4px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #3b82f6;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        "></div>
      </div>
    `,
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });
};

export default function CADDElementsLayer({ visible = true, stateKey = null, modelId = null }) {
  const [elements, setElements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedbackDetails, setFeedbackDetails] = useState(null);

  useEffect(() => {
    if (visible) {
      fetchElements();
    }
  }, [visible, stateKey, modelId]);

  const fetchElements = async () => {
    try {
      setLoading(true);
      setError(null);
      setFeedbackDetails(null);

      const params = {};
      if (stateKey) params.stateKey = stateKey;
      if (modelId) params.modelId = modelId;

      const response = await api.get('/api/cadd/map-elements', { params });

      if (response.data.success && Array.isArray(response.data.elements)) {
        // Filter to only elements with valid lat/lng
        const georeferenced = response.data.elements.filter(
          e => e.latitude && e.longitude &&
               !isNaN(e.latitude) && !isNaN(e.longitude)
        );

        setElements(georeferenced);

        const total = response.data.elements.length;
        const displayed = georeferenced.length;
        const needsGeoref = total - displayed;

        console.log(`📐 Loaded ${total} CADD elements (${displayed} georeferenced, ${needsGeoref} need georeferencing)`);

        // Prepare detailed feedback
        if (total > 0) {
          // Group elements by model
          const byModel = {};
          response.data.elements.forEach(el => {
            if (!byModel[el.modelName]) {
              byModel[el.modelName] = {
                total: 0,
                georeferenced: 0,
                types: {}
              };
            }
            byModel[el.modelName].total++;
            if (el.latitude && el.longitude) {
              byModel[el.modelName].georeferenced++;
            }
            // Count by type
            const type = el.type === 'its_equipment' ? el.equipmentType : 'Road Geometry';
            byModel[el.modelName].types[type] = (byModel[el.modelName].types[type] || 0) + 1;
          });

          setFeedbackDetails({
            total,
            displayed,
            needsGeoref,
            models: Object.keys(byModel).length,
            byModel
          });

          if (displayed === 0 && total > 0) {
            setError(`${total} CADD element(s) found but none are georeferenced.`);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching CADD elements:', err);
      setError('Failed to load CADD elements');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  // Show detailed feedback notification
  if (feedbackDetails) {
    const hasNonGeoref = feedbackDetails.needsGeoref > 0;
    const hasDisplayed = feedbackDetails.displayed > 0;

    return (
      <>
        {/* Feedback Panel */}
        <div style={{
          position: 'absolute',
          top: '80px',
          right: '10px',
          zIndex: 1000,
          backgroundColor: hasNonGeoref ? '#fef3c7' : '#dcfce7',
          border: `2px solid ${hasNonGeoref ? '#f59e0b' : '#10b981'}`,
          borderRadius: '8px',
          padding: '12px',
          maxWidth: '350px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          <div style={{ fontSize: '13px', color: hasNonGeoref ? '#92400e' : '#166534' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>{hasNonGeoref ? '⚠️' : '✅'}</span>
              <strong>📐 CADD Elements Status</strong>
            </div>

            <div style={{ marginBottom: '8px', paddingLeft: '28px' }}>
              <div><strong>Total Elements:</strong> {feedbackDetails.total}</div>
              <div><strong>Displayed on Map:</strong> {feedbackDetails.displayed} {hasDisplayed && '✓'}</div>
              {hasNonGeoref && (
                <div style={{ color: '#f59e0b' }}>
                  <strong>Need Georeferencing:</strong> {feedbackDetails.needsGeoref}
                </div>
              )}
              <div><strong>Models:</strong> {feedbackDetails.models}</div>
            </div>

            {hasNonGeoref && (
              <>
                <div style={{
                  borderTop: '1px solid #f59e0b',
                  paddingTop: '8px',
                  marginTop: '8px',
                  paddingLeft: '28px'
                }}>
                  <strong>Models Needing Georeferencing:</strong>
                  <div style={{ marginTop: '4px', fontSize: '11px' }}>
                    {Object.entries(feedbackDetails.byModel)
                      .filter(([name, data]) => data.georeferenced < data.total)
                      .map(([name, data]) => (
                        <div key={name} style={{
                          marginBottom: '4px',
                          padding: '4px 6px',
                          backgroundColor: 'rgba(251, 191, 36, 0.1)',
                          borderRadius: '4px'
                        }}>
                          <div style={{ fontWeight: 'bold' }}>{name}</div>
                          <div>
                            {data.total - data.georeferenced} of {data.total} elements not georeferenced
                          </div>
                          <div style={{ fontSize: '10px', color: '#92400e' }}>
                            Types: {Object.keys(data.types).join(', ')}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                <div style={{
                  borderTop: '1px solid #f59e0b',
                  paddingTop: '8px',
                  marginTop: '8px',
                  paddingLeft: '28px',
                  fontSize: '11px'
                }}>
                  <strong>💡 How to Fix:</strong>
                  <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
                    <li>Add lat/lng reference points when uploading</li>
                    <li>Use state plane coordinate system metadata</li>
                    <li>Export to GeoJSON/Shapefile for ArcGIS georeferencing</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Render markers for georeferenced elements */}
        {hasDisplayed && (
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={50}
            spiderfyOnMaxZoom={true}
            showCoverageOnHover={false}
            iconCreateFunction={(cluster) => {
              const count = cluster.getChildCount();
              return L.divIcon({
                html: `<div style="
                  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
                  width: 40px;
                  height: 40px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-weight: bold;
                  border: 3px solid white;
                  box-shadow: 0 3px 10px rgba(0,0,0,0.3);
                ">
                  <div style="font-size: 14px;">📐</div>
                  <div style="
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    background: #ef4444;
                    color: white;
                    border-radius: 10px;
                    padding: 2px 6px;
                    font-size: 11px;
                    font-weight: bold;
                    border: 2px solid white;
                  ">${count}</div>
                </div>`,
                className: '',
                iconSize: [40, 40]
              });
            }}
          >
            {elements.map(element => (
              <Marker
                key={element.id}
                position={[element.latitude, element.longitude]}
                icon={createCADDIcon(element.type, element.equipmentType)}
              >
                <Popup>
                  <div style={{ minWidth: '200px' }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: 'bold',
                      marginBottom: '8px',
                      color: '#111827',
                      borderBottom: '2px solid #e5e7eb',
                      paddingBottom: '8px'
                    }}>
                      📐 CADD Element
                    </div>

                    {element.type === 'its_equipment' && (
                      <>
                        <div style={{ marginBottom: '6px' }}>
                          <strong>Type:</strong> {element.equipmentType}
                        </div>
                        <div style={{ marginBottom: '6px' }}>
                          <strong>Layer:</strong> {element.layer}
                        </div>
                        {element.text && (
                          <div style={{ marginBottom: '6px' }}>
                            <strong>Text:</strong> {element.text}
                          </div>
                        )}
                      </>
                    )}

                    {element.type === 'road_geometry' && (
                      <>
                        <div style={{ marginBottom: '6px' }}>
                          <strong>Type:</strong> {element.geometryType}
                        </div>
                        <div style={{ marginBottom: '6px' }}>
                          <strong>Layer:</strong> {element.layer}
                        </div>
                        <div style={{ marginBottom: '6px' }}>
                          <strong>Vertices:</strong> {element.vertexCount}
                        </div>
                      </>
                    )}

                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                        <strong>Model:</strong> {element.modelName}
                      </div>
                      {element.corridor && (
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                          <strong>Corridor:</strong> {element.corridor}
                        </div>
                      )}
                      {element.state && (
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          <strong>State:</strong> {element.state.toUpperCase()}
                        </div>
                      )}
                    </div>

                    {element.cadPosition && (
                      <div style={{
                        marginTop: '10px',
                        padding: '8px',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#6b7280'
                      }}>
                        <strong>CAD Position:</strong><br/>
                        X: {element.cadPosition.x.toFixed(2)}<br/>
                        Y: {element.cadPosition.y.toFixed(2)}
                        {element.cadPosition.z !== 0 && <><br/>Z: {element.cadPosition.z.toFixed(2)}</>}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        )}
      </>
    );
  }

  return null;
}
