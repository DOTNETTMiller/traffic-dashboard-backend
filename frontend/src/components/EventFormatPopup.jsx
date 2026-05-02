import { useState } from 'react';
import { createPortal } from 'react-dom';
import { formatAsTIM, formatAsCIFS, isCommercialVehicleRelevant } from '../utils/messageFormatters';
import NearbyITSEquipment from './NearbyITSEquipment';
import IPAWSAlertGenerator from './IPAWSAlertGenerator';
import ComplianceGrades from './ComplianceGrades';

/**
 * Safe date formatter that handles invalid dates gracefully
 */
function safeFormatDate(dateValue) {
  if (!dateValue) return null;
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleString();
  } catch (e) {
    return null;
  }
}

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
  geometryDiagnostics,
  onGeofenceUpdate
}) {
  const [activeTab, setActiveTab] = useState('raw'); // 'raw', 'tim', 'cifs', 'geometry'
  const [showIPAWS, setShowIPAWS] = useState(false);

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
    <div style={{
      padding: 0,
      width: 320,
      maxWidth: '92vw',
      maxHeight: '72vh',
      background: '#ffffff',
      display: showIPAWS ? 'none' : 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter Tight', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#1d1d1f',
      letterSpacing: '-0.005em'
    }}>
      {/* Compliance grades — visible across all tabs */}
      <div style={{
        padding: '10px 12px',
        background: '#f5f5f7',
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
        flexShrink: 0
      }}>
        <ComplianceGrades eventId={event.id} compact />
      </div>

      {/* Tab Navigation — quiet underline indicator */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
        background: '#ffffff',
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
              padding: '10px 6px 9px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === tab.id ? '2px solid #0071e3' : '2px solid transparent',
              marginBottom: '-1px',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: activeTab === tab.id ? 600 : 500,
              color: activeTab === tab.id ? '#1d1d1f' : '#6e6e73',
              fontFamily: 'inherit',
              letterSpacing: '-0.005em',
              transition: 'color 180ms cubic-bezier(0.32, 0.72, 0, 1), border-color 180ms cubic-bezier(0.32, 0.72, 0, 1)',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: 14, marginBottom: 2, opacity: activeTab === tab.id ? 1 : 0.7 }}>{tab.icon}</div>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content - Scrollable */}
      <div style={{ padding: '10px 14px', background: '#ffffff', overflowY: 'auto', flex: 1 }}>
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
        padding: '12px 14px',
        borderTop: '1px solid rgba(0, 0, 0, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: '#ffffff'
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {hasMessages && (
            <div style={{
              flex: 1,
              padding: '6px 10px',
              background: 'rgba(0, 113, 227, 0.10)',
              border: '1px solid rgba(0, 113, 227, 0.20)',
              borderRadius: 999,
              fontSize: 11,
              textAlign: 'center',
              fontWeight: 600,
              color: '#0a4a8f',
              fontVariantNumeric: 'tabular-nums'
            }}>
              💬 {messageCount} Message{messageCount !== 1 ? 's' : ''}
            </div>
          )}
          <button
            onClick={() => onEventSelect && onEventSelect(event)}
            style={{
              flex: hasMessages ? 1 : 2,
              padding: '8px 16px',
              background: '#0071e3',
              color: '#ffffff',
              border: 'none',
              borderRadius: 999,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
              transition: 'background-color 200ms cubic-bezier(0.32, 0.72, 0, 1)'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#0077ed'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#0071e3'; }}
          >
            {hasMessages ? 'View Messages' : 'Add Message'}
          </button>
        </div>

        {/* IPAWS Alert Button — calmer amber, pill, no gradient */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowIPAWS(true);
          }}
          style={{
            width: '100%',
            padding: '8px 16px',
            background: 'rgba(201, 122, 22, 0.10)',
            color: '#7a4d12',
            border: '1px solid rgba(201, 122, 22, 0.32)',
            borderRadius: 999,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'inherit',
            letterSpacing: '-0.005em',
            transition: 'background-color 200ms cubic-bezier(0.32, 0.72, 0, 1), border-color 200ms cubic-bezier(0.32, 0.72, 0, 1)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(201, 122, 22, 0.16)';
            e.currentTarget.style.borderColor = 'rgba(201, 122, 22, 0.44)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(201, 122, 22, 0.10)';
            e.currentTarget.style.borderColor = 'rgba(201, 122, 22, 0.32)';
          }}
        >
          🚨 Generate IPAWS Alert
        </button>
      </div>

      {/* IPAWS Alert Generator Modal - Rendered via portal to escape Leaflet popup stacking context */}
      {showIPAWS && createPortal(
        <IPAWSAlertGenerator
          event={event}
          onClose={() => setShowIPAWS(false)}
          onGeofenceUpdate={onGeofenceUpdate}
        />,
        document.body
      )}
    </div>
  );
}

