import { useState } from 'react';
import { formatAsTIM, formatAsCIFS, isCommercialVehicleRelevant } from '../utils/messageFormatters';
import NearbyITSEquipment from './NearbyITSEquipment';

/**
 * Enhanced Event Popup with Multiple Format Views
 *
 * Shows the same event data in different standardized formats:
 * - Raw: Original feed data
 * - TIM: SAE J2735 Traveler Information Message
 * - CIFS: Common Incident Feed Specification
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
    { id: 'raw', label: 'Raw Data', icon: '📋' },
    { id: 'tim', label: 'SAE TIM', icon: '📡' },
    { id: 'cifs', label: 'CIFS', icon: '🚨' }
  ];

  return (
    <div style={{ padding: '0', minWidth: '300px', maxWidth: '400px' }}>
      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #e5e7eb',
        marginBottom: '12px'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              backgroundColor: activeTab === tab.id ? '#eff6ff' : 'transparent',
              borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: '-2px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: activeTab === tab.id ? '600' : '400',
              color: activeTab === tab.id ? '#3b82f6' : '#6b7280',
              transition: 'all 0.2s'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ padding: '0 8px 8px 8px' }}>
        {activeTab === 'raw' && <RawDataView event={event} borderInfo={borderInfo} />}
        {activeTab === 'tim' && <TIMView data={timFormat} showCVTIM={showCVTIM} />}
        {activeTab === 'cifs' && <CIFSView data={cifsFormat} />}
      </div>

      {/* Nearby ITS Equipment (shown in all tabs) */}
      <div style={{ padding: '0 8px 8px 8px' }}>
        <NearbyITSEquipment event={event} />
      </div>

      {/* Action Buttons */}
      <div style={{
        padding: '8px',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        gap: '8px'
      }}>
        {hasMessages && (
          <div style={{
            flex: 1,
            padding: '6px',
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
            padding: '6px 12px',
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
 * Raw Data View - Original feed data
 */
function RawDataView({ event, borderInfo }) {
  return (
    <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
      <h3 style={{
        margin: '0 0 8px 0',
        fontSize: '15px',
        fontWeight: 'bold',
        color: '#111827'
      }}>
        {event.eventType}
      </h3>

      <InfoRow label="Location" value={event.location} />
      <InfoRow label="State" value={event.state} />
      <InfoRow label="Description" value={event.description} />

      {borderInfo && borderInfo.nearBorder && (
        <div style={{
          margin: '8px 0',
          padding: '6px',
          backgroundColor: '#e0e7ff',
          borderRadius: '4px',
          borderLeft: '3px solid #6366f1',
          fontSize: '11px'
        }}>
          <strong>🔵 Border Event</strong><br/>
          <span style={{ fontSize: '11px' }}>
            {borderInfo.distance} miles from {borderInfo.borderName}
          </span>
          <br/>
          <span style={{ fontSize: '10px', fontStyle: 'italic', color: '#4338ca' }}>
            May require {borderInfo.borderStates.join('-')} coordination
          </span>
        </div>
      )}

      <InfoRow label="Lanes" value={event.lanesAffected} />
      <InfoRow label="Direction" value={event.direction} />

      {event.severity && (
        <InfoRow
          label="Severity"
          value={event.severity}
          style={{
            display: 'inline-block',
            padding: '2px 6px',
            borderRadius: '3px',
            backgroundColor: getSeverityColor(event.severity),
            color: 'white',
            fontSize: '10px',
            fontWeight: '600'
          }}
        />
      )}

      {event.startTime && (
        <InfoRow
          label="Start"
          value={new Date(event.startTime).toLocaleString()}
        />
      )}
    </div>
  );
}

/**
 * SAE J2735 TIM View
 */
function TIMView({ data, showCVTIM }) {
  return (
    <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
        padding: '8px',
        backgroundColor: '#eff6ff',
        borderRadius: '4px',
        borderLeft: `3px solid ${data.color}`
      }}>
        <span style={{ fontSize: '20px' }}>{data.icon}</span>
        <div>
          <div style={{ fontWeight: 'bold', color: data.color }}>
            {data.standard}
          </div>
          <div style={{ fontSize: '10px', color: '#6b7280' }}>
            {data.data.msgCode} • Priority {data.data.priority}
          </div>
        </div>
      </div>

      {showCVTIM && (
        <div style={{
          padding: '6px',
          backgroundColor: '#f3e8ff',
          borderRadius: '4px',
          marginBottom: '8px',
          fontSize: '11px',
          color: '#7c3aed',
          fontWeight: '600'
        }}>
          🚛 CV-TIM: Commercial Vehicle Relevant
        </div>
      )}

      {/* TIM Data */}
      <InfoRow label="Message Type" value={data.data.msgType} />
      <InfoRow label="ITIS Code" value={data.data.msgCode} />
      <InfoRow
        label="Priority"
        value={`${data.data.priority} (${data.data.severity})`}
      />

      <div style={{
        margin: '8px 0',
        padding: '8px',
        backgroundColor: '#f9fafb',
        borderRadius: '4px',
        borderLeft: '3px solid #3b82f6'
      }}>
        <div style={{ fontWeight: '600', marginBottom: '4px', color: '#374151' }}>
          📍 Location
        </div>
        <div style={{ fontSize: '11px', color: '#6b7280' }}>
          {data.data.route.roadName} {data.data.route.direction}<br/>
          {data.data.location.description}
        </div>
      </div>

      <div style={{
        margin: '8px 0',
        padding: '8px',
        backgroundColor: '#f9fafb',
        borderRadius: '4px'
      }}>
        <div style={{ fontWeight: '600', marginBottom: '4px', color: '#374151' }}>
          📝 Message Content
        </div>
        <div style={{ fontSize: '11px', color: '#6b7280' }}>
          {data.data.content.headline}<br/>
          {data.data.content.description}
        </div>
        <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
          Lanes: {data.data.content.lanesAffected}
        </div>
      </div>

      {/* Validity Period */}
      {data.data.validity.startTime && (
        <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '8px' }}>
          <strong>Valid:</strong> {new Date(data.data.validity.startTime).toLocaleString()}
          {data.data.validity.ongoing && ' (Ongoing)'}
        </div>
      )}
    </div>
  );
}

