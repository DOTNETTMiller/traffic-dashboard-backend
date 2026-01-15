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
  borderInfo
}) {
  const [activeTab, setActiveTab] = useState('raw'); // 'raw', 'tim', 'cifs'

  // Generate formatted versions
  const timFormat = formatAsTIM(event);
  const cifsFormat = formatAsCIFS(event);
  const showCVTIM = isCommercialVehicleRelevant(event);

  const tabs = [
    { id: 'raw', label: 'Raw Feed', icon: '📋' },
    { id: 'tim', label: 'SAE J2735', icon: '📡' },
    { id: 'cifs', label: 'CIFS', icon: '🚨' }
  ];

  return (
    <div style={{ padding: '0', minWidth: '320px', maxWidth: '420px' }}>
      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #e5e7eb',
        marginBottom: '8px',
        backgroundColor: '#f9fafb'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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

      {/* Tab Content */}
      <div style={{ padding: '8px 12px' }}>
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
      </div>

      {/* Nearby ITS Equipment (shown in all tabs) */}
      <div style={{ padding: '0 12px 8px 12px' }}>
        <NearbyITSEquipment event={event} />
      </div>

      {/* Action Buttons */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        gap: '8px',
        backgroundColor: '#f9fafb'
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
            color: 'white',
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
        padding: '8px',
        backgroundColor: '#f3f4f6',
        borderRadius: '4px',
        marginBottom: '10px',
        borderLeft: '3px solid #6b7280'
      }}>
        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600', marginBottom: '2px' }}>
          RAW FEED DATA
        </div>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#111827' }}>
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
            color: 'white',
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
          margin: '10px 0',
          padding: '8px',
          backgroundColor: '#e0e7ff',
          borderRadius: '4px',
          borderLeft: '3px solid #6366f1',
          fontSize: '11px'
        }}>
          <strong>🔵 Border Event</strong><br/>
          {borderInfo.distance} miles from {borderInfo.borderName}<br/>
          <span style={{ fontSize: '10px', fontStyle: 'italic', color: '#4338ca' }}>
            Requires {borderInfo.borderStates.join('-')} coordination
          </span>
        </div>
      )}

      {showCVTIM && (
        <div style={{
          margin: '10px 0',
          padding: '6px 8px',
          backgroundColor: '#fef3c7',
          borderRadius: '4px',
          fontSize: '11px',
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
        padding: '8px',
        backgroundColor: '#eff6ff',
        borderRadius: '4px',
        marginBottom: '10px',
        borderLeft: '3px solid #3b82f6'
      }}>
        <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: '600', marginBottom: '2px' }}>
          SAE J2735 TRAVELER INFORMATION MESSAGE
        </div>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e40af' }}>
          {timFormat.data.msgType}
        </div>
        <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
          {timFormat.data.msgCode} • ITIS Code: {timFormat.data.msgCode.split('-')[1] ?
            parseInt(timFormat.data.msgCode.split('-')[1]) * 256 + 1 :
            timFormat.data.itis || 'N/A'}
        </div>
      </div>

      {showCVTIM && (
        <div style={{
          padding: '6px 8px',
          backgroundColor: '#f3e8ff',
          borderRadius: '4px',
          marginBottom: '10px',
          fontSize: '11px',
          color: '#7c3aed',
          fontWeight: '600',
          borderLeft: '3px solid #a855f7'
        }}>
          🚛 SAE J2540 CV-TIM: Commercial Vehicle Advisory
        </div>
      )}

      {/* TIM Fields */}
      <Field label="Message ID" value={timFormat.data.msgID} />
      <Field label="Message Type" value={timFormat.data.msgType} />
      <Field
        label="Priority"
        value={`${timFormat.data.priority} (${timFormat.data.severity})`}
      />

      <div style={{
        margin: '10px 0',
        padding: '8px',
        backgroundColor: '#f9fafb',
        borderRadius: '4px',
        borderLeft: '2px solid #3b82f6'
      }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
          Route Information
        </div>
        <Field label="Road Name" value={timFormat.data.route.roadName} compact />
        <Field label="Direction" value={timFormat.data.route.direction} compact />
      </div>

      <div style={{
        margin: '10px 0',
        padding: '8px',
        backgroundColor: '#f9fafb',
        borderRadius: '4px',
        borderLeft: '2px solid #3b82f6'
      }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
          Location
        </div>
        <Field label="Description" value={timFormat.data.location.description} compact />
        <Field
          label="Coordinates"
          value={`${parseFloat(timFormat.data.location.latitude).toFixed(4)}, ${parseFloat(timFormat.data.location.longitude).toFixed(4)}`}
          compact
        />
      </div>

      <div style={{
        margin: '10px 0',
        padding: '8px',
        backgroundColor: '#f9fafb',
        borderRadius: '4px',
        borderLeft: '2px solid #3b82f6'
      }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
          Content
        </div>
        <Field label="Headline" value={timFormat.data.content.headline} compact />
        <Field label="Description" value={timFormat.data.content.description} compact multiline />
        <Field label="Lanes Affected" value={timFormat.data.content.lanesAffected} compact />
      </div>

      {timFormat.data.validity.startTime && (
        <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '8px' }}>
          <strong>Valid From:</strong> {new Date(timFormat.data.validity.startTime).toLocaleString()}
          {timFormat.data.validity.ongoing && ' (Ongoing)'}
        </div>
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
        padding: '8px',
        backgroundColor: '#d1fae5',
        borderRadius: '4px',
        marginBottom: '10px',
        borderLeft: '3px solid #10b981'
      }}>
        <div style={{ fontSize: '11px', color: '#10b981', fontWeight: '600', marginBottom: '2px' }}>
          COMMON INCIDENT FEED SPECIFICATION
        </div>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#065f46' }}>
          {cifsFormat.data.type}
        </div>
        <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
          Subtype: {cifsFormat.data.subtype}
        </div>
      </div>

      {/* Status Badges */}
      <div style={{ marginBottom: '10px', display: 'flex', gap: '6px' }}>
        <span style={{
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: '4px',
          backgroundColor: getStatusColor(cifsFormat.data.status),
          color: 'white',
          fontSize: '11px',
          fontWeight: '700'
        }}>
          {cifsFormat.data.status}
        </span>
        <span style={{
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: '4px',
          backgroundColor: getCIFSSeverityColor(cifsFormat.data.severity),
          color: 'white',
          fontSize: '11px',
          fontWeight: '700'
        }}>
          {cifsFormat.data.severity}
        </span>
      </div>

      {/* CIFS Fields */}
      <Field label="Incident ID" value={cifsFormat.data.id} />
      <Field label="Type" value={`${cifsFormat.data.type} - ${cifsFormat.data.subtype}`} />
      <Field label="Severity" value={cifsFormat.data.severity} />
      <Field label="Status" value={cifsFormat.data.status} />

      <div style={{
        margin: '10px 0',
        padding: '8px',
        backgroundColor: '#f9fafb',
        borderRadius: '4px',
        borderLeft: '2px solid #10b981'
      }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
          Location Information
        </div>
        <Field label="Street" value={cifsFormat.data.location.street} compact />
        <Field label="State" value={cifsFormat.data.location.state} compact />
        <Field label="Direction" value={cifsFormat.data.direction} compact />
        <Field
          label="Coordinates"
          value={`${cifsFormat.data.location.latitude.toFixed(4)}, ${cifsFormat.data.location.longitude.toFixed(4)}`}
          compact
        />
      </div>

      <div style={{
        margin: '10px 0',
        padding: '8px',
        backgroundColor: '#f9fafb',
        borderRadius: '4px',
        borderLeft: '2px solid #10b981'
      }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
          Incident Details
        </div>
        <Field label="Description" value={cifsFormat.data.description} compact multiline />
        {cifsFormat.data.lanesAffected && (cifsFormat.data.lanesAffected.blocked || cifsFormat.data.lanesAffected.description) && (
          <Field
            label="Lanes Affected"
            value={
              cifsFormat.data.lanesAffected.blocked
                ? `${cifsFormat.data.lanesAffected.blocked} of ${cifsFormat.data.lanesAffected.total} blocked`
                : cifsFormat.data.lanesAffected.description
            }
            compact
          />
        )}
      </div>

      {/* Metadata */}
      <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '8px' }}>
        <div><strong>Reported:</strong> {new Date(cifsFormat.data.reportedAt).toLocaleString()}</div>
        <div><strong>Source:</strong> {cifsFormat.data.source}</div>
        <div><strong>Verified:</strong> {cifsFormat.data.verified ? 'Yes' : 'No'}</div>
      </div>
    </div>
  );
}

/**
 * Field component for consistent display
 */
function Field({ label, value, multiline, compact }) {
  if (!value) return null;

  const marginStyle = compact ? '3px 0' : '6px 0';

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
