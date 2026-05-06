import { useEffect, useMemo, useState } from 'react';
import { config } from '../config';
// GLOBAL_TEXT_VISIBILITY_FIX_APPLIED: Ensures readable text on all backgrounds


const defaultUserForm = {
  email: '',
  password: '',
  confirmPassword: '',
  fullName: '',
  organization: '',
  stateKey: '',
  role: 'user',
  notifyOnMessages: true,
  notifyOnHighSeverity: true,
  active: true
};

const roleOptions = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' }
];

const formatDateTime = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch (err) {
    console.error('Failed to format date:', err);
    return value;
  }
};

const getStoredAdminToken = () => {
  if (typeof window === 'undefined') {
    return '';
  }
  return localStorage.getItem('adminToken') || '';
};

export default function AdminUsers({ user, authToken }) {
  const [users, setUsers] = useState([]);
  const [states, setStates] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState(defaultUserForm);

  const storedToken = useMemo(() => getStoredAdminToken(), []);
  const activeToken = authToken || storedToken;
  const isAdmin = user?.role === 'admin';

  const ensureToken = () => {
    if (!activeToken) {
      setError('Missing admin credentials. Please log in with an admin account or provide an admin token.');
      return false;
    }
    return true;
  };

  const authorizedFetch = async (url, options = {}) => {
    if (!ensureToken()) {
      throw new Error('missing-token');
    }

    const headers = {
      Authorization: `Bearer ${activeToken}`,
      ...(options.headers || {})
    };

    return fetch(url, {
      ...options,
      headers
    });
  };

  const fetchStates = async () => {
    if (!ensureToken()) return;

    setLoadingStates(true);
    try {
      const response = await authorizedFetch(`${config.apiUrl}/api/admin/states`);
      if (!response.ok) {
        throw new Error('Failed to load states');
      }
      const data = await response.json();
      setStates(data.states || []);
    } catch (err) {
      setError(err.message || 'Error loading states');
    } finally {
      setLoadingStates(false);
    }
  };

  const fetchUsers = async () => {
    if (!ensureToken()) return;

    setLoadingUsers(true);
    try {
      const response = await authorizedFetch(`${config.apiUrl}/api/admin/users`);
      if (!response.ok) {
        throw new Error('Failed to load users');
      }
      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message || 'Error loading users');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (!isAdmin && !storedToken) {
      setError('Admin access required to manage users.');
      return;
    }
    fetchStates();
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, storedToken]);

  const resetForm = () => {
    setFormData(defaultUserForm);
    setEditingUser(null);
  };

  const handleCreateClick = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEditClick = (userRecord) => {
    setEditingUser(userRecord);
    setFormData({
      email: userRecord.email || userRecord.username || '',
      password: '',
      confirmPassword: '',
      fullName: userRecord.fullName || '',
      organization: userRecord.organization || '',
      stateKey: userRecord.stateKey || '',
      role: userRecord.role || 'user',
      notifyOnMessages: Boolean(userRecord.notifyOnMessages),
      notifyOnHighSeverity: Boolean(userRecord.notifyOnHighSeverity),
      active: Boolean(userRecord.active)
    });
    setShowForm(true);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const updateUserInState = (updatedUser) => {
    setUsers((prev) => prev.map((item) => (item.id === updatedUser.id ? updatedUser : item)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ensureToken()) return;

    setError('');
    setSuccess('');

    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }
    if (!editingUser && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const payload = {
      email: formData.email.trim(),
      fullName: formData.fullName.trim() || undefined,
      organization: formData.organization.trim() || undefined,
      stateKey: formData.stateKey || null,
      role: formData.role,
      notifyOnMessages: formData.notifyOnMessages,
      notifyOnHighSeverity: formData.notifyOnHighSeverity,
      active: formData.active
    };

    if (!editingUser) {
      // Email is used as username
      if (formData.password) {
        payload.password = formData.password;
      }
    }

    try {
      if (editingUser) {
        const response = await authorizedFetch(`${config.apiUrl}/api/admin/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to update user');
        }

        updateUserInState(data.user);
        setSuccess(`Updated user ${data.user.username}`);
      } else {
        const response = await authorizedFetch(`${config.apiUrl}/api/admin/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to create user');
        }

        setUsers((prev) => [data.user, ...prev]);
        setSuccess(
          data.temporaryPassword
            ? `Created user ${data.user.username}. Temporary password: ${data.temporaryPassword}`
            : `Created user ${data.user.username}`
        );
      }

      resetForm();
      setShowForm(false);
    } catch (err) {
      setError(err.message || 'Error saving user');
    }
  };

  const handleResetPassword = async (userRecord) => {
    if (!ensureToken()) return;
    if (!window.confirm(`Reset password for ${userRecord.username}?`)) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      const response = await authorizedFetch(`${config.apiUrl}/api/admin/users/${userRecord.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccess(`Temporary password for ${userRecord.username}: ${data.temporaryPassword}`);
    } catch (err) {
      setError(err.message || 'Error resetting password');
    }
  };

  const handleToggleActive = async (userRecord) => {
    if (!ensureToken()) return;

    try {
      const response = await authorizedFetch(`${config.apiUrl}/api/admin/users/${userRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !userRecord.active })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user status');
      }

      updateUserInState(data.user);
      setSuccess(`${data.user.username} is now ${data.user.active ? 'active' : 'inactive'}`);
    } catch (err) {
      setError(err.message || 'Error updating user status');
    }
  };

  const handleChangeRole = async (userRecord, role) => {
    if (!ensureToken()) return;

    try {
      const response = await authorizedFetch(`${config.apiUrl}/api/admin/users/${userRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to change role');
      }

      updateUserInState(data.user);
      setSuccess(`Updated ${data.user.username} to role ${data.user.role}`);
    } catch (err) {
      setError(err.message || 'Error changing role');
    }
  };

  const handleDeleteUser = async (userRecord) => {
    if (!ensureToken()) return;
    if (!window.confirm(`Delete user ${userRecord.username}? This cannot be undone.`)) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      const response = await authorizedFetch(`${config.apiUrl}/api/admin/users/${userRecord.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      setUsers((prev) => prev.filter((item) => item.id !== userRecord.id));
      setSuccess(`Deleted user ${userRecord.username}`);
    } catch (err) {
      setError(err.message || 'Error deleting user');
    }
  };

  if (!isAdmin && !storedToken) {
    return (
      <div style={{ margin: '60px auto', maxWidth: '480px', textAlign: 'center', padding: '20px', fontFamily: 'var(--font-sans)' }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px',
          fontWeight: 700,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          color: 'var(--accent)'
        }}>
          Admin Access Required
        </h2>
        <p style={{ color: 'var(--fg-muted)' }}>You need an admin account or token to manage users.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '20px auto', padding: '20px', height: 'calc(100vh - 200px)', overflowY: 'auto', fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            fontWeight: 700,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            color: 'var(--accent)'
          }}>
            User Management
          </h2>
          {user && (
            <p style={{ margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: '13px' }}>
              Logged in as <strong>{user.username}</strong>
            </p>
          )}
        </div>
        <button
          onClick={handleCreateClick}
          style={{
            padding: '10px 22px',
            backgroundColor: 'var(--accent)',
            color: 'var(--chrome-bg)',
            border: 'none',
            borderRadius: '999px',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em'
          }}
        >
          + Create User
        </button>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px',
          marginBottom: '15px',
          background: 'rgba(211, 47, 47, 0.08)',
          border: '1px solid rgba(211, 47, 47, 0.24)',
          borderRadius: '8px',
          color: '#9a1c1c',
          fontSize: '13px'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '10px 14px',
          marginBottom: '15px',
          background: 'rgba(22, 163, 74, 0.08)',
          border: '1px solid rgba(22, 163, 74, 0.24)',
          borderRadius: '8px',
          color: '#15803d',
          fontSize: '13px'
        }}>
          {success}
        </div>
      )}

      {showForm && (
        <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: '#f9fafb' }}>
          <h3>{editingUser ? `Edit ${editingUser.username}` : 'Create New User'}</h3>
          {!editingUser && (
            <p style={{ fontSize: '0.9em', color: '#666', margin: '0 0 15px 0' }}>
              Note: Email address will be used as the username for login.
            </p>
          )}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div style={{ gridColumn: editingUser ? '1' : '1 / span 2' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Email {!editingUser && '(used as username)'} *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleFormChange}
                  required
                  autoComplete="email"
                  disabled={editingUser}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    backgroundColor: editingUser ? '#f5f5f5' : 'white'
                  }}
                />
                {editingUser && (
                  <small style={{ color: '#666', fontSize: '0.85em' }}>
                    Email/username cannot be changed for existing users
                  </small>
                )}
              </div>

              {!editingUser && (
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Password</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleFormChange}
                    placeholder="Leave blank to auto-generate"
                    autoComplete="new-password"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
              )}

              {!editingUser && (
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Confirm Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleFormChange}
                    placeholder="Must match password"
                    autoComplete="new-password"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleFormChange}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Organization</label>
                <input
                  type="text"
                  name="organization"
                  value={formData.organization}
                  onChange={handleFormChange}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>State</label>
                <select
                  name="stateKey"
                  value={formData.stateKey}
                  onChange={handleFormChange}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="">None</option>
                  {states.map((state) => (
                    <option key={state.stateKey} value={state.stateKey}>
                      {state.stateName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Role</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleFormChange}
                  required
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 'bold' }}>Notifications</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    name="notifyOnMessages"
                    checked={formData.notifyOnMessages}
                    onChange={handleFormChange}
                  />
                  Message alerts
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    name="notifyOnHighSeverity"
                    checked={formData.notifyOnHighSeverity}
                    onChange={handleFormChange}
                  />
                  High severity events
                </label>
              </div>

              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Status</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    name="active"
                    checked={formData.active}
                    onChange={handleFormChange}
                  />
                  Active account
                </label>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                style={{
                  padding: '10px 20px',
                  backgroundColor: editingUser ? '#F5C842' : '#16a34a',
                  color: editingUser ? '#222' : 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {editingUser ? 'Save Changes' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6b7280',
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

      {loadingUsers ? (
        <p>Loading users…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid var(--border-strong)' }}>
                <th style={{ padding: '12px', textAlign: 'left' , color: '#111827'}}>Username</th>
                <th style={{ padding: '12px', textAlign: 'left' , color: '#111827'}}>Email</th>
                <th style={{ padding: '12px', textAlign: 'left' , color: '#111827'}}>Role</th>
                <th style={{ padding: '12px', textAlign: 'left' , color: '#111827'}}>State</th>
                <th style={{ padding: '12px', textAlign: 'left' , color: '#111827'}}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left' , color: '#111827'}}>Last Login</th>
                <th style={{ padding: '12px', textAlign: 'left' , color: '#111827'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((userRecord) => (
                <tr key={userRecord.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{userRecord.username}</td>
                  <td style={{ padding: '12px' }}>{userRecord.email || '—'}</td>
                  <td style={{ padding: '12px' }}>
                    <select
                      value={userRecord.role || 'user'}
                      onChange={(e) => handleChangeRole(userRecord, e.target.value)}
                      style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                    >
                      {roleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {userRecord.stateKey
                      ? states.find((state) => state.stateKey === userRecord.stateKey)?.stateName || userRecord.stateKey
                      : '—'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      color: userRecord.active ? '#16a34a' : '#dc2626',
                      fontWeight: 'bold'
                    }}>
                      {userRecord.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '12px' }}>{formatDateTime(userRecord.lastLogin)}</td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <TableActionButton tone="brand" onClick={() => handleResetPassword(userRecord)}>
                        Reset Password
                      </TableActionButton>
                      <TableActionButton
                        tone={userRecord.active ? 'warn' : 'good'}
                        onClick={() => handleToggleActive(userRecord)}
                      >
                        {userRecord.active ? 'Deactivate' : 'Activate'}
                      </TableActionButton>
                      <TableActionButton tone="neutral" onClick={() => handleEditClick(userRecord)}>
                        Edit
                      </TableActionButton>
                      <TableActionButton tone="destructive" onClick={() => handleDeleteUser(userRecord)}>
                        Delete
                      </TableActionButton>
                    </div>
                  </td>
                </tr>
              ))}

              {users.length === 0 && !loadingUsers && (
                <tr>
                  <td colSpan={7} style={{ padding: '16px', textAlign: 'center', color: '#6b7280' }}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {loadingStates && (
        <p style={{ marginTop: '10px', color: '#6b7280', fontSize: '12px' }}>Updating state list…</p>
      )}
    </div>
  );
}

/**
 * Compact table-row action button — Apple-style tonal pill.
 *
 * The previous buttons were chunky filled rectangles in saturated brand
 * colors (orange / green / gray / red) that competed visually with the
 * rest of the chrome. This is the Apple pattern instead: a faint tinted
 * background carries the semantic, the text is ink-colored and uppercase
 * tracked, the pill shape matches the chrome's other primary buttons,
 * and hover lifts the tint subtly. Reads as "subtle but tappable" rather
 * than "alarming."
 *
 * Tones:
 *   brand        — accent orange, for utility actions (Reset Password)
 *   good         — green, for positive state changes (Activate)
 *   warn         — amber, for cautious state changes (Deactivate)
 *   neutral      — gray, for non-destructive utilities (Edit)
 *   destructive  — red, for irreversible actions (Delete)
 */
function TableActionButton({ tone = 'neutral', onClick, children }) {
  const palettes = {
    brand:       { fg: '#a55e10', bg: 'rgba(240, 130, 48, 0.10)', border: 'rgba(240, 130, 48, 0.28)', hoverBg: 'rgba(240, 130, 48, 0.18)' },
    good:        { fg: '#15803d', bg: 'rgba(22, 163, 74, 0.10)',  border: 'rgba(22, 163, 74, 0.28)',  hoverBg: 'rgba(22, 163, 74, 0.18)' },
    warn:        { fg: '#a55e10', bg: 'rgba(245, 200, 66, 0.18)', border: 'rgba(217, 177, 42, 0.40)', hoverBg: 'rgba(245, 200, 66, 0.28)' },
    neutral:     { fg: '#374151', bg: 'rgba(0, 0, 0, 0.04)',      border: 'rgba(0, 0, 0, 0.10)',      hoverBg: 'rgba(0, 0, 0, 0.07)' },
    destructive: { fg: '#9a1c1c', bg: 'rgba(211, 47, 47, 0.08)',  border: 'rgba(211, 47, 47, 0.28)',  hoverBg: 'rgba(211, 47, 47, 0.14)' }
  };
  const p = palettes[tone] || palettes.neutral;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: '26px',
        padding: '0 12px',
        background: p.bg,
        color: p.fg,
        border: `1px solid ${p.border}`,
        borderRadius: '999px',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        transition: 'background-color 160ms cubic-bezier(0.32, 0.72, 0, 1), transform 160ms cubic-bezier(0.32, 0.72, 0, 1)'
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = p.hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = p.bg; }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {children}
    </button>
  );
}