/**
 * CIFS View
 */
function CIFSView({ data }) {
  return (
    <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
        padding: '8px',
        backgroundColor: '#d1fae5',
        borderRadius: '4px',
        borderLeft: `3px solid ${data.color}`
      }}>
        <span style={{ fontSize: '20px' }}>{data.icon}</span>
        <div>
          <div style={{ fontWeight: 'bold', color: data.color }}>
            {data.standard}
          </div>
          <div style={{ fontSize: '10px', color: '#6b7280' }}>
            {data.data.type} - {data.data.subtype}
          </div>
        </div>
      </div>

      {/* Status Badge */}
      <div style={{ marginBottom: '8px' }}>
        <span style={{
          display: 'inline-block',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: getStatusColor(data.data.status),
          color: 'white',
          fontSize: '11px',
          fontWeight: '600',
          marginRight: '6px'
        }}>
          {data.data.status}
        </span>
        <span style={{
          display: 'inline-block',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: getCIFSSeverityColor(data.data.severity),
          color: 'white',
          fontSize: '11px',
          fontWeight: '600'
        }}>
          {data.data.severity}
        </span>
      </div>

      {/* Incident Info */}
      <InfoRow label="Incident Type" value={`${data.data.type} - ${data.data.subtype}`} />
      <InfoRow
        label="Location"
        value={`${data.data.location.street}, ${data.data.location.state}`}
      />
      <InfoRow label="Direction" value={data.data.direction} />

      <div style={{
        margin: '8px 0',
        padding: '8px',
        backgroundColor: '#f9fafb',
        borderRadius: '4px'
      }}>
        <div style={{ fontWeight: '600', marginBottom: '4px', color: '#374151' }}>
          📋 Description
        </div>
        <div style={{ fontSize: '11px', color: '#6b7280' }}>
          {data.data.description}
        </div>
      </div>

      {data.data.lanesAffected && (data.data.lanesAffected.blocked || data.data.lanesAffected.description) && (
        <InfoRow
          label="Lanes Affected"
          value={
            data.data.lanesAffected.blocked
              ? `${data.data.lanesAffected.blocked} of ${data.data.lanesAffected.total} blocked`
              : data.data.lanesAffected.description
          }
        />
      )}

      {/* Timing */}
      <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '8px' }}>
        <div><strong>Reported:</strong> {new Date(data.data.reportedAt).toLocaleString()}</div>
        <div><strong>Source:</strong> {data.data.source}</div>
      </div>
    </div>
  );
}

/**
 * Helper component for info rows
 */
function InfoRow({ label, value, style }) {
  if (!value) return null;

  return (
    <div style={{ margin: '4px 0' }}>
      <strong style={{ color: '#6b7280', fontSize: '11px' }}>{label}:</strong>{' '}
      <span style={style || { color: '#374151' }}>{value}</span>
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
