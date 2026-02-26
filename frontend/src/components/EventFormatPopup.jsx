import { useState } from 'react';
import { formatAsTIM, formatAsCIFS, isCommercialVehicleRelevant } from '../utils/messageFormatters';
import NearbyITSEquipment from './NearbyITSEquipment';

/**
 * Enhanced Event Popup with Multiple Format Views
 *
 * Shows the SAME event in different standardized formats to highlight
 * what normalization and conversion is happening:
 * - Raw: Original feed data as received
 * - TIM: SAE J2735 Traveler Information Message format
 * - CIFS: Common Incident Feed Specification format
 */
export default function EventFormatPopup({
  event,
  onEventSelect,
  hasMessages,
  messageCount,
  borderInfo,
  geometryDiagnostics
}) {
  const [activeTab, setActiveTab] = useState('raw'); // 'raw', 'tim', 'cifs', 'geometry'

  // Generate formatted versions
  const timFormat = formatAsTIM(event);
  const cifsFormat = formatAsCIFS(event);
  const showCVTIM = isCommercialVehicleRelevant(event);

  const tabs = [
    { id: 'raw', label: 'Raw Feed', icon: '📋' },
    { id: 'tim', label: 'SAE J2735', icon: '📡' },
    { id: 'cifs', label: 'CIFS', icon: '🚨' }
  ];

  // Add Geometry tab if diagnostics available
  if (geometryDiagnostics) {
    tabs.push({ id: 'geometry', label: 'Geometry', icon: '🗺️' });
  }

  return (
    <div style={{ padding: '0', width: '340px', maxWidth: '90vw', maxHeight: '80vh', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #e5e7eb',
        marginBottom: '6px',
        backgroundColor: 'white',
        flexShrink: 0
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab(tab.id);
            }}
            style={{
              flex: 1,
              padding: '10px 8px',
              border: 'none',
              backgroundColor: activeTab === tab.id ? 'white' : 'transparent',
              borderBottom: activeTab === tab.id ? '3px solid #3b82f6' : '3px solid transparent',
              marginBottom: '-2px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: activeTab === tab.id ? '700' : '500',
              color: activeTab === tab.id ? '#3b82f6' : '#6b7280',
              transition: 'all 0.2s',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '16px', marginBottom: '2px' }}>{tab.icon}</div>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content - Scrollable */}
      <div style={{ padding: '6px 10px', backgroundColor: 'white', overflowY: 'auto', flex: 1 }}>
        {activeTab === 'raw' && (
          <RawFormatView
            event={event}
            borderInfo={borderInfo}
            showCVTIM={showCVTIM}
          />
        )}
        {activeTab === 'tim' && (
          <TIMFormatView
            event={event}
            timFormat={timFormat}
            showCVTIM={showCVTIM}
          />
        )}
        {activeTab === 'cifs' && (
          <CIFSFormatView
            event={event}
            cifsFormat={cifsFormat}
          />
        )}
        {activeTab === 'geometry' && geometryDiagnostics && (
          <GeometryDiagnosticsView
            diagnostics={geometryDiagnostics}
          />
        )}

        {/* Nearby ITS Equipment (shown in all tabs) */}
        <div style={{ paddingTop: '6px' }}>
          <NearbyITSEquipment event={event} />
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        gap: '8px',
        backgroundColor: 'white'
      }}>
        {hasMessages && (
          <div style={{
            flex: 1,
            padding: '8px',
            backgroundColor: '#dbeafe',
            borderRadius: '4px',
            fontSize: '11px',
            textAlign: 'center',
            fontWeight: '600',
            color: '#1e40af'
          }}>
            💬 {messageCount} Message{messageCount !== 1 ? 's' : ''}
          </div>
        )}
        <button
          onClick={() => onEventSelect && onEventSelect(event)}
          style={{
            flex: hasMessages ? 1 : 2,
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: '#111827',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600'
          }}
        >
          {hasMessages ? 'View Messages' : 'Add Message'}
        </button>
      </div>
    </div>
  );
}

