import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Rectangle, useMap, useMapEvents } from 'react-leaflet';
import { theme } from '../styles/theme';
import 'leaflet/dist/leaflet.css';

// Component to track parent map changes
function ParentMapTracker({ parentMapRef, onViewportChange }) {
  const map = useMap();

  useEffect(() => {
    if (!parentMapRef.current) return;

    const parentMap = parentMapRef.current;

    const updateViewport = () => {
      const bounds = parentMap.getBounds();
      onViewportChange(bounds);
    };

    // Listen to parent map events
    parentMap.on('moveend', updateViewport);
    parentMap.on('zoomend', updateViewport);

    // Initial update
    updateViewport();

    return () => {
      parentMap.off('moveend', updateViewport);
      parentMap.off('zoomend', updateViewport);
    };
  }, [parentMapRef, onViewportChange]);

  return null;
}

// Component to handle mini-map click navigation
function MiniMapClickHandler({ parentMapRef }) {
  useMapEvents({
    click(e) {
      if (parentMapRef.current) {
        parentMapRef.current.setView([e.latlng.lat, e.latlng.lng]);
      }
    }
  });

  return null;
}

export default function MiniMapControl({ parentMapRef, isVisible, onToggle }) {
  const [viewportBounds, setViewportBounds] = useState(null);
  const miniMapRef = useRef(null);

  // Default view of continental USA
  const defaultCenter = [39.8283, -98.5795];
  const defaultZoom = 4;

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '24px',
          zIndex: 1000,
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: 'none',
          background: theme.colors.glassDark,
          backdropFilter: 'blur(20px)',
          boxShadow: theme.shadows.lg,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          transition: `all ${theme.transitions.fast}`
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = theme.shadows.xl;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = theme.shadows.lg;
        }}
        title="Show Mini Map"
      >
        🗺️
      </button>
    );
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: '24px',
      left: '24px',
      zIndex: 1000,
      width: '250px',
      height: '180px',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: theme.shadows.xl,
      border: `2px solid ${theme.colors.border}`,
      background: theme.colors.glassDark,
      backdropFilter: 'blur(20px)'
    }}>
      {/* Header */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1001,
        padding: '8px',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${theme.colors.border}`
      }}>
        <span style={{
          fontSize: '11px',
          fontWeight: '700',
          color: 'white',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Mini Map
        </span>
        <button
          onClick={onToggle}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '0 4px',
            lineHeight: 1,
            opacity: 0.8,
            transition: `all ${theme.transitions.fast}`
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'scale(1.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.8';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Hide Mini Map"
        >
          ×
        </button>
      </div>

      {/* Mini Map */}
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        attributionControl={false}
        style={{
          width: '100%',
          height: '100%',
          cursor: 'pointer'
        }}
        ref={miniMapRef}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          opacity={0.5}
        />

        {/* Viewport indicator */}
        {viewportBounds && (
          <Rectangle
            bounds={viewportBounds}
            pathOptions={{
              color: theme.colors.accentBlue,
              weight: 2,
              fillColor: theme.colors.accentBlue,
              fillOpacity: 0.2
            }}
          />
        )}

        {/* Track parent map viewport */}
        <ParentMapTracker
          parentMapRef={parentMapRef}
          onViewportChange={setViewportBounds}
        />

        {/* Handle clicks on mini-map */}
        <MiniMapClickHandler parentMapRef={parentMapRef} />
      </MapContainer>

      {/* Instructions */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1001,
        padding: '6px',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(10px)',
        fontSize: '9px',
        color: 'white',
        textAlign: 'center',
        opacity: 0.8
      }}>
        Click anywhere to navigate
      </div>
    </div>
  );
}
