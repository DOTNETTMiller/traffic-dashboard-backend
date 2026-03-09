import { useState } from 'react';
import { theme } from '../styles/theme';

/**
 * CADD Model Viewer Component
 *
 * Views parsed CAD files (DXF, DWG, DGN) and displays:
 * - Layers and operational categories
 * - ITS equipment extracted from designs
 * - Road geometry (centerlines, lane markings)
 * - Traffic control devices
 * - Element breakdown and statistics
 *
 * Similar to IFC Model Viewer but for CADD files
 */
export default function CADDViewer({ model, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!model) return null;

  const stats = model.extraction_data ? JSON.parse(model.extraction_data).statistics : {};
  const extractionData = model.extraction_data ? JSON.parse(model.extraction_data) : {};

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #d1d5db',
        width: '100%',
        minWidth: '900px',
        maxWidth: '1600px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '2px solid #e5e7eb',
          backgroundColor: '#f3f4f6',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{
              margin: 0,
              color: '#111827',
              fontSize: '18px',
              marginBottom: theme.spacing.xs,
              fontWeight: 'bold'
            }}>
              📐 CADD Model Viewer
            </h2>
            <div style={{
              fontSize: '13px',
              color: '#374151'
            }}>
              {model.original_filename} • {model.file_format}
            </div>
            <div style={{ marginTop: theme.spacing.sm }}>
              <div style={{
                display: 'inline-block',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: '#dcfce7',
                color: '#166534',
                fontSize: '12px',
                fontWeight: '700',
                border: '1px solid #bbf7d0'
              }}>
                ✅ {model.extraction_status}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#ef4444',
              border: 'none',
              color: '#111827',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: '8px',
              fontWeight: 'bold',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '2px',
          borderBottom: '2px solid #e5e7eb',
          padding: `0 ${theme.spacing.md}`,
          backgroundColor: '#f9fafb'
        }}>
          {[
            { id: 'overview', label: '📊 Overview' },
            { id: 'layers', label: '🗂️ Layers' },
            { id: 'its', label: '🚦 ITS Equipment' },
            { id: 'geometry', label: '🛣️ Road Geometry' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? 'white' : 'transparent',
                border: 'none',
                padding: '10px 12px',
                color: activeTab === tab.id ? '#3b82f6' : '#6b7280',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                borderBottom: activeTab === tab.id ? '3px solid #3b82f6' : '3px solid transparent',
                borderTop: activeTab === tab.id ? '2px solid #e5e7eb' : '2px solid transparent',
                borderLeft: activeTab === tab.id ? '1px solid #e5e7eb' : 'none',
                borderRight: activeTab === tab.id ? '1px solid #e5e7eb' : 'none',
                borderRadius: '8px 8px 0 0',
                marginBottom: '-2px',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                flex: '1'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          backgroundColor: 'white',
          padding: '24px'
        }}>
          {activeTab === 'overview' && (
            <OverviewTab model={model} stats={stats} extractionData={extractionData} />
          )}
          {activeTab === 'layers' && (
            <LayersTab extractionData={extractionData} />
          )}
          {activeTab === 'its' && (
            <ITSEquipmentTab extractionData={extractionData} />
          )}
          {activeTab === 'geometry' && (
            <RoadGeometryTab extractionData={extractionData} />
          )}
        </div>
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ model, stats, extractionData }) {
  return (
    <div>
      <h3 style={{ color: '#111827', marginTop: 0, fontSize: '16px', fontWeight: '700' }}>
        Model Overview
      </h3>

      {/* Statistics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: theme.spacing.md,
        marginTop: theme.spacing.lg
      }}>
        <StatCard
          icon="📐"
          label="Total Entities"
          value={stats.totalEntities || model.total_entities || 0}
          color="#3b82f6"
        />
        <StatCard
          icon="🗂️"
          label="Layers"
          value={stats.totalLayers || model.total_layers || 0}
          color="#10b981"
        />
        <StatCard
          icon="🚦"
          label="ITS Equipment"
          value={stats.itsEquipment || model.its_equipment_count || 0}
          color="#f59e0b"
        />
        <StatCard
          icon="🛣️"
          label="Road Geometry"
          value={stats.roadGeometry || model.road_geometry_count || 0}
          color="#8b5cf6"
        />
      </div>

      {/* Metadata */}
      <div style={{ marginTop: theme.spacing.xl }}>
        <h4 style={{ color: '#374151', fontSize: '14px', fontWeight: '600', marginBottom: theme.spacing.sm }}>
          Model Metadata
        </h4>
        <div style={{
          padding: theme.spacing.md,
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          fontSize: '13px'
        }}>
          <MetadataRow label="File Format" value={model.file_format} />
          <MetadataRow label="CAD Version" value={extractionData.metadata?.version || 'Unknown'} />
          <MetadataRow label="Units" value={extractionData.metadata?.units || 'Unknown'} />
          <MetadataRow label="File Size" value={`${(model.file_size / 1024).toFixed(1)} KB`} />
          <MetadataRow label="Uploaded By" value={model.uploaded_by} />
          <MetadataRow label="Upload Date" value={new Date(model.uploaded_at).toLocaleString()} />
          {model.corridor && <MetadataRow label="Corridor" value={model.corridor} />}
          {model.state && <MetadataRow label="State" value={model.state} />}
        </div>
      </div>

      {/* Entity Type Breakdown */}
      {stats.entityTypes && (
        <div style={{ marginTop: theme.spacing.xl }}>
          <h4 style={{ color: '#374151', fontSize: '14px', fontWeight: '600', marginBottom: theme.spacing.sm }}>
            Entity Type Breakdown
          </h4>
          <div style={{
            padding: theme.spacing.md,
            backgroundColor: '#f9fafb',
            borderRadius: '8px'
          }}>
            {Object.entries(stats.entityTypes).map(([type, count]) => (
              <div key={type} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: '1px solid #e5e7eb',
                fontSize: '13px'
              }}>
                <span style={{ color: '#6b7280' }}>{type}</span>
                <span style={{ fontWeight: '600', color: '#111827' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Layers Tab Component
function LayersTab({ extractionData }) {
  const layers = extractionData.layers || [];

  return (
    <div>
      <h3 style={{ color: '#111827', marginTop: 0, fontSize: '16px', fontWeight: '700' }}>
        CAD Layers ({layers.length})
      </h3>

      <div style={{ marginTop: theme.spacing.lg }}>
        {layers.map((layer, idx) => (
          <div key={idx} style={{
            padding: theme.spacing.md,
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            marginBottom: theme.spacing.sm,
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: theme.spacing.xs
            }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                {layer.name}
              </span>
              <span style={{
                padding: '4px 8px',
                backgroundColor: layer.visible ? '#dcfce7' : '#fee2e2',
                color: layer.visible ? '#166534' : '#991b1b',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '600'
              }}>
                {layer.visible ? 'Visible' : 'Hidden'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              {layer.entityCount} entities
              {layer.color !== undefined && ` • Color: ${layer.color}`}
            </div>
          </div>
        ))}

        {layers.length === 0 && (
          <div style={{ textAlign: 'center', padding: theme.spacing.xl, color: '#6b7280' }}>
            No layers found in this model
          </div>
        )}
      </div>
    </div>
  );
}

// ITS Equipment Tab Component
function ITSEquipmentTab({ extractionData }) {
  const itsEquipment = extractionData.itsEquipment || [];

  return (
    <div>
      <h3 style={{ color: '#111827', marginTop: 0, fontSize: '16px', fontWeight: '700' }}>
        ITS Equipment ({itsEquipment.length})
      </h3>

      <div style={{ marginTop: theme.spacing.lg }}>
        {itsEquipment.map((equipment, idx) => (
          <div key={idx} style={{
            padding: theme.spacing.md,
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            marginBottom: theme.spacing.sm,
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: theme.spacing.xs
            }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                {equipment.type || 'ITS Device'}
              </span>
              <span style={{
                padding: '4px 8px',
                backgroundColor: '#dbeafe',
                color: '#1e40af',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '600'
              }}>
                {equipment.entityType || equipment.type}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Layer: {equipment.layer}
              {equipment.text && ` • Text: "${equipment.text}"`}
            </div>
            {equipment.geometry?.position && (
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                Position: ({equipment.geometry.position.x.toFixed(2)}, {equipment.geometry.position.y.toFixed(2)})
              </div>
            )}
          </div>
        ))}

        {itsEquipment.length === 0 && (
          <div style={{ textAlign: 'center', padding: theme.spacing.xl, color: '#6b7280' }}>
            No ITS equipment found in this model
          </div>
        )}
      </div>
    </div>
  );
}

// Road Geometry Tab Component
function RoadGeometryTab({ extractionData }) {
  const roadGeometry = extractionData.roadGeometry || [];

  return (
    <div>
      <h3 style={{ color: '#111827', marginTop: 0, fontSize: '16px', fontWeight: '700' }}>
        Road Geometry ({roadGeometry.length})
      </h3>

      <div style={{ marginTop: theme.spacing.lg }}>
        {roadGeometry.map((geom, idx) => (
          <div key={idx} style={{
            padding: theme.spacing.md,
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            marginBottom: theme.spacing.sm,
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: theme.spacing.xs
            }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                {geom.type}
              </span>
              <span style={{
                padding: '4px 8px',
                backgroundColor: '#fef3c7',
                color: '#92400e',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '600'
              }}>
                {geom.layer}
              </span>
            </div>
            {geom.geometry?.vertices && (
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                {geom.geometry.vertices.length} vertices
              </div>
            )}
          </div>
        ))}

        {roadGeometry.length === 0 && (
          <div style={{ textAlign: 'center', padding: theme.spacing.xl, color: '#6b7280' }}>
            No road geometry found in this model
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Components
function StatCard({ icon, label, value, color }) {
  return (
    <div style={{
      padding: theme.spacing.md,
      backgroundColor: '#f9fafb',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '24px', marginBottom: '4px' }}>{icon}</div>
      <div style={{ fontSize: '24px', fontWeight: '700', color, marginBottom: '4px' }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: '12px', color: '#6b7280' }}>{label}</div>
    </div>
  );
}

function MetadataRow({ label, value }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '6px 0',
      borderBottom: '1px solid #e5e7eb'
    }}>
      <span style={{ color: '#6b7280' }}>{label}:</span>
      <span style={{ fontWeight: '600', color: '#111827' }}>{value || 'N/A'}</span>
    </div>
  );
}
