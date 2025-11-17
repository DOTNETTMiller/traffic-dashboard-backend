import { useState, useEffect } from 'react';
import { Rectangle, useMapEvents } from 'react-leaflet';
import { Download, Square, X } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function BoundingBoxSelector({ isDarkMode }) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentPoint, setCurrentPoint] = useState(null);
  const [boundingBox, setBoundingBox] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isPanelVisible, setIsPanelVisible] = useState(true);

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
  };

  const handleClosePanel = () => {
    setIsPanelVisible(false);
    // Clean up any active drawing
    if (isDrawing) {
      handleCancelDrawing();
    }
    handleClearBox();
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

      {/* Control Panel */}
      {isPanelVisible && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1000,
          backgroundColor: isDarkMode ? '#1f2937' : 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          padding: '12px',
          minWidth: '280px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <div style={{ fontWeight: '600', fontSize: '14px', color: isDarkMode ? '#f9fafb' : '#1f2937' }}>
              Bounding Box Export
            </div>
            <button
              onClick={handleClosePanel}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                color: isDarkMode ? '#d1d5db' : '#6b7280',
                borderRadius: '4px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? '#374151' : '#f3f4f6'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Close panel"
            >
              <X size={18} />
            </button>
          </div>

        {!boundingBox && !isDrawing && (
          <button
            onClick={handleStartDrawing}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Square size={16} />
            Draw Bounding Box
          </button>
        )}

        {isDrawing && (
          <div>
            <div style={{
              padding: '8px',
              backgroundColor: '#dbeafe',
              borderRadius: '6px',
              marginBottom: '8px',
              fontSize: '13px',
              color: '#1e40af'
            }}>
              Click and drag on the map to draw a box
            </div>
            <button
              onClick={handleCancelDrawing}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        )}

        {boundingBox && (
          <div>
            <div style={{
              backgroundColor: '#f3f4f6',
              borderRadius: '6px',
              padding: '10px',
              marginBottom: '12px',
              fontSize: '12px',
              fontFamily: 'monospace'
            }}>
              <div style={{ marginBottom: '4px' }}>
                <strong>Latitude:</strong> {boundingBox.minLat.toFixed(4)} to {boundingBox.maxLat.toFixed(4)}
              </div>
              <div>
                <strong>Longitude:</strong> {boundingBox.minLon.toFixed(4)} to {boundingBox.maxLon.toFixed(4)}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => handleExport('tim')}
                disabled={isExporting}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: isExporting ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
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
                  padding: '8px 12px',
                  backgroundColor: isExporting ? '#9ca3af' : '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Download size={16} />
                Export CV-TIM (J2540)
              </button>

              <button
                onClick={handleClearBox}
                style={{
                  width: '100%',
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <X size={14} />
                Clear Box
              </button>
            </div>
          </div>
        )}
        </div>
      )}

      {/* Reopen button when panel is closed */}
      {!isPanelVisible && (
        <button
          onClick={() => setIsPanelVisible(true)}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 1000,
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 14px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
          title="Open Bounding Box Tool"
        >
          <Square size={16} />
          Bounding Box
        </button>
      )}
    </>
  );
}

export default BoundingBoxSelector;
