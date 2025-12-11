import React from 'react';

/**
 * IFC Model Preview Component
 * Shows a visual preview card for BIM/CAD models
 * For future enhancement: Can integrate web-ifc-viewer for full 3D viewing
 */
const IFCViewer = ({ model, width = '100%', height = 200 }) => {
  const isIFC = model?.filename?.toLowerCase().endsWith('.ifc');
  const isCAD = model?.filename?.match(/\.(dxf|dwg|dgn)$/i);

  return (
    <div style={{
      width,
      height,
      borderRadius: '8px',
      overflow: 'hidden',
      border: '2px solid #e0e0e0',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white'
    }}>
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '10px' }}>
          {isIFC ? '🏗️' : isCAD ? '📐' : '📦'}
        </div>
        <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>
          {model?.project_name || 'BIM/CAD Model'}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.9 }}>
          {model?.ifc_schema || 'Model Preview'}
        </div>
        <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '5px' }}>
          {model?.total_elements} elements
        </div>
      </div>

      {/* 3D indicator badge */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        padding: '4px 8px',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 'bold'
      }}>
        {isIFC ? '3D BIM' : 'CAD'}
      </div>

      {/* Future: 3D View button */}
      {isIFC && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '6px 12px',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          color: '#667eea',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 'bold',
          cursor: 'pointer',
          opacity: 0.5
        }}
        title="3D viewing coming soon"
      >
        🔲 3D View (Coming Soon)
      </div>
      )}
    </div>
  );
};

export default IFCViewer;
