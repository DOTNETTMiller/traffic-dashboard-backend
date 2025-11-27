/**
 * Feature #4: Cryptographic Data Provenance Chain
 */
import { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from '../config';

function ProvenanceViewer({ events, authToken }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [provenance, setProvenance] = useState(null);
  const [chainStats, setChainStats] = useState(null);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // OPTIMIZED: Lazy load stats only when user interacts, not on mount
  // This prevents unnecessary API calls when panel first opens

  const loadChainStats = async () => {
    try {
      const response = await axios.get(
        `${config.API_URL}/api/provenance/stats`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      setChainStats(response.data);
    } catch (error) {
      console.error('Failed to load chain stats:', error);
    }
  };

  const viewProvenance = async (eventId) => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${config.API_URL}/api/provenance/${eventId}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      setProvenance(response.data);
      setSelectedEvent(eventId);
    } catch (error) {
      console.error('Failed to load provenance:', error);
    } finally {
      setLoading(false);
    }
  };

  const verifyChain = async () => {
    setVerifying(true);
    try {
      const response = await axios.get(
        `${config.API_URL}/api/provenance/verify/chain`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      setVerification(response.data);
    } catch (error) {
      console.error('Chain verification failed:', error);
    } finally {
      setVerifying(false);
    }
  };

  const exportProof = async (eventId) => {
    try {
      const response = await axios.get(
        `${config.API_URL}/api/provenance/export/${eventId}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      // Download as JSON file
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `provenance-${eventId}.json`;
      a.click();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="provenance-viewer">
      <div className="feature-header">
        <h3>Cryptographic Data Provenance Chain</h3>
        <span className="feature-badge">Feature #4</span>
      </div>

      <div className="feature-description">
        <p>
          Blockchain-lite hash chain provides immutable audit trail with tamper detection.
          Supports legal/regulatory compliance (accident investigations, liability claims).
        </p>
      </div>

      {/* Load Stats Button */}
      {!chainStats && (
        <div className="load-stats-prompt">
          <button onClick={loadChainStats} className="load-stats-button">
            📊 Load Chain Statistics
          </button>
        </div>
      )}

      {/* Chain Statistics */}
      {chainStats && (
        <div className="chain-stats">
          <h4>Provenance Chain Status</h4>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{chainStats.total_records}</div>
              <div className="stat-label">Total Records</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{chainStats.operations?.INGESTION || 0}</div>
              <div className="stat-label">Ingestions</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{chainStats.operations?.TRANSFORMATION || 0}</div>
              <div className="stat-label">Transformations</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{chainStats.operations?.DELIVERY || 0}</div>
              <div className="stat-label">Deliveries</div>
            </div>
          </div>

          <div className="chain-validity">
            <span className={`validity-badge ${chainStats.chain_valid ? 'valid' : 'invalid'}`}>
              {chainStats.chain_valid ? '✓ Chain Valid' : '⚠️ Chain Issues'}
            </span>
            <button onClick={verifyChain} disabled={verifying} className="verify-button">
              {verifying ? 'Verifying...' : 'Verify Chain Integrity'}
            </button>
          </div>
        </div>
      )}

      {/* Chain Verification Results */}
      {verification && (
        <div className={`verification-results ${verification.valid ? 'valid' : 'invalid'}`}>
          <h5>{verification.valid ? '✓ Chain Verification Passed' : '⚠️ Chain Verification Failed'}</h5>
          <div className="verification-details">
            <span>Total blocks checked: {verification.total_blocks}</span>
            {verification.errors && verification.errors.length > 0 && (
              <div className="verification-errors">
                <strong>Errors found:</strong>
                {verification.errors.map((err, idx) => (
                  <div key={idx} className="error-item">
                    Block {err.block}: {err.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Event Selection */}
      <div className="event-selection">
        <h4>Select Event to View Provenance</h4>
        <div className="events-list">
          {events && events.slice(0, 20).map(event => (
            <div
              key={event.id}
              className={`event-item ${selectedEvent === event.id ? 'selected' : ''}`}
              onClick={() => viewProvenance(event.id)}
            >
              <span className="event-id">{event.id}</span>
              <span className="event-state">{event.state}</span>
              <span className="event-type">{event.event_type}</span>
              <button
                onClick={(e) => { e.stopPropagation(); exportProof(event.id); }}
                className="export-icon-button"
                title="Export proof"
              >
                📥
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Provenance Timeline */}
      {loading && <div className="loading">Loading provenance...</div>}

      {provenance && (
        <div className="provenance-timeline">
          <h4>Custody Chain for Event: {provenance.event_id}</h4>
          <div className="timeline-summary">
            <span>Total operations: {provenance.total_operations}</span>
            <span>•</span>
            <span className={provenance.custody_chain_verified ? 'verified' : 'not-verified'}>
              {provenance.custody_chain_verified ? '✓ Chain verified' : '⚠️ Chain not verified'}
            </span>
          </div>

          <div className="timeline">
            {provenance.timeline && provenance.timeline.map((record, idx) => (
              <div key={idx} className="timeline-entry">
                <div className="timeline-marker">
                  <span className={`verification-dot ${record.verified ? 'verified' : 'unverified'}`}></span>
                  <div className="timeline-line"></div>
                </div>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <span className="operation-type">{record.operation}</span>
                    <span className="timestamp">{new Date(record.timestamp).toLocaleString()}</span>
                    <span className={`verified-badge ${record.verified ? 'verified' : 'unverified'}`}>
                      {record.verified ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="timeline-details">
                    {record.operation === 'INGESTION' && (
                      <>
                        <div><strong>Source:</strong> {record.details.source}</div>
                        <div><strong>State:</strong> {record.details.state}</div>
                        <div><strong>Data Hash:</strong> <code>{record.details.data_hash?.substring(0, 16)}...</code></div>
                      </>
                    )}
                    {record.operation === 'TRANSFORMATION' && (
                      <>
                        <div><strong>Type:</strong> {record.details.type}</div>
                        <div><strong>Original Hash:</strong> <code>{record.details.original_hash?.substring(0, 16)}...</code></div>
                        <div><strong>Transformed Hash:</strong> <code>{record.details.transformed_hash?.substring(0, 16)}...</code></div>
                        {record.details.changes && record.details.changes.length > 0 && (
                          <div><strong>Changes:</strong> {record.details.changes.length} modifications</div>
                        )}
                      </>
                    )}
                    {record.operation === 'DELIVERY' && (
                      <>
                        <div><strong>Recipient IP:</strong> {record.details.recipient?.ip}</div>
                        <div><strong>Data Hash:</strong> <code>{record.details.data_hash?.substring(0, 16)}...</code></div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => exportProof(provenance.event_id)}
            className="export-button"
          >
            📥 Export Proof (Legal/Regulatory)
          </button>
        </div>
      )}

      <div className="patent-info">
        <small>
          💡 <strong>Patent Innovation:</strong> Cryptographic provenance chain enables
          forensic analysis, regulatory compliance, and non-repudiation for inter-agency data sharing
        </small>
      </div>
    </div>
  );
}

export default ProvenanceViewer;
