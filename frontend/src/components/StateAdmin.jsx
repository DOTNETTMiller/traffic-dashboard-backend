import { useState, useEffect } from 'react';
import { config } from '../config';

export default function StateAdmin() {
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingState, setEditingState] = useState(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);

  // Form state
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

  // Password form state
  const [passwordFormData, setPasswordFormData] = useState({
    stateKey: '',
    password: ''
  });

  // Message form state
  const [messageFormData, setMessageFormData] = useState({
    toState: '',
    messageType: 'general',
    messageContent: ''
  });

  useEffect(() => {
    if (adminToken) {
      verifyToken();
    }
  }, [adminToken]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStates();
    }
  }, [isAuthenticated]);

  const verifyToken = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/admin/states`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      if (response.ok) {
        setIsAuthenticated(true);
        localStorage.setItem('adminToken', adminToken);
      } else {
        setError('Invalid admin token');
        setIsAuthenticated(false);
        localStorage.removeItem('adminToken');
      }
    } catch (err) {
      setError('Failed to verify token');
      setIsAuthenticated(false);
    }
  };

  const fetchStates = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${config.apiUrl}/api/admin/states`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
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

  const handleTokenSubmit = (e) => {
    e.preventDefault();
    verifyToken();
  };

  const handleLogout = () => {
    setAdminToken('');
    setIsAuthenticated(false);
    localStorage.removeItem('adminToken');
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddState = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Build credentials object
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
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`State ${formData.stateName} added successfully!`);
        setShowAddForm(false);
        resetForm();
        fetchStates();
      } else {
        setError(data.error || 'Failed to add state');
      }
    } catch (err) {
      setError('Error adding state: ' + err.message);
    }
  };

  const handleUpdateState = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Build credentials object
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
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`State ${formData.stateName} updated successfully!`);
        setEditingState(null);
        resetForm();
        fetchStates();
      } else {
        setError(data.error || 'Failed to update state');
      }
    } catch (err) {
      setError('Error updating state: ' + err.message);
    }
  };

  const handleDeleteState = async (stateKey, stateName) => {
    if (!confirm(`Are you sure you want to delete ${stateName}?`)) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${config.apiUrl}/api/admin/states/${stateKey}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`State ${stateName} deleted successfully!`);
        fetchStates();
      } else {
        setError(data.error || 'Failed to delete state');
      }
    } catch (err) {
      setError('Error deleting state: ' + err.message);
    }
  };

  const handleTestConnection = async (stateKey, stateName) => {
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${config.apiUrl}/api/admin/test-state/${stateKey}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
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
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${config.apiUrl}/api/states/password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
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
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${config.apiUrl}/api/admin/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
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
        setSuccess(`Message sent to ${states.find(s => s.stateKey === messageFormData.toState)?.stateName}!`);
        setMessageFormData({ toState: '', messageType: 'general', messageContent: '' });
        setShowMessageForm(false);
      } else {
        setError(data.error || 'Failed to send message');
      }
    } catch (err) {
      setError('Error sending message: ' + err.message);
    }
  };

  // Login form
  if (!isAuthenticated) {
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
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
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
              color: 'white',
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

  // Main admin interface
  return (
    <div style={{ maxWidth: '1200px', margin: '20px auto', padding: '20px', height: 'calc(100vh - 200px)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>State Management Admin</h2>
        <button
          onClick={handleLogout}
          style={{
            padding: '8px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
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
              color: 'white',
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
              color: 'white',
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
              color: 'white',
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

      {/* Add/Edit Form */}
      {(showAddForm || editingState) && (
        <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
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
                  <option value="FEU-G">FEU-G (CARS Program)</option>
                  <option value="RSS">RSS</option>
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
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                <h4 style={{ marginBottom: '10px' }}>Authentication (Optional)</h4>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>API Key:</label>
                <input
                  type="text"
                  name="apiKey"
                  value={formData.apiKey}
                  onChange={handleFormChange}
                  placeholder="Optional API key"
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                />
              </div>

              <div></div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Username:</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleFormChange}
                  placeholder="Optional username"
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
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Password:</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleFormChange}
                  placeholder="Optional password"
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
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {editingState ? 'Update State' : 'Add State'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  cancelEdit();
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
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

      {/* Password Form */}
      {showPasswordForm && (
        <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #007bff', borderRadius: '4px', backgroundColor: '#f0f8ff' }}>
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
                  {states.map(state => (
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
                  color: 'white',
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
                  backgroundColor: '#6c757d',
                  color: 'white',
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

      {/* Message Form */}
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
                  {states.map(state => (
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
                  color: 'white',
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
                  backgroundColor: '#6c757d',
                  color: 'white',
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

      {/* States List */}
      <h3>Configured States ({states.length})</h3>
      {loading ? (
        <p>Loading states...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>State</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>API URL</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Type</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Format</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Auth</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Actions</th>
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
                          color: 'white',
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
                          backgroundColor: '#ffc107',
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
                          color: 'white',
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
