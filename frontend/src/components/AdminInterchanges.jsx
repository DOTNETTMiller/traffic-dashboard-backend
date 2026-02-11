import { useEffect, useState } from 'react';
import api from '../services/api';

const emptyForm = {
  name: '',
  stateKey: '',
  corridor: '',
  latitude: '',
  longitude: '',
  watchRadiusKm: 15,
  notifyStates: '',
  detourMessage: ''
};

export default function AdminInterchanges({ authToken }) {
  const [interchanges, setInterchanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const loadInterchanges = async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const response = await api.getInterchanges(authToken);
      setInterchanges(response.interchanges || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to load interchanges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInterchanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      name: form.name.trim(),
      stateKey: form.stateKey.trim().toLowerCase(),
      corridor: form.corridor.trim() || null,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      watchRadiusKm: parseFloat(form.watchRadiusKm) || 15,
      notifyStates: form.notifyStates
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean),
      detourMessage: form.detourMessage.trim() || null
    };

    try {
      if (editingId) {
        await api.updateInterchange(editingId, payload, authToken);
        setSuccess('Interchange updated');
      } else {
        await api.createInterchange(payload, authToken);
        setSuccess('Interchange created');
      }
      resetForm();
      loadInterchanges();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to save interchange');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (interchange) => {
    setEditingId(interchange.id);
    setForm({
      name: interchange.name,
      stateKey: interchange.stateKey,
      corridor: interchange.corridor || '',
      latitude: interchange.latitude,
      longitude: interchange.longitude,
      watchRadiusKm: interchange.watchRadiusKm || 15,
      notifyStates: (interchange.notifyStates || []).join(', '),
      detourMessage: interchange.detourMessage || ''
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this interchange?')) return;
    try {
      await api.deleteInterchange(id, authToken);
      setSuccess('Interchange removed');
      loadInterchanges();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to delete interchange');
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '16px' }}>
      <h2 style={{ marginBottom: '16px' }}>Detour Interchanges</h2>

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

      <form onSubmit={handleSubmit} style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px',
        padding: '16px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        marginBottom: '24px',
        backgroundcolor: '#6b7280'
      }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Name *</label>
          <input name="name" value={form.name} onChange={handleChange} required style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>State Key *</label>
          <input name="stateKey" value={form.stateKey} onChange={handleChange} required style={inputStyle} placeholder="ia" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Corridor</label>
          <input name="corridor" value={form.corridor} onChange={handleChange} style={inputStyle} placeholder="I-80" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Latitude *</label>
          <input name="latitude" value={form.latitude} onChange={handleChange} required type="number" step="0.000001" style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Longitude *</label>
          <input name="longitude" value={form.longitude} onChange={handleChange} required type="number" step="0.000001" style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Watch Radius (km)</label>
          <input name="watchRadiusKm" value={form.watchRadiusKm} onChange={handleChange} type="number" step="1" style={inputStyle} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Notify States (comma separated)</label>
          <input name="notifyStates" value={form.notifyStates} onChange={handleChange} style={inputStyle} placeholder="ia, ne" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Detour Message Template</label>
          <textarea
            name="detourMessage"
            value={form.detourMessage}
            onChange={handleChange}
            rows={2}
            style={{ ...inputStyle, minHeight: '60px' }}
            placeholder="Major {{eventType}} near {{interchange}}. Recommend alternate routes."
          />
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px' }}>
          <button type="submit" disabled={saving} style={buttonStyle}>
            {saving ? 'Saving…' : editingId ? 'Update Interchange' : 'Add Interchange'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} style={{ ...buttonStyle, backgroundColor: '#6b7280' }}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
          gap: '12px',
          padding: '12px 16px',
          backgroundcolor: '#6b7280',
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
          color: '#475569'
        }}>
          <div>Interchange</div>
          <div>State</div>
          <div>Corridor</div>
          <div>Radius (km)</div>
          <div>Actions</div>
        </div>
        <div>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '14px', color: '#6b7280' }}>
              Loading interchanges…
            </div>
          ) : interchanges.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '14px', color: '#6b7280' }}>
              No interchanges configured yet.
            </div>
          ) : (
            interchanges.map(interchange => (
              <div
                key={interchange.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                  gap: '12px',
                  padding: '12px 16px',
                  borderTop: '1px solid #e2e8f0',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{interchange.name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Notifies: {(interchange.notifyStates || []).map(s => s.toUpperCase()).join(', ') || '—'}
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#475569' }}>{interchange.stateKey.toUpperCase()}</div>
                <div style={{ fontSize: '12px', color: '#475569' }}>{interchange.corridor || '—'}</div>
                <div style={{ fontSize: '12px', color: '#475569' }}>{interchange.watchRadiusKm}</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleEdit(interchange)} style={smallButtonStyle}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(interchange.id)} style={{ ...smallButtonStyle, backgroundColor: '#dc2626' }}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

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
  color: '#111827',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 600,
  cursor: 'pointer'
};

const smallButtonStyle = {
  padding: '6px 10px',
  backgroundColor: '#2563eb',
  color: '#111827',
  border: 'none',
  borderRadius: '4px',
  fontSize: '12px',
  cursor: 'pointer'
};
