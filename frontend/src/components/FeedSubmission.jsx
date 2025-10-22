import { useState } from 'react';
import api from '../services/api';

const initialForm = {
  feedName: '',
  feedUrl: '',
  format: 'json',
  apiType: '',
  stateKey: '',
  apiKey: '',
  username: '',
  password: '',
  notes: ''
};

export default function FeedSubmission({ authToken, user }) {
  const [form, setForm] = useState({ ...initialForm, stateKey: user?.stateKey || '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccess('');
    setError('');

    try {
      await api.submitFeed(form, authToken);
      setSuccess('Feed submitted for review. An administrator will review and approve.');
      setForm({ ...initialForm, stateKey: user?.stateKey || '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit feed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!authToken) {
    return (
      <div style={{ padding: '24px', maxWidth: '640px', margin: '0 auto' }}>
        <h2>Submit Data Feed</h2>
        <p>Please log in to submit a data feed for approval.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '720px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '16px' }}>Submit a Data Feed</h2>
      <p style={{ marginBottom: '20px', color: '#475569' }}>
        Provide details about your traffic data feed. Our team will review and, if approved, integrate it into the dashboard outputs.
      </p>

      {error && (
        <div style={{ marginBottom: '12px', padding: '12px', borderRadius: '6px', backgroundColor: '#fee2e2', color: '#991b1b' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ marginBottom: '12px', padding: '12px', borderRadius: '6px', backgroundColor: '#dcfce7', color: '#15803d' }}>
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '20px',
        backgroundColor: '#f8fafc'
      }}>
        <div>
          <label style={labelStyle}>Feed Name *</label>
          <input name="feedName" value={form.feedName} onChange={handleChange} required style={inputStyle} placeholder="e.g., Nebraska I-80 Incidents" />
        </div>
        <div>
          <label style={labelStyle}>Feed URL *</label>
          <input name="feedUrl" value={form.feedUrl} onChange={handleChange} required style={inputStyle} placeholder="https://example.com/api" />
        </div>
        <div>
          <label style={labelStyle}>Format *</label>
          <select name="format" value={form.format} onChange={handleChange} style={inputStyle}>
            <option value="json">JSON</option>
            <option value="geojson">GeoJSON</option>
            <option value="xml">XML</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>API Type</label>
          <input name="apiType" value={form.apiType} onChange={handleChange} style={inputStyle} placeholder="WZDx, TMDD, Custom" />
        </div>
        <div>
          <label style={labelStyle}>State Key</label>
          <input name="stateKey" value={form.stateKey} onChange={handleChange} style={inputStyle} placeholder="Two-letter key (e.g., ia)" />
        </div>
        <div>
          <label style={labelStyle}>API Key</label>
          <input name="apiKey" value={form.apiKey} onChange={handleChange} style={inputStyle} placeholder="Optional API key" />
        </div>
        <div>
          <label style={labelStyle}>Username</label>
          <input name="username" value={form.username} onChange={handleChange} style={inputStyle} placeholder="Optional username" />
        </div>
        <div>
          <label style={labelStyle}>Password</label>
          <input name="password" value={form.password} onChange={handleChange} style={inputStyle} placeholder="Optional password" type="password" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Notes</label>
          <textarea name="notes" value={form.notes} onChange={handleChange} rows={4} style={{ ...inputStyle, minHeight: '80px' }} placeholder="Include any additional context or documentation." />
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-start' }}>
          <button type="submit" disabled={submitting} style={buttonStyle}>
            {submitting ? 'Submitting…' : 'Submit Feed'}
          </button>
        </div>
      </form>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#475569',
  marginBottom: '4px'
};

const inputStyle = {
  width: '100%',
  padding: '8px',
  borderRadius: '4px',
  border: '1px solid #cbd5f5',
  fontSize: '14px'
};

const buttonStyle = {
  padding: '10px 16px',
  backgroundColor: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 600,
  cursor: 'pointer'
};
