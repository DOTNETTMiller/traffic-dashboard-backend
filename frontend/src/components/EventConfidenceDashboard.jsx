import { useState, useEffect } from 'react';
import api from '../services/api';

const EventConfidenceDashboard = () => {
  const [events, setEvents] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    fetchConfidenceData();
  }, []);

  const fetchConfidenceData = async () => {
    try {
      setLoading(true);
      const [eventsResp, vendorsResp] = await Promise.all([
        api.get('/confidence/events'),
        api.get('/confidence/vendor-reliability')
      ]);

      if (eventsResp.data.success) setEvents(eventsResp.data.events);
      if (vendorsResp.data.success) setVendors(vendorsResp.data.vendors);
    } catch (err) {
      console.error('Error fetching confidence data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (level) => {
    const colors = {
      'VERIFIED': '#10b981',
      'HIGH': '#3b82f6',
      'MEDIUM': '#f59e0b',
      'LOW': '#ef4444',
      'UNVERIFIED': '#6b7280'
    };
    return colors[level] || '#6b7280';
  };

  const getConfidenceBadge = (level) => {
    const badges = {
      'VERIFIED': '✓ Verified',
      'HIGH': '↑ High',
      'MEDIUM': '− Medium',
      'LOW': '↓ Low',
      'UNVERIFIED': '? Unverified'
    };
    return badges[level] || level;
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', fontSize: '16px', color: '#6b7280' }}>
      Loading confidence data...
    </div>;
  }

  if (error) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
      Error: {error}
    </div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '32px', fontWeight: 'bold', color: '#111827' }}>
          Event Confidence Scoring
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
          Phase 1.2: Real-time event verification and vendor reliability tracking
        </p>
      </div>

      {/* Vendor Reliability Section */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
          Vendor Reliability Scores
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {vendors.map((vendor, idx) => (
            <div
              key={idx}
              style={{
                background: 'white',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                padding: '20px',
                transition: 'box-shadow 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>
                    {vendor.vendor_name}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                    {vendor.data_type}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: vendor.reliability_score >= 90 ? '#10b981' : vendor.reliability_score >= 80 ? '#3b82f6' : '#f59e0b' }}>
                    {vendor.reliability_score}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>Reliability</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Accuracy Rate</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>
                    {(vendor.accuracy_rate * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>False Positive Rate</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: vendor.false_positive_rate < 0.1 ? '#10b981' : '#ef4444' }}>
                    {(vendor.false_positive_rate * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              <div style={{ paddingTop: '12px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280' }}>
                <span>{vendor.total_events} events</span>
                <span>{vendor.verified_correct} verified correct</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Events Confidence Section */}
      <div>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
          Active Events with Confidence Scores
        </h2>
        <div style={{ display: 'grid', gap: '16px' }}>
          {events.map((event, idx) => (
            <div
              key={idx}
              style={{
                background: 'white',
                border: `2px solid ${getConfidenceColor(event.confidence_level)}`,
                borderRadius: '12px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s'
              }}
              onClick={() => setSelectedEvent(event)}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
                    {event.description}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#6b7280' }}>
                    <span>{event.corridor_id}</span>
                    <span>•</span>
                    <span>{event.event_type}</span>
                    <span>•</span>
                    <span>{event.event_id}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', marginLeft: '20px' }}>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: getConfidenceColor(event.confidence_level), marginBottom: '4px' }}>
                    {event.confidence_score}
                  </div>
                  <div
                    style={{
                      padding: '4px 12px',
                      background: getConfidenceColor(event.confidence_level),
                      color: 'white',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {getConfidenceBadge(event.confidence_level)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Primary Source</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                    {event.primary_source}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Verification</div>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                    {event.cctv_verified && <span style={{ padding: '2px 8px', background: '#dcfce7', color: '#166534', borderRadius: '4px', fontWeight: '600' }}>CCTV</span>}
                    {event.sensor_verified && <span style={{ padding: '2px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: '4px', fontWeight: '600' }}>Sensor</span>}
                    {event.crowdsource_verified && <span style={{ padding: '2px 8px', background: '#fef3c7', color: '#92400e', borderRadius: '4px', fontWeight: '600' }}>Crowd</span>}
                    {event.multi_source_confirmed && <span style={{ padding: '2px 8px', background: '#f3e8ff', color: '#6b21a8', borderRadius: '4px', fontWeight: '600' }}>Multi-Source</span>}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>False Positive Risk</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: event.false_positive_probability > 0.2 ? '#ef4444' : '#10b981' }}>
                    {(event.false_positive_probability * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {event.verification_sources && event.verification_sources.length > 0 && (
                <div style={{ fontSize: '12px', color: '#6b7280', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                  <strong>Verification Sources:</strong> {event.verification_sources.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setSelectedEvent(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 20px 0', fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
              Event Confidence Details
            </h2>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
                {selectedEvent.description}
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                {selectedEvent.corridor_id} • {selectedEvent.event_type}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Confidence Score</div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: getConfidenceColor(selectedEvent.confidence_level) }}>
                  {selectedEvent.confidence_score}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Confidence Level</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: getConfidenceColor(selectedEvent.confidence_level) }}>
                  {selectedEvent.confidence_level}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
                Verification Status
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#f9fafb', borderRadius: '6px' }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>CCTV Verified</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: selectedEvent.cctv_verified ? '#10b981' : '#6b7280' }}>
                    {selectedEvent.cctv_verified ? 'Yes' : 'No'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#f9fafb', borderRadius: '6px' }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>Sensor Verified</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: selectedEvent.sensor_verified ? '#10b981' : '#6b7280' }}>
                    {selectedEvent.sensor_verified ? 'Yes' : 'No'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#f9fafb', borderRadius: '6px' }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>Multi-Source Confirmed</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: selectedEvent.multi_source_confirmed ? '#10b981' : '#6b7280' }}>
                    {selectedEvent.multi_source_confirmed ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedEvent(null)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: '32px',
        padding: '20px',
        background: '#f9fafb',
        borderRadius: '8px',
        textAlign: 'center',
        fontSize: '13px',
        color: '#6b7280'
      }}>
        <p style={{ margin: 0 }}>
          <strong>Phase 1.2 MVP:</strong> Event confidence scoring with multi-source verification tracking.
        </p>
        <p style={{ margin: '8px 0 0 0' }}>
          ML-powered false positive detection ready for deployment with historical data.
        </p>
      </div>
    </div>
  );
};

export default EventConfidenceDashboard;