/**
 * Raw Feed Format - Shows data as received from DOT feed
 */
function RawFormatView({ event, borderInfo, showCVTIM }) {
  return (
    <div style={{ fontSize: 12, lineHeight: 1.5, color: '#1d1d1f' }}>
      {/* Header */}
      <div style={{ marginBottom: 10 }}>
        <div style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#6e6e73',
          marginBottom: 2
        }}>
          Raw Feed Data
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: '#1d1d1f' }}>
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
        <div style={{ margin: '8px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#6e6e73', fontWeight: 500 }}>Severity</span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 9px',
            borderRadius: 999,
            background: getSeverityBg(event.severity),
            color: getSeverityFg(event.severity),
            border: `1px solid ${getSeverityBorder(event.severity)}`,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase'
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: getSeverityFg(event.severity)
            }} />
            {event.severity}
          </span>
        </div>
      )}

      {event.startTime && safeFormatDate(event.startTime) && (
        <Field
          label="Start Time"
          value={safeFormatDate(event.startTime)}
        />
      )}

      {borderInfo && borderInfo.nearBorder && (
        <div style={{
          margin: '10px 0',
          padding: '8px 10px',
          background: 'rgba(0, 113, 227, 0.06)',
          border: '1px solid rgba(0, 113, 227, 0.16)',
          borderRadius: 8,
          fontSize: 11
        }}>
          <strong style={{ color: '#0a4a8f' }}>🔵 Border Event</strong>{' '}
          <span style={{ fontVariantNumeric: 'tabular-nums', color: '#1d1d1f' }}>
            {borderInfo.distance} mi from {borderInfo.borderName}
          </span>
          <div style={{ fontSize: 10, color: '#0a4a8f', marginTop: 2 }}>
            Requires {borderInfo.borderStates.join('–')} coordination
          </div>
        </div>
      )}

      {showCVTIM && (
        <div style={{
          margin: '8px 0',
          padding: '6px 10px',
          background: 'rgba(201, 122, 22, 0.10)',
          border: '1px solid rgba(201, 122, 22, 0.28)',
          borderRadius: 999,
          fontSize: 10,
          color: '#7a4d12',
          fontWeight: 600,
          display: 'inline-block'
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

      {timFormat.data.validity.startTime && safeFormatDate(timFormat.data.validity.startTime) && (
        <Field
          label="Valid From"
          value={safeFormatDate(timFormat.data.validity.startTime) + (timFormat.data.validity.ongoing ? ' (Ongoing)' : '')}
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
      {safeFormatDate(cifsFormat.data.reportedAt) && (
        <Field
          label="Reported"
          value={safeFormatDate(cifsFormat.data.reportedAt)}
        />
      )}
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

  const marginStyle = compact ? '2px 0' : '5px 0';

  return (
    <div style={{ margin: marginStyle }}>
      <span style={{
        fontSize: 11,
        color: '#6e6e73',
        fontWeight: 500,
        display: multiline ? 'block' : 'inline'
      }}>
        {label}{multiline ? '' : ': '}
      </span>
      <span style={{
        color: '#1d1d1f',
        fontSize: 12,
        display: multiline ? 'block' : 'inline',
        marginTop: multiline ? 2 : 0,
        fontVariantNumeric: 'tabular-nums'
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
  if (s.includes('high') || s.includes('major')) return '#d83a3a';
  if (s.includes('medium') || s.includes('moderate')) return '#c97a16';
  return '#8e8e93';
}

// Calmer severity-pill palette: tinted background + matching foreground +
// matching border. Same desaturated tones used by the rest of the new chrome.
function getSeverityBg(severity) {
  const s = (severity || '').toLowerCase();
  if (s.includes('high') || s.includes('major')) return 'rgba(216, 58, 58, 0.10)';
  if (s.includes('medium') || s.includes('moderate')) return 'rgba(201, 122, 22, 0.10)';
  return 'rgba(142, 142, 147, 0.12)';
}
function getSeverityFg(severity) {
  const s = (severity || '').toLowerCase();
  if (s.includes('high') || s.includes('major')) return '#902929';
  if (s.includes('medium') || s.includes('moderate')) return '#7a4d12';
  return '#48484a';
}
function getSeverityBorder(severity) {
  const s = (severity || '').toLowerCase();
  if (s.includes('high') || s.includes('major')) return 'rgba(216, 58, 58, 0.32)';
  if (s.includes('medium') || s.includes('moderate')) return 'rgba(201, 122, 22, 0.32)';
  return 'rgba(142, 142, 147, 0.28)';
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

function isCorrectedGeometry(source) {
  return source === 'osrm' ||
         source === 'state_dot_wfs' ||
         source === 'interstate' ||
         source === 'interstate_polyline' ||
         source === 'feed_polyline' ||
         source === 'FHWA ARNOLD' ||
         source === 'Iowa DOT All Routes';
}

function getSourceLabel(source) {
  if (isCorrectedGeometry(source)) {
    return '✅ Corrected Geometry';
  }
  // straight_line, straight, or unknown
  return '📍 Original Feed Geometry';
}

function getCorrectionSource(source) {
  const sourceMap = {
    'osrm': 'OpenStreetMap Routing (OSRM)',
    'state_dot_wfs': 'State DOT Official GIS Service',
    'interstate_polyline': 'Database Interstate Polyline',
    'interstate': 'Database Interstate Polyline',
    'feed_polyline': 'Feed-Provided Polyline Geometry',
    'FHWA ARNOLD': 'FHWA ARNOLD National Road Network Database',
    'Iowa DOT All Routes': 'Iowa DOT Official Route GIS Service'
  };
  return sourceMap[source] || 'Unknown';
}

function getSourceDescription(source, feedUrl) {
  if (isCorrectedGeometry(source)) {
    const correctionSource = getCorrectionSource(source);
    return `Geometry has been enhanced with road-snapped coordinates from ${correctionSource}. This provides accurate highway alignment instead of a straight line between endpoints.`;
  }
  // Original feed geometry
  return `Direct line between start and end coordinates from the original feed. No geometry correction applied.${feedUrl ? ` Source: ${feedUrl}` : ''}`;
}

function getSourceBackgroundColor(source) {
  if (isCorrectedGeometry(source)) {
    return '#d1fae5'; // Green for corrected
  }
  return '#fef3c7'; // Yellow for original
}

function getSourceBorderColor(source) {
  if (isCorrectedGeometry(source)) {
    return '#10b981'; // Green border for corrected
  }
  return '#f59e0b'; // Orange border for original
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
          {isCorrectedGeometry(diagnostics.source) && (
            <div style={{ fontSize: '12px', color: '#065f46', marginTop: '2px', marginBottom: '4px' }}>
              Source: {getCorrectionSource(diagnostics.source)}
            </div>
          )}
          <div style={{ fontSize: '11px', color: '#374151', marginTop: '4px' }}>
            {getSourceDescription(diagnostics.source, diagnostics.feedUrl)}
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
