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
    <div style={{ maxWidth: '1200px', margin: '20px auto', padding: '20px' }}>
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

      {!showAddForm && !editingState && (
        <button
          onClick={() => setShowAddForm(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginBottom: '20px',
            fontSize: '14px'
          }}
        >
          + Add New State
        </button>
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