/**
 * Raw Feed Format - Shows data as received from DOT feed
 */
function RawFormatView({ event, borderInfo, showCVTIM }) {
  return (
    <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
      {/* Header */}
      <div style={{
        padding: '6px',
        backgroundColor: 'white',
        borderRadius: '4px',
        marginBottom: '8px',
        borderLeft: '3px solid #6b7280'
      }}>
        <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '600', marginBottom: '2px' }}>
          RAW FEED DATA
        </div>
        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#111827' }}>
          {event.eventType}
        </div>
      </div>

      {/* Event Details */}
      <Field label="Event Type" value={event.eventType} />
      <Field label="Description" value={event.description} multiline />
      <Field label="Location" value={event.location} />
      <Field label="Corridor" value={event.corridor} />
      <Field label="Direction" value={event.direction} />
      <Field label="State" value={event.state} />
      <Field label="Lanes Affected" value={event.lanesAffected} />

      {event.severity && (
        <div style={{ margin: '6px 0' }}>
          <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>Severity: </span>
          <span style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '3px',
            backgroundColor: getSeverityColor(event.severity),
            color: '#111827',
            fontSize: '10px',
            fontWeight: '700'
          }}>
            {event.severity}
          </span>
        </div>
      )}

      {event.startTime && (
        <Field
          label="Start Time"
          value={new Date(event.startTime).toLocaleString()}
        />
      )}

      {borderInfo && borderInfo.nearBorder && (
        <div style={{
          margin: '8px 0',
          padding: '6px',
          backgroundColor: '#e0e7ff',
          borderRadius: '3px',
          borderLeft: '3px solid #6366f1',
          fontSize: '10px'
        }}>
          <strong>🔵 Border Event</strong><br/>
          {borderInfo.distance} miles from {borderInfo.borderName}<br/>
          <span style={{ fontSize: '9px', fontStyle: 'italic', color: '#4338ca' }}>
            Requires {borderInfo.borderStates.join('-')} coordination
          </span>
        </div>
      )}

      {showCVTIM && (
        <div style={{
          margin: '8px 0',
          padding: '5px 6px',
          backgroundColor: 'white',
          borderRadius: '3px',
          fontSize: '10px',
          color: '#92400e',
          fontWeight: '600'
        }}>
          🚛 Commercial Vehicle Relevant
        </div>
      )}
    </div>
  );
}

/**
 * SAE J2735 TIM Format - Shows event formatted as Traveler Information Message
 */
function TIMFormatView({ event, timFormat, showCVTIM }) {
  return (
    <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
      {/* Header */}
      <div style={{
        padding: '6px',
        backgroundColor: '#eff6ff',
        borderRadius: '4px',
        marginBottom: '8px',
        borderLeft: '3px solid #3b82f6'
      }}>
        <div style={{ fontSize: '10px', color: '#3b82f6', fontWeight: '600', marginBottom: '2px' }}>
          SAE J2735 TIM
        </div>
        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e40af' }}>
          {timFormat.data.msgType}
        </div>
      </div>

      {showCVTIM && (
        <div style={{
          padding: '5px 6px',
          backgroundColor: 'white',
          borderRadius: '3px',
          marginBottom: '6px',
          fontSize: '10px',
          color: '#92400e',
          fontWeight: '600'
        }}>
          🚛 Commercial Vehicle Relevant
        </div>
      )}

      {/* TIM Fields - Clean list format */}
      <Field label="Message ID" value={timFormat.data.msgID} />
      <Field label="Message Type" value={timFormat.data.msgType} />
      <Field label="ITIS Code" value={timFormat.data.itis || 'N/A'} />
      <Field
        label="Priority"
        value={`${timFormat.data.priority} (${timFormat.data.severity})`}
      />
      <Field label="Road Name" value={timFormat.data.route.roadName} />
      <Field label="Direction" value={timFormat.data.route.direction} />
      <Field label="Location" value={timFormat.data.location.description} />
      <Field label="Description" value={timFormat.data.content.description} multiline />
      <Field label="Lanes Affected" value={timFormat.data.content.lanesAffected} />

      {timFormat.data.validity.startTime && (
        <Field
          label="Valid From"
          value={new Date(timFormat.data.validity.startTime).toLocaleString() + (timFormat.data.validity.ongoing ? ' (Ongoing)' : '')}
        />
      )}
    </div>
  );
}

