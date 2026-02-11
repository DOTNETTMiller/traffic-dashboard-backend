import { useState, useEffect } from 'react';
import { config } from '../config';
// GLOBAL_TEXT_VISIBILITY_FIX_APPLIED: Ensures readable text on all backgrounds


const getStoredAdminToken = () => {
  if (typeof window === 'undefined') {
    return '';
  }
  return localStorage.getItem('adminToken') || '';
};

export default function StateAdmin({ user, authToken }) {
  const [customToken, setCustomToken] = useState(getStoredAdminToken);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingState, setEditingState] = useState(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);

  const [formData, setFormData] = useState({
    stateKey: '',
    stateName: '',
    apiUrl: '',
    apiType: 'Custom JSON',
    format: 'json',
    apiKey: '',
    username: '',
    password: ''
  });

  const [passwordFormData, setPasswordFormData] = useState({
    stateKey: '',
    password: ''
  });

  const [messageFormData, setMessageFormData] = useState({
    toState: '',
    messageType: 'general',
    messageContent: ''
  });

  const isUserAdmin = Boolean(user?.role === 'admin');
  const usingUserJwt = isUserAdmin && Boolean(authToken);
  const activeToken = usingUserJwt ? authToken : customToken;

  const verifyToken = async (token, { fromUserJwt = false } = {}) => {
    if (!token) {
      setIsAuthenticated(false);
      return;
    }

    setError('');
    try {
      const response = await fetch(`${config.apiUrl}/api/admin/states`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        setIsAuthenticated(true);
        if (!fromUserJwt) {
          localStorage.setItem('adminToken', token);
          setCustomToken(token);
        }
      } else {
        const message = fromUserJwt
          ? 'Your account does not have admin privileges.'
          : 'Invalid admin token';
        setError(message);
        setIsAuthenticated(false);
        if (!fromUserJwt) {
          localStorage.removeItem('adminToken');
        }
      }
    } catch (err) {
      setError('Failed to verify admin credentials.');
      setIsAuthenticated(false);
    }
  };

  const fetchStates = async (token) => {
    if (!token) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${config.apiUrl}/api/admin/states`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStates(data.states);
      } else {
        setError('Failed to fetch states');
      }
    } catch (err) {
      setError('Error fetching states: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (usingUserJwt && authToken) {
      verifyToken(authToken, { fromUserJwt: true });
    } else if (!usingUserJwt && customToken) {
      verifyToken(customToken);
    } else {
      setIsAuthenticated(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usingUserJwt, authToken]);

  useEffect(() => {
    if (isAuthenticated && activeToken) {
      fetchStates(activeToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, activeToken]);

  const handleTokenSubmit = (e) => {
    e.preventDefault();
    verifyToken(customToken);
  };

  const handleLogout = () => {
    setCustomToken('');
    setIsAuthenticated(false);
    setStates([]);
    localStorage.removeItem('adminToken');
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const ensureToken = () => {
    if (!activeToken) {
      setError('Admin authentication is required for this action.');
      return false;
    }
    return true;
  };

  const handleAddState = async (e) => {
    e.preventDefault();
    if (!ensureToken()) return;

    setError('');
    setSuccess('');

    const credentials = {};
    if (formData.apiKey) credentials.apiKey = formData.apiKey;
    if (formData.username) credentials.username = formData.username;
    if (formData.password) credentials.password = formData.password;

    const payload = {
      stateKey: formData.stateKey.toLowerCase().replace(/\s+/g, ''),
      stateName: formData.stateName,
      apiUrl: formData.apiUrl,
      apiType: formData.apiType,
      format: formData.format,
      credentials: Object.keys(credentials).length > 0 ? credentials : undefined
    };

    try {
      const response = await fetch(`${config.apiUrl}/api/admin/states`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`State ${formData.stateName} added successfully!`);
        setShowAddForm(false);
        resetForm();
        fetchStates(activeToken);
      } else {
        setError(data.error || 'Failed to add state');
      }
    } catch (err) {
      setError('Error adding state: ' + err.message);
    }
  };

  const handleUpdateState = async (e) => {
    e.preventDefault();
    if (!ensureToken()) return;

    setError('');
    setSuccess('');

    const credentials = {};
    if (formData.apiKey) credentials.apiKey = formData.apiKey;
    if (formData.username) credentials.username = formData.username;
    if (formData.password) credentials.password = formData.password;

    const payload = {
      stateName: formData.stateName,
      apiUrl: formData.apiUrl,
      apiType: formData.apiType,
      format: formData.format,
      credentials: Object.keys(credentials).length > 0 ? credentials : undefined
    };

    try {
      const response = await fetch(`${config.apiUrl}/api/admin/states/${editingState.stateKey}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${activeToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`State ${formData.stateName} updated successfully!`);
        setEditingState(null);
        resetForm();
        fetchStates(activeToken);
      } else {
        setError(data.error || 'Failed to update state');
      }
    } catch (err) {
      setError('Error updating state: ' + err.message);
    }
  };

  const handleDeleteState = async (stateKey, stateName) => {
    if (!ensureToken()) return;

    if (!confirm(`Are you sure you want to delete ${stateName}?`)) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${config.apiUrl}/api/admin/states/${stateKey}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${activeToken}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`State ${stateName} deleted successfully!`);
        fetchStates(activeToken);
      } else {
        setError(data.error || 'Failed to delete state');
      }
    } catch (err) {
      setError('Error deleting state: ' + err.message);
    }
  };

  const handleTestConnection = async (stateKey, stateName) => {
    if (!ensureToken()) return;

    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${config.apiUrl}/api/admin/test-state/${stateKey}`, {
        headers: {
          Authorization: `Bearer ${activeToken}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`${stateName}: ${data.message} (Found ${data.eventsFound} events)`);
      } else {
        setError(`${stateName}: ${data.message || 'Connection failed'}`);
      }
    } catch (err) {
      setError(`Error testing ${stateName}: ` + err.message);
    }
  };

  const startEdit = (state) => {
    setEditingState(state);
    setFormData({
      stateKey: state.stateKey,
      stateName: state.stateName,
      apiUrl: state.apiUrl,
      apiType: state.apiType,
      format: state.format,
      apiKey: state.credentials?.apiKey || '',
      username: state.credentials?.username || '',
      password: state.credentials?.password || ''
    });
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingState(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      stateKey: '',
      stateName: '',
      apiUrl: '',
      apiType: 'Custom JSON',
      format: 'json',
      apiKey: '',
      username: '',
      password: ''
    });
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    if (!ensureToken()) return;

    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${config.apiUrl}/api/states/password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(passwordFormData)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        setPasswordFormData({ stateKey: '', password: '' });
        setShowPasswordForm(false);
      } else {
        setError(data.error || 'Failed to set password');
      }
    } catch (err) {
      setError('Error setting password: ' + err.message);
    }
  };

  const handleSendAdminMessage = async (e) => {
    e.preventDefault();
    if (!ensureToken()) return;

    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${config.apiUrl}/api/admin/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          toState: messageFormData.toState,
          messageType: messageFormData.messageType,
          messageContent: messageFormData.messageContent
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Message sent to ${states.find((s) => s.stateKey === messageFormData.toState)?.stateName}!`);
        setMessageFormData({ toState: '', messageType: 'general', messageContent: '' });
        setShowMessageForm(false);
      } else {
        setError(data.error || 'Failed to send message');
      }
    } catch (err) {
      setError('Error sending message: ' + err.message);
    }
  };

  if (usingUserJwt && !isAuthenticated) {
    return (
      <div style={{ maxWidth: '500px', margin: '50px auto', padding: '20px', textAlign: 'center' }}>
        <h2>Verifying Admin Access</h2>
        <p>Your account has admin privileges. Verifying access…</p>
      </div>
    );
  }

  if (!usingUserJwt && !isAuthenticated) {
    return (
      <div style={{ maxWidth: '500px', margin: '50px auto', padding: '20px' }}>
        <h2 style={{ marginBottom: '20px' }}>State Management Admin</h2>
        <form onSubmit={handleTokenSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Admin Token:
            </label>
            <input
              type="password"
              value={customToken}
              onChange={(e) => setCustomToken(e.target.value)}
              placeholder="Enter admin token"
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
              required
            />
          </div>
          {error && (
            <div style={{ padding: '10px', marginBottom: '15px', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', color: '#c00' }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: '#111827',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '20px auto', padding: '20px', height: 'calc(100vh - 200px)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2>State Management Admin</h2>
          {usingUserJwt && user && (
            <p style={{ margin: 0, color: '#555', fontSize: '14px' }}>
              Access granted via user account <strong>{user.username}</strong>
            </p>
          )}
        </div>
        {!usingUserJwt && (
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: '#111827',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px', marginBottom: '15px', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', color: '#c00' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ padding: '10px', marginBottom: '15px', backgroundColor: '#efe', border: '1px solid #cfc', borderRadius: '4px', color: '#060' }}>
          {success}
        </div>
      )}

      {!showAddForm && !editingState && !showPasswordForm && !showMessageForm && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: '#111827',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            + Add New State
          </button>
          <button
            onClick={() => setShowPasswordForm(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: '#111827',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Set State Password
          </button>
          <button
            onClick={() => setShowMessageForm(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#17a2b8',
              color: '#111827',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Send Message to State
          </button>
        </div>
      )}

      {(showAddForm || editingState) && (
        <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '4px', backgroundcolor: '#6b7280' }}>
          <h3>{editingState ? 'Edit State' : 'Add New State'}</h3>
          <form onSubmit={editingState ? handleUpdateState : handleAddState}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  State Key: {editingState && <span style={{ fontWeight: 'normal', fontSize: '12px' }}>(cannot be changed)</span>}
                </label>
                <input
                  type="text"
                  name="stateKey"
                  value={formData.stateKey}
                  onChange={handleFormChange}
                  placeholder="e.g., wyoming"
                  disabled={!!editingState}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    backgroundColor: editingState ? '#eee' : 'white'
                  }}
                  required={!editingState}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>State Name:</label>
                <input
                  type="text"
                  name="stateName"
                  value={formData.stateName}
                  onChange={handleFormChange}
                  placeholder="e.g., Wyoming"
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                  required
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>API URL:</label>
                <input
                  type="url"
                  name="apiUrl"
                  value={formData.apiUrl}
                  onChange={handleFormChange}
                  placeholder="https://example.com/api/events"
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>API Type:</label>
                <select
                  name="apiType"
                  value={formData.apiType}
                  onChange={handleFormChange}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                >
                  <option value="Custom JSON">Custom JSON</option>
                  <option value="WZDx">WZDx</option>
                  <option value="FEU-G">FEU-G</option>
                  <option value="RSS">RSS</option>
                  <option value="XML">XML</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Format:</label>
                <select
                  name="format"
                  value={formData.format}
                  onChange={handleFormChange}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                >
                  <option value="json">JSON</option>
                  <option value="xml">XML</option>
                  <option value="rss">RSS</option>
                  <option value="csv">CSV</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>API Key (optional):</label>
                <input
                  type="text"
                  name="apiKey"
                  value={formData.apiKey}
                  onChange={handleFormChange}
                  placeholder="Enter API key if required"
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Username (optional):</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleFormChange}
                  placeholder="For basic auth"
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Password (optional):</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleFormChange}
                  placeholder="For basic auth"
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                style={{
                  padding: '10px 20px',
                  backgroundColor: editingState ? '#ffc107' : '#28a745',
                  color: editingState ? 'black' : 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {editingState ? 'Update State' : 'Add State'}
              </button>
              <button
                type="button"
                onClick={editingState ? cancelEdit : () => setShowAddForm(false)}
                style={{
                  padding: '10px 20px',
                  backgroundcolor: '#6b7280',
                  color: '#111827',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showPasswordForm && (
        <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #007bff', borderRadius: '4px', backgroundcolor: '#6b7280' }}>
          <h3>Set State Password for Messaging</h3>
          <p style={{ marginBottom: '15px', color: '#666', fontSize: '14px' }}>
            Set a password for a state to allow them to log in to the state-to-state messaging system.
          </p>
          <form onSubmit={handleSetPassword}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>State:</label>
                <select
                  value={passwordFormData.stateKey}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, stateKey: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                  required
                >
                  <option value="">Select a state...</option>
                  {states.map((state) => (
                    <option key={state.stateKey} value={state.stateKey}>
                      {state.stateName} ({state.stateKey})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Password:</label>
                <input
                  type="password"
                  value={passwordFormData.password}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, password: e.target.value })}
                  placeholder="Enter password for state login"
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                  required
                />
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#007bff',
                  color: '#111827',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Set Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(false);
                  setPasswordFormData({ stateKey: '', password: '' });
                }}
                style={{
                  padding: '10px 20px',
                  backgroundcolor: '#6b7280',
                  color: '#111827',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showMessageForm && (
        <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #17a2b8', borderRadius: '4px', backgroundColor: '#e7f9fc' }}>
          <h3>Send Message to State</h3>
          <p style={{ marginBottom: '15px', color: '#666', fontSize: '14px' }}>
            As an admin, you can send messages directly to any state without needing their login credentials.
          </p>
          <form onSubmit={handleSendAdminMessage}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>To State:</label>
                <select
                  value={messageFormData.toState}
                  onChange={(e) => setMessageFormData({ ...messageFormData, toState: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                  required
                >
                  <option value="">Select recipient state...</option>
                  {states.map((state) => (
                    <option key={state.stateKey} value={state.stateKey}>
                      {state.stateName} ({state.stateKey})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Message Type:</label>
                <select
                  value={messageFormData.messageType}
                  onChange={(e) => setMessageFormData({ ...messageFormData, messageType: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                  required
                >
                  <option value="general">General</option>
                  <option value="alert">Alert</option>
                  <option value="incident">Incident</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="coordination">Coordination</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Message:</label>
              <textarea
                value={messageFormData.messageContent}
                onChange={(e) => setMessageFormData({ ...messageFormData, messageContent: e.target.value })}
                placeholder="Type your message here..."
                rows="6"
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '14px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
                required
              />
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#17a2b8',
                  color: '#111827',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Send Message
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMessageForm(false);
                  setMessageFormData({ toState: '', messageType: 'general', messageContent: '' });
                }}
                style={{
                  padding: '10px 20px',
                  backgroundcolor: '#6b7280',
                  color: '#111827',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <h3>Configured States ({states.length})</h3>
      {loading ? (
        <p>Loading states...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ backgroundcolor: '#6b7280', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '12px', textAlign: 'left' , color: '#111827'}}>State</th>
                <th style={{ padding: '12px', textAlign: 'left' , color: '#111827'}}>API URL</th>
                <th style={{ padding: '12px', textAlign: 'left' , color: '#111827'}}>Type</th>
                <th style={{ padding: '12px', textAlign: 'left' , color: '#111827'}}>Format</th>
                <th style={{ padding: '12px', textAlign: 'left' , color: '#111827'}}>Auth</th>
                <th style={{ padding: '12px', textAlign: 'left' , color: '#111827'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {states.map((state) => (
                <tr key={state.stateKey} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{state.stateName}</td>
                  <td style={{ padding: '12px', fontSize: '12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {state.apiUrl}
                  </td>
                  <td style={{ padding: '12px', fontSize: '12px' }}>{state.apiType}</td>
                  <td style={{ padding: '12px', fontSize: '12px' }}>{state.format.toUpperCase()}</td>
                  <td style={{ padding: '12px', fontSize: '12px' }}>
                    {state.credentials ? (
                      <span style={{ color: '#28a745' }}>
                        {state.credentials.apiKey ? 'API Key' : state.credentials.username ? 'Basic Auth' : 'Yes'}
                      </span>
                    ) : (
                      <span style={{ color: '#6c757d' }}>None</span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleTestConnection(state.stateKey, state.stateName)}
                        style={{
                          padding: '5px 10px',
                          backgroundColor: '#17a2b8',
                          color: '#111827',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                        title="Test API connection"
                      >
                        Test
                      </button>
                      <button
                        onClick={() => startEdit(state)}
                        style={{
                          padding: '5px 10px',
                          backgroundcolor: '#6b7280',
                          color: 'black',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                        title="Edit state"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteState(state.stateKey, state.stateName)}
                        style={{
                          padding: '5px 10px',
                          backgroundColor: '#dc3545',
                          color: '#111827',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                        title="Delete state"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
