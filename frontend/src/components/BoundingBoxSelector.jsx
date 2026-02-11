import { useState, useEffect } from 'react';
import { Rectangle, useMapEvents } from 'react-leaflet';
import { Download, Square, X, Save, Upload } from 'lucide-react';
import { theme } from '../styles/theme';
import { config } from '../config';

const API_BASE_URL = config.apiUrl;
const STORAGE_KEY = 'boundingBoxPreference';

function BoundingBoxSelector({ isDarkMode }) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentPoint, setCurrentPoint] = useState(null);
  const [boundingBox, setBoundingBox] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputMode, setInputMode] = useState('draw'); // 'draw' or 'manual'

  // Manual input fields
  const [manualMinLat, setManualMinLat] = useState('');
  const [manualMaxLat, setManualMaxLat] = useState('');
  const [manualMinLon, setManualMinLon] = useState('');
  const [manualMaxLon, setManualMaxLon] = useState('');

  // Load saved preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const box = JSON.parse(saved);
        setBoundingBox(box);
      }
    } catch (error) {
      console.error('Failed to load saved bounding box:', error);
    }
  }, []);

  const map = useMapEvents({
    mousedown: (e) => {
      if (isDrawing) {
        setStartPoint(e.latlng);
        setCurrentPoint(e.latlng);
      }
    },
    mousemove: (e) => {
      if (isDrawing && startPoint) {
        setCurrentPoint(e.latlng);
      }
    },
    mouseup: (e) => {
      if (isDrawing && startPoint) {
        const bounds = {
          minLat: Math.min(startPoint.lat, e.latlng.lat),
          maxLat: Math.max(startPoint.lat, e.latlng.lat),
          minLon: Math.min(startPoint.lng, e.latlng.lng),
          maxLon: Math.max(startPoint.lng, e.latlng.lng)
        };
        setBoundingBox(bounds);
        setStartPoint(null);
        setCurrentPoint(null);
        setIsDrawing(false);
      }
    }
  });

  // Get rectangle bounds for rendering
  const getRectangleBounds = () => {
    if (boundingBox) {
      return [
        [boundingBox.minLat, boundingBox.minLon],
        [boundingBox.maxLat, boundingBox.maxLon]
      ];
    }
    if (startPoint && currentPoint) {
      return [
        [startPoint.lat, startPoint.lng],
        [currentPoint.lat, currentPoint.lng]
      ];
    }
    return null;
  };

  const handleStartDrawing = () => {
    setIsDrawing(true);
    setBoundingBox(null);
    map.dragging.disable();
  };

  const handleCancelDrawing = () => {
    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
    map.dragging.enable();
  };

  const handleClearBox = () => {
    setBoundingBox(null);
    setStartPoint(null);
    setCurrentPoint(null);
    setManualMinLat('');
    setManualMaxLat('');
    setManualMinLon('');
    setManualMaxLon('');
  };

  const handleSavePreference = () => {
    if (!boundingBox) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(boundingBox));
      alert('Bounding box preference saved!');
    } catch (error) {
      console.error('Failed to save preference:', error);
      alert('Failed to save preference');
    }
  };

  const handleClearPreference = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      handleClearBox();
      alert('Saved preference cleared!');
    } catch (error) {
      console.error('Failed to clear preference:', error);
    }
  };

  const handleApplyManualCoordinates = () => {
    const minLat = parseFloat(manualMinLat);
    const maxLat = parseFloat(manualMaxLat);
    const minLon = parseFloat(manualMinLon);
    const maxLon = parseFloat(manualMaxLon);

    // Validate inputs
    if (isNaN(minLat) || isNaN(maxLat) || isNaN(minLon) || isNaN(maxLon)) {
      alert('Please enter valid numbers for all coordinate fields');
      return;
    }

    if (minLat >= maxLat || minLon >= maxLon) {
      alert('Minimum values must be less than maximum values');
      return;
    }

    if (minLat < -90 || maxLat > 90 || minLon < -180 || maxLon > 180) {
      alert('Coordinates out of valid range (lat: -90 to 90, lon: -180 to 180)');
      return;
    }

    setBoundingBox({ minLat, maxLat, minLon, maxLon });
  };

  const handleExport = async (endpoint) => {
    if (!boundingBox) return;

    setIsExporting(true);
    try {
      const url = `${API_BASE_URL}/api/convert/${endpoint}?minLat=${boundingBox.minLat}&maxLat=${boundingBox.maxLat}&minLon=${boundingBox.minLon}&maxLon=${boundingBox.maxLon}`;

      const response = await fetch(url);
      const data = await response.json();

      // Create downloadable JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${endpoint}-bbox-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      console.log(`Exported ${data.messageCount || 0} messages from ${endpoint}`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (!isDrawing) {
      map.dragging.enable();
    }
  }, [isDrawing, map]);

  const rectangleBounds = getRectangleBounds();

  return (
    <>
      {/* Render the rectangle */}
      {rectangleBounds && (
        <Rectangle
          bounds={rectangleBounds}
          pathOptions={{
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.1,
            weight: 2,
            dashArray: isDrawing ? '5, 5' : null
          }}
        />
      )}

      {/* Simple button when collapsed */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 1000,
            background: theme.colors.accentBlue,
            color: '#111827',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 16px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            boxShadow: theme.shadows.lg,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: `all ${theme.transitions.fast}`
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = theme.shadows.xl;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = theme.shadows.lg;
          }}
        >
          <Square size={16} />
          Draw Bounding Box
        </button>
      )}

      {/* Expanded panel */}
      {isExpanded && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1000,
          background: theme.colors.glassDark,
          backdropFilter: 'blur(20px)',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '12px',
          boxShadow: theme.shadows.xl,
          padding: theme.spacing.md,
          minWidth: '320px',
          maxWidth: '400px'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing.md,
            paddingBottom: theme.spacing.sm,
            borderBottom: `1px solid ${theme.colors.border}`
          }}>
            <span style={{
              fontSize: '14px',
              fontWeight: '700',
              color: theme.colors.text
            }}>
              Bounding Box Export
            </span>
            <button
              onClick={() => {
                setIsExpanded(false);
                if (isDrawing) handleCancelDrawing();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.colors.textSecondary,
                fontSize: '18px',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              ✕
            </button>
          </div>

          {/* Mode Tabs */}
          <div style={{
            display: 'flex',
            gap: theme.spacing.xs,
            marginBottom: theme.spacing.md,
            background: theme.colors.glassLight,
            borderRadius: '8px',
            padding: '4px'
          }}>
            <button
              onClick={() => {
                setInputMode('draw');
                if (isDrawing) handleCancelDrawing();
              }}
              style={{
                flex: 1,
                padding: '8px',
                background: inputMode === 'draw' ? theme.colors.accentBlue : 'transparent',
                color: inputMode === 'draw' ? 'white' : theme.colors.text,
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: `all ${theme.transitions.fast}`
              }}
            >
              Draw on Map
            </button>
            <button
              onClick={() => {
                setInputMode('manual');
                if (isDrawing) handleCancelDrawing();
              }}
              style={{
                flex: 1,
                padding: '8px',
                background: inputMode === 'manual' ? theme.colors.accentBlue : 'transparent',
                color: inputMode === 'manual' ? 'white' : theme.colors.text,
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: `all ${theme.transitions.fast}`
              }}
            >
              Enter Coordinates
            </button>
          </div>

          {/* Draw Mode */}
          {inputMode === 'draw' && (
            <div>
              {!isDrawing && !boundingBox && (
                <button
                  onClick={handleStartDrawing}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: theme.colors.accentBlue,
                    color: '#111827',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginBottom: theme.spacing.md
                  }}
                >
                  <Square size={16} />
                  Start Drawing
                </button>
              )}

              {isDrawing && (
                <div style={{ marginBottom: theme.spacing.md }}>
                  <div style={{
                    padding: theme.spacing.sm,
                    background: `${theme.colors.accentBlue}20`,
                    borderRadius: '8px',
                    marginBottom: theme.spacing.sm,
                    fontSize: '12px',
                    color: theme.colors.text
                  }}>
                    ℹ️ Click and drag on the map to draw a box
                  </div>
                  <button
                    onClick={handleCancelDrawing}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: '#ef4444',
                      color: '#111827',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <X size={16} />
                    Cancel Drawing
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Manual Coordinate Input Mode */}
          {inputMode === 'manual' && (
            <div style={{ marginBottom: theme.spacing.md }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: theme.spacing.sm,
                marginBottom: theme.spacing.sm
              }}>
                <div>
                  <label style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: theme.colors.textSecondary,
                    marginBottom: '4px',
                    display: 'block'
                  }}>
                    Min Latitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={manualMinLat}
                    onChange={(e) => setManualMinLat(e.target.value)}
                    placeholder="e.g., 40.7128"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '6px',
                      fontSize: '12px',
                      background: theme.colors.glassLight,
                      color: theme.colors.text
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: theme.colors.textSecondary,
                    marginBottom: '4px',
                    display: 'block'
                  }}>
                    Max Latitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={manualMaxLat}
                    onChange={(e) => setManualMaxLat(e.target.value)}
                    placeholder="e.g., 41.8781"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '6px',
                      fontSize: '12px',
                      background: theme.colors.glassLight,
                      color: theme.colors.text
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: theme.colors.textSecondary,
                    marginBottom: '4px',
                    display: 'block'
                  }}>
                    Min Longitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={manualMinLon}
                    onChange={(e) => setManualMinLon(e.target.value)}
                    placeholder="e.g., -74.0060"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '6px',
                      fontSize: '12px',
                      background: theme.colors.glassLight,
                      color: theme.colors.text
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: theme.colors.textSecondary,
                    marginBottom: '4px',
                    display: 'block'
                  }}>
                    Max Longitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={manualMaxLon}
                    onChange={(e) => setManualMaxLon(e.target.value)}
                    placeholder="e.g., -73.7124"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '6px',
                      fontSize: '12px',
                      background: theme.colors.glassLight,
                      color: theme.colors.text
                    }}
                  />
                </div>
              </div>
              <button
                onClick={handleApplyManualCoordinates}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: theme.colors.accentBlue,
                  color: '#111827',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                Apply Coordinates
              </button>
            </div>
          )}

          {/* Current Bounding Box Display */}
          {boundingBox && (
            <div style={{
              background: theme.colors.glassLight,
              borderRadius: '8px',
              padding: theme.spacing.sm,
              marginBottom: theme.spacing.md,
              fontSize: '11px',
              fontFamily: 'monospace'
            }}>
              <div style={{ marginBottom: '4px', color: theme.colors.text }}>
                <strong>Lat:</strong> {boundingBox.minLat.toFixed(4)} to {boundingBox.maxLat.toFixed(4)}
              </div>
              <div style={{ color: theme.colors.text }}>
                <strong>Lon:</strong> {boundingBox.minLon.toFixed(4)} to {boundingBox.maxLon.toFixed(4)}
              </div>
            </div>
          )}

          {/* Export Buttons */}
          {boundingBox && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs, marginBottom: theme.spacing.md }}>
              <button
                onClick={() => handleExport('tim')}
                disabled={isExporting}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: isExporting ? '#9ca3af' : '#10b981',
                  color: '#111827',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Download size={16} />
                Export TIM (J2735)
              </button>
              <button
                onClick={() => handleExport('tim-cv')}
                disabled={isExporting}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: isExporting ? '#9ca3af' : '#8b5cf6',
                  color: '#111827',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Download size={16} />
                Export CV-TIM (J2540)
              </button>
            </div>
          )}

          {/* Preference Management */}
          <div style={{
            display: 'flex',
            gap: theme.spacing.xs,
            paddingTop: theme.spacing.sm,
            borderTop: `1px solid ${theme.colors.border}`
          }}>
            <button
              onClick={handleSavePreference}
              disabled={!boundingBox}
              style={{
                flex: 1,
                padding: '8px',
                background: boundingBox ? `${theme.colors.accentPurple}20` : theme.colors.glassLight,
                color: boundingBox ? theme.colors.accentPurple : theme.colors.textSecondary,
                border: `1px solid ${boundingBox ? theme.colors.accentPurple : theme.colors.border}`,
                borderRadius: '6px',
                cursor: boundingBox ? 'pointer' : 'not-allowed',
                fontSize: '11px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Save size={14} />
              Save
            </button>
            <button
              onClick={handleClearBox}
              disabled={!boundingBox}
              style={{
                flex: 1,
                padding: '8px',
                background: 'transparent',
                color: boundingBox ? theme.colors.textSecondary : theme.colors.border,
                border: `1px solid ${boundingBox ? theme.colors.border : theme.colors.border}`,
                borderRadius: '6px',
                cursor: boundingBox ? 'pointer' : 'not-allowed',
                fontSize: '11px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <X size={14} />
              Clear
            </button>
            <button
              onClick={handleClearPreference}
              style={{
                flex: 1,
                padding: '8px',
                background: 'transparent',
                color: '#ef4444',
                border: '1px solid #ef4444',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <X size={14} />
              Clear Saved
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default BoundingBoxSelector;