/**
 * CIFS Format - Shows event formatted as Common Incident Feed Specification
 */
function CIFSFormatView({ event, cifsFormat }) {
  return (
    <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
      {/* Header */}
      <div style={{
        padding: '6px',
        backgroundColor: '#d1fae5',
        borderRadius: '4px',
        marginBottom: '8px',
        borderLeft: '3px solid #10b981'
      }}>
        <div style={{ fontSize: '10px', color: '#10b981', fontWeight: '600', marginBottom: '2px' }}>
          COMMON INCIDENT FEED SPECIFICATION
        </div>
        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#065f46' }}>
          {cifsFormat.data.type}
        </div>
        <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
          Subtype: {cifsFormat.data.subtype}
        </div>
      </div>

      {/* Status Badges */}
      <div style={{ marginBottom: '8px', display: 'flex', gap: '4px' }}>
        <span style={{
          display: 'inline-block',
          padding: '3px 8px',
          borderRadius: '3px',
          backgroundColor: getStatusColor(cifsFormat.data.status),
          color: '#111827',
          fontSize: '10px',
          fontWeight: '700'
        }}>
          {cifsFormat.data.status}
        </span>
        <span style={{
          display: 'inline-block',
          padding: '3px 8px',
          borderRadius: '3px',
          backgroundColor: getCIFSSeverityColor(cifsFormat.data.severity),
          color: '#111827',
          fontSize: '10px',
          fontWeight: '700'
        }}>
          {cifsFormat.data.severity}
        </span>
      </div>

      {/* CIFS Fields - Clean list format */}
      <Field label="Incident ID" value={cifsFormat.data.id} />
      <Field label="Type" value={`${cifsFormat.data.type} - ${cifsFormat.data.subtype}`} />
      <Field label="Severity" value={cifsFormat.data.severity} />
      <Field label="Status" value={cifsFormat.data.status} />
      <Field label="Street" value={cifsFormat.data.location.street} />
      <Field label="State" value={cifsFormat.data.location.state} />
      <Field label="Direction" value={cifsFormat.data.direction} />
      <Field
        label="Coordinates"
        value={`${cifsFormat.data.location.latitude.toFixed(4)}, ${cifsFormat.data.location.longitude.toFixed(4)}`}
      />
      <Field label="Description" value={cifsFormat.data.description} multiline />
      {cifsFormat.data.lanesAffected && (cifsFormat.data.lanesAffected.blocked || cifsFormat.data.lanesAffected.description) && (
        <Field
          label="Lanes Affected"
          value={
            cifsFormat.data.lanesAffected.blocked
              ? `${cifsFormat.data.lanesAffected.blocked} of ${cifsFormat.data.lanesAffected.total} blocked`
              : cifsFormat.data.lanesAffected.description
          }
        />
      )}
      <Field
        label="Reported"
        value={new Date(cifsFormat.data.reportedAt).toLocaleString()}
      />
      <Field label="Source" value={cifsFormat.data.source} />
      <Field label="Verified" value={cifsFormat.data.verified ? 'Yes' : 'No'} />
    </div>
  );
}

/**
 * Field component for consistent display
 */
