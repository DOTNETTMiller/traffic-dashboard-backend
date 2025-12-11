import React from 'react';

/**
 * IFC Model Preview Component
 * Shows a visual preview card for BIM/CAD models with element breakdown
 */
const IFCViewer = ({ model, width = '100%', height = 200 }) => {
  const isIFC = model?.filename?.toLowerCase().endsWith('.ifc');
  const isCAD = model?.filename?.match(/\.(dxf|dwg|dgn)$/i);

  // Get top 5 element types from breakdown
  const topElements = (model?.element_breakdown || []).slice(0, 5);
  const hasBreakdown = topElements.length > 0;

  // Simplified category names for display
  const simplifyCategory = (category) => {
    if (!category) return 'Elements';
    return category
      .replace('Traffic ', '')
      .replace('Pavement ', '')
      .replace('Bridge ', '')
      .replace('Infrastructure', 'Infra');
  };

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
      flexDirection: 'column',
      color: 'white'
    }}>
      {/* Header with icon and title */}
      <div style={{
        textAlign: 'center',
        padding: '12px 10px 8px 10px',
        borderBottom: hasBreakdown ? '1px solid rgba(255,255,255,0.2)' : 'none'
      }}>
        <div style={{ fontSize: '32px', marginBottom: '4px' }}>
          {isIFC ? '🏗️' : isCAD ? '📐' : '📦'}
        </div>
        <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '2px' }}>
          {model?.project_name || 'BIM/CAD Model'}
        </div>
        <div style={{ fontSize: '10px', opacity: 0.8 }}>
          {model?.total_elements} elements
        </div>
      </div>

      {/* Element breakdown */}
      {hasBreakdown && (
        <div style={{
          flex: 1,
          padding: '8px 10px',
          fontSize: '10px',
          overflow: 'hidden'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px', opacity: 0.9 }}>
            Infrastructure:
          </div>
          {topElements.map((item, idx) => (
            <div key={idx} style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '2px',
              opacity: 0.95
            }}>
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginRight: '8px'
              }}>
                {simplifyCategory(item.category)}
              </span>
              <span style={{ fontWeight: 'bold' }}>{item.count}</span>
            </div>
          ))}

          {/* V2X and AV indicators */}
          {(model.v2x_count > 0 || model.av_count > 0) && (
            <div style={{
              marginTop: '6px',
              paddingTop: '6px',
              borderTop: '1px solid rgba(255,255,255,0.2)',
              display: 'flex',
              gap: '8px',
              fontSize: '9px'
            }}>
              {model.v2x_count > 0 && (
                <span title="V2X Applicable Elements">
                  📡 V2X: {model.v2x_count}
                </span>
              )}
              {model.av_count > 0 && (
                <span title="AV Critical Elements">
                  🚗 AV: {model.av_count}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3D indicator badge */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        padding: '3px 6px',
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        borderRadius: '3px',
        fontSize: '9px',
        fontWeight: 'bold'
      }}>
        {isIFC ? '3D BIM' : 'CAD'}
      </div>
    </div>
  );
};

export default IFCViewer;
