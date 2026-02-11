import { useEffect, useState } from 'react';
import api from '../services/api';

export default function AdminFeedSubmissions({ authToken }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState('pending');
  const [processingId, setProcessingId] = useState(null);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [enableState, setEnableState] = useState(true);

  const loadSubmissions = async (status = filter) => {
    if (!authToken) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.getFeedSubmissions(authToken, status);
      setSubmissions(response.submissions || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load feed submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, filter]);

  const handleResolve = async (submission, status) => {
    setProcessingId(submission.id);
    setError('');
    setSuccess('');
    try {
      await api.resolveFeedSubmission(submission.id, {
        status,
        adminNote: '',
        overwriteExisting,
        enableState
      }, authToken);
      setSuccess(`Submission ${submission.feedName} marked ${status}.`);
      loadSubmissions(filter);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update submission');
    } finally {
      setProcessingId(null);
    }
  };

  if (!authToken) {
    return <p style={{ padding: '24px' }}>Admin authentication required.</p>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1100px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '16px' }}>Feed Submissions</h2>

      {error && (
        <div style={{ marginBottom: '12px', padding: '12px', borderRadius: '6px', backgroundcolor: '#6b7280', color: '#991b1b' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ marginBottom: '12px', padding: '12px', borderRadius: '6px', backgroundColor: '#dcfce7', color: '#15803d' }}>
          {success}
        </div>
      )}

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setFilter('pending')} style={filterButtonStyle(filter === 'pending')}>
            Pending
          </button>
          <button onClick={() => setFilter('approved')} style={filterButtonStyle(filter === 'approved')}>
            Approved
          </button>
          <button onClick={() => setFilter('rejected')} style={filterButtonStyle(filter === 'rejected')}>
            Rejected
          </button>
          <button onClick={() => setFilter('all')} style={filterButtonStyle(filter === 'all')}>
            All
          </button>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input type="checkbox" checked={overwriteExisting} onChange={(e) => setOverwriteExisting(e.target.checked)} />
            Overwrite existing state
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input type="checkbox" checked={enableState} onChange={(e) => setEnableState(e.target.checked)} />
            Enable state on approval
          </label>
        </div>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1.2fr 1fr 0.6fr 0.6fr 0.8fr',
          gap: '12px',
          padding: '12px 16px',
          backgroundcolor: '#6b7280',
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
          color: '#475569'
        }}>
          <div>Feed</div>
          <div>URL</div>
          <div>Submitted By</div>
          <div>Format</div>
          <div>State</div>
          <div>Actions</div>
        </div>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>Loading…</div>
        ) : submissions.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>No submissions.</div>
        ) : (
          submissions.map(submission => (
            <div
              key={submission.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr 1.2fr 1fr 0.6fr 0.6fr 0.8fr',
                gap: '12px',
                padding: '12px 16px',
                borderTop: '1px solid #e2e8f0',
                fontSize: '13px',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{submission.feedName}</div>
                {submission.notes && <div style={{ fontSize: '12px', color: '#64748b' }}>{submission.notes}</div>}
              </div>
              <div style={{ fontSize: '12px', wordBreak: 'break-all', color: '#0369a1' }}>{submission.feedUrl}</div>
              <div style={{ fontSize: '12px', color: '#475569' }}>
                {submission.submitterUsername || 'N/A'}
                <br />
                <span style={{ color: '#64748b' }}>{submission.submitterEmail || ''}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#475569' }}>{submission.format}</div>
              <div style={{ fontSize: '12px', color: '#475569' }}>{submission.stateKey?.toUpperCase() || '—'}</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {submission.status === 'pending' ? (
                  <>
                    <button
                      style={smallButtonStyle('#16a34a')}
                      disabled={processingId === submission.id}
                      onClick={() => handleResolve(submission, 'approved')}
                    >
                      {processingId === submission.id ? 'Approving…' : 'Approve'}
                    </button>
                    <button
                      style={smallButtonStyle('#dc2626')}
                      disabled={processingId === submission.id}
                      onClick={() => handleResolve(submission, 'rejected')}
                    >
                      {processingId === submission.id ? 'Rejecting…' : 'Reject'}
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: '12px', color: submission.status === 'approved' ? '#16a34a' : '#dc2626' }}>
                    {submission.status.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const filterButtonStyle = (active) => ({
  padding: '8px 12px',
  borderRadius: '20px',
  border: 'none',
  backgroundColor: active ? '#2563eb' : '#e5e7eb',
  color: active ? 'white' : '#1f2937',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 600
});

const smallButtonStyle = (color) => ({
  padding: '6px 10px',
  backgroundColor: color,
  color: '#111827',
  border: 'none',
  borderRadius: '4px',
  fontSize: '12px',
  cursor: 'pointer'
});