function Field({ label, value, multiline, compact }) {
  if (!value) return null;

  const marginStyle = compact ? '2px 0' : '4px 0';

  return (
    <div style={{ margin: marginStyle }}>
      <span style={{
        fontSize: '11px',
        color: '#6b7280',
        fontWeight: '500',
        display: multiline ? 'block' : 'inline'
      }}>
        {label}:{multiline ? '' : ' '}
      </span>
      <span style={{
        color: '#374151',
        fontSize: '11px',
        display: multiline ? 'block' : 'inline',
        marginTop: multiline ? '2px' : '0'
      }}>
        {value}
      </span>
    </div>
  );
}

/**
 * Helper functions for colors
 */
function getSeverityColor(severity) {
  const s = (severity || '').toLowerCase();
  if (s.includes('high') || s.includes('major')) return '#ef4444';
  if (s.includes('medium') || s.includes('moderate')) return '#f59e0b';
  return '#10b981';
}

function getStatusColor(status) {
  if (status === 'ACTIVE') return '#10b981';
  if (status === 'CLOSED') return '#6b7280';
  return '#3b82f6';
}

function getCIFSSeverityColor(severity) {
  if (severity === 'MAJOR') return '#ef4444';
  if (severity === 'MODERATE') return '#f59e0b';
  return '#10b981';
}

function getSourceLabel(source) {
  const sourceMap = {
    'osrm': '🛣️ OSRM Routing Engine',
    'interstate': '🏛️ Database Interstate Geometry',
    'interstate_polyline': '🏛️ Database Interstate Geometry',
    'straight': '📏 Straight Line (Fallback)',
    'straight_line': '📏 Straight Line (Fallback)',
    'unknown': '❓ Unknown Source'
  };
  return sourceMap[source] || sourceMap['unknown'];
}

function getSourceDescription(source) {
  const descMap = {
    'osrm': 'High-quality road-snapped geometry from OpenStreetMap routing service. Dense polyline follows actual highway path.',
    'interstate': 'Pre-loaded Interstate corridor geometry from database. May have lower resolution between points.',
    'interstate_polyline': 'Pre-loaded Interstate corridor geometry from database. May have lower resolution between points.',
    'straight': 'Direct line between start and end coordinates. Used when road-snapped geometry unavailable.',
    'straight_line': 'Direct line between start and end coordinates. Used when road-snapped geometry unavailable.',
    'unknown': 'Geometry source not specified by backend.'
  };
  return descMap[source] || descMap['unknown'];
}

function getSourceBackgroundColor(source) {
  const colorMap = {
    'osrm': '#d1fae5',
    'interstate': '#dbeafe',
    'interstate_polyline': '#dbeafe',
    'straight': '#fef3c7',
    'straight_line': '#fef3c7',
    'unknown': '#f3f4f6'
  };
  return colorMap[source] || colorMap['unknown'];
}

function getSourceBorderColor(source) {
  const colorMap = {
    'osrm': '#10b981',
    'interstate': '#3b82f6',
    'interstate_polyline': '#3b82f6',
    'straight': '#f59e0b',
    'straight_line': '#f59e0b',
    'unknown': '#6b7280'
  };
  return colorMap[source] || colorMap['unknown'];
}

/**
 * Geometry Diagnostics View - Shows polyline analysis
 */
function GeometryDiagnosticsView({ diagnostics }) {
  if (!diagnostics || !diagnostics.valid) {
    return (
      <div style={{ padding: '8px', backgroundColor: 'white', borderRadius: '4px', marginBottom: '8px' }}>
        <strong style={{ color: '#dc2626' }}>⚠️ Invalid Geometry</strong>
        <div style={{ fontSize: '13px', marginTop: '4px', color: '#991b1b' }}>
          {diagnostics?.issue || 'Geometry data is malformed or missing'}
        </div>
      </div>
    );
  }

  const hasIssues = diagnostics.issues && diagnostics.issues.length > 0;

  return (
    <div style={{ fontSize: '13px' }}>
      {/* Header */}
      <div style={{
        backgroundColor: hasIssues ? '#fef3c7' : '#d1fae5',
        padding: '8px',
        borderRadius: '4px',
        marginBottom: '10px',
        fontWeight: 'bold',
        color: hasIssues ? '#92400e' : '#065f46'
      }}>
        {hasIssues ? '⚠️ Geometry Quality Issues Detected' : '✅ Geometry Quality: Good'}
      </div>

      {/* Coordinates */}
      <div style={{ marginBottom: '12px' }}>
        <strong>📍 Start Coordinate</strong>
        <div style={{ fontFamily: 'monospace', fontSize: '12px', padding: '4px', backgroundColor: 'white', borderRadius: '3px', marginTop: '4px' }}>
          Lat: {diagnostics.startCoordinate.lat}<br/>
          Lng: {diagnostics.startCoordinate.lng}
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <strong>📍 End Coordinate</strong>
        <div style={{ fontFamily: 'monospace', fontSize: '12px', padding: '4px', backgroundColor: 'white', borderRadius: '3px', marginTop: '4px' }}>
          Lat: {diagnostics.endCoordinate.lat}<br/>
          Lng: {diagnostics.endCoordinate.lng}
        </div>
      </div>

      {/* Metrics */}
      <div style={{ marginBottom: '12px' }}>
        <strong>📊 Metrics</strong>
        <div style={{ marginTop: '4px', paddingLeft: '8px' }}>
          <div style={{ marginBottom: '3px' }}>
            <span style={{ color: '#6b7280' }}>Total Distance:</span>{' '}
            <strong>{diagnostics.totalDistance} miles</strong>
          </div>
          <div style={{ marginBottom: '3px' }}>
            <span style={{ color: '#6b7280' }}>Points:</span>{' '}
            <strong>{diagnostics.pointCount}</strong>
          </div>
          <div>
            <span style={{ color: '#6b7280' }}>Longest Segment:</span>{' '}
            <strong>{diagnostics.longestSegment.distance} mi</strong>
            {' '}(point {diagnostics.longestSegment.from} → {diagnostics.longestSegment.to})
          </div>
        </div>
      </div>

      {/* Source Info */}
      <div style={{ marginBottom: '12px' }}>
        <strong>📡 Geometry Source</strong>
        <div style={{ marginTop: '4px', padding: '6px 8px', backgroundColor: getSourceBackgroundColor(diagnostics.source), borderLeft: `3px solid ${getSourceBorderColor(diagnostics.source)}`, borderRadius: '3px' }}>
          <div style={{ fontWeight: '600', marginBottom: '2px' }}>
            {getSourceLabel(diagnostics.source)}
          </div>
          <div style={{ fontSize: '11px', color: '#374151', marginTop: '4px' }}>
            {getSourceDescription(diagnostics.source)}
          </div>
          {diagnostics.corrected && (
            <div style={{ marginTop: '4px', fontSize: '12px', color: '#1e40af' }}>
              ✨ Client-side corrected (smoothed/simplified)
            </div>
          )}
        </div>
      </div>

      {/* Issues */}
      {hasIssues && (
        <div>
          <strong style={{ color: '#dc2626' }}>⚠️ Issues Found</strong>
          <ul style={{ marginTop: '6px', marginLeft: '16px', marginBottom: '0', paddingLeft: '4px' }}>
            {diagnostics.issues.map((issue, idx) => (
              <li key={idx} style={{ marginBottom: '4px', color: '#991b1b' }}>
                {issue}
              </li>
            ))}
          </ul>
          <div style={{ marginTop: '8px', padding: '6px', backgroundColor: '#fee2e2', borderRadius: '3px', fontSize: '12px', color: '#7f1d1d' }}>
            💡 These issues may indicate incorrect polyline data from the source feed. The route shown may not accurately follow the roadway.
          </div>
        </div>
      )}
    </div>
  );
}
