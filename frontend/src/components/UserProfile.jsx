import { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from '../config';
import '../styles/UserProfile.css';

export default function UserProfile({ user, authToken, onProfileUpdate }) {
  const [formData, setFormData] = useState({
    fullName: user?.full_name || user?.fullName || '',
    organization: user?.organization || '',
    stateKey: user?.state_key || user?.stateKey || '',
    email: user?.email || '',
    notifyOnMessages: user?.notify_on_messages ?? user?.notifyOnMessages ?? true,
    notifyOnHighSeverity: user?.notify_on_high_severity ?? user?.notifyOnHighSeverity ?? true
  });
  const [states, setStates] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Load available states
  useEffect(() => {
    const fetchStates = async () => {
      try {
        const response = await axios.get(`${config.apiUrl}/api/states/list`);
        if (response.data.success) {
          setStates(response.data.states);
        }
      } catch (error) {
        console.error('Error fetching states:', error);
      }
    };
    fetchStates();
  }, []);

  // Load user's state subscriptions
  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const response = await axios.get(`${config.apiUrl}/api/users/subscriptions`, {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        });
        if (response.data.success) {
          setSubscriptions(response.data.subscriptions.map(sub => sub.stateKey));
        }
      } catch (error) {
        console.error('Error fetching subscriptions:', error);
      }
    };
    if (authToken) {
      fetchSubscriptions();
    }
  }, [authToken]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData({
      ...passwordData,
      [name]: value
    });
  };

  const handleSubscriptionToggle = async (stateKey) => {
    setLoadingSubscriptions(true);
    setError('');

    try {
      const isSubscribed = subscriptions.includes(stateKey);
      const newSubscriptions = isSubscribed
        ? subscriptions.filter(s => s !== stateKey)
        : [...subscriptions, stateKey];

      const response = await axios.put(
        `${config.apiUrl}/api/users/subscriptions`,
        { stateKeys: newSubscriptions },
        {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      if (response.data.success) {
        setSubscriptions(newSubscriptions);
        setSuccess(`${isSubscribed ? 'Unsubscribed from' : 'Subscribed to'} ${stateKey}`);
        setTimeout(() => setSuccess(''), 2000);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to update subscriptions');
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await axios.put(
        `${config.apiUrl}/api/users/profile`,
        {
          fullName: formData.fullName,
          organization: formData.organization,
          stateKey: formData.stateKey || null,
          notifyOnMessages: formData.notifyOnMessages,
          notifyOnHighSeverity: formData.notifyOnHighSeverity
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      if (response.data.success) {
        setSuccess('Profile updated successfully!');

        // Update localStorage with new user data
        const updatedUser = { ...user, ...response.data.user };
        localStorage.setItem('user', JSON.stringify(updatedUser));

        // Call callback to update parent component
        if (onProfileUpdate) {
          onProfileUpdate(updatedUser);
        }

        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.put(
        `${config.apiUrl}/api/users/password`,
        {
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      if (response.data.success) {
        setSuccess('Password changed successfully!');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setShowPasswordChange(false);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="user-profile-container">
        <p>Please log in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="user-profile-container">
      <div className="user-profile-card">
        <h2>My Profile</h2>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit} className="user-profile-form">
          <div className="form-section">
            <h3>Account Information</h3>

            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                value={user.username}
                disabled
                className="disabled-input"
              />
              <small>Username cannot be changed</small>
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={formData.email}
                disabled
                className="disabled-input"
              />
              <small>Email cannot be changed. Contact an admin if needed.</small>
            </div>

            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Enter your full name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="organization">Organization</label>
              <input
                type="text"
                id="organization"
                name="organization"
                value={formData.organization}
                onChange={handleChange}
                placeholder="e.g., State DOT, Municipality"
              />
            </div>

            <div className="form-group">
              <label htmlFor="stateKey">State/Agency Affiliation</label>
              <select
                id="stateKey"
                name="stateKey"
                value={formData.stateKey}
                onChange={handleChange}
              >
                <option value="">No affiliation / General access</option>
                {states.map(state => (
                  <option key={state.stateKey} value={state.stateKey}>
                    {state.stateName}
                  </option>
                ))}
              </select>
              <small>Select your state DOT to enable state-to-state messaging</small>
            </div>
          </div>

          <div className="form-section">
            <h3>Notification Preferences</h3>

            <div className="form-group-checkbox">
              <label>
                <input
                  type="checkbox"
                  name="notifyOnMessages"
                  checked={formData.notifyOnMessages}
                  onChange={handleChange}
                />
                <span>Email notifications for new messages</span>
              </label>
            </div>

            <div className="form-group-checkbox">
              <label>
                <input
                  type="checkbox"
                  name="notifyOnHighSeverity"
                  checked={formData.notifyOnHighSeverity}
                  onChange={handleChange}
                />
                <span>Email notifications for high-severity events</span>
              </label>
            </div>
          </div>

          <div className="form-section">
            <h3>State Subscriptions</h3>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
              Select states to receive email notifications when messages are posted on events in those states.
            </p>

            {states.length === 0 ? (
              <p>Loading states...</p>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '8px',
                maxHeight: '400px',
                overflowY: 'auto',
                padding: '8px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                backgroundColor: '#f9fafb'
              }}>
                {states.map(state => (
                  <div
                    key={state.stateKey}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px',
                      backgroundColor: 'white',
                      borderRadius: '4px',
                      border: '1px solid #e5e7eb',
                      cursor: loadingSubscriptions ? 'wait' : 'pointer',
                      opacity: loadingSubscriptions ? 0.6 : 1
                    }}
                    onClick={() => !loadingSubscriptions && handleSubscriptionToggle(state.stateKey)}
                  >
                    <input
                      type="checkbox"
                      checked={subscriptions.includes(state.stateKey)}
                      onChange={() => {}}
                      disabled={loadingSubscriptions}
                      style={{ marginRight: '8px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13px', userSelect: 'none' }}>
                      {state.stateName}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {subscriptions.length > 0 && (
              <p style={{ fontSize: '13px', color: '#10b981', marginTop: '12px', fontWeight: '500' }}>
                ✓ Subscribed to {subscriptions.length} state{subscriptions.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="form-actions">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        <div className="form-section">
          <h3>Security</h3>

          {!showPasswordChange ? (
            <button
              type="button"
              onClick={() => setShowPasswordChange(true)}
              className="btn-secondary"
            >
              Change Password
            </button>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="password-change-form">
              <div className="form-group">
                <label htmlFor="currentPassword">Current Password</label>
                <input
                  type="password"
                  id="currentPassword"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  required
                  autoComplete="current-password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  required
                  minLength="6"
                  autoComplete="new-password"
                />
                <small>At least 6 characters</small>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  required
                  minLength="6"
                  autoComplete="new-password"
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordChange(false);
                    setPasswordData({
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: ''
                    });
                    setError('');
                  }}
                  className="btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="account-info">
          <p><strong>Account Type:</strong> {user.role === 'admin' ? 'Administrator' : 'User'}</p>
          <p><strong>Account Status:</strong> {user.active ? 'Active' : 'Inactive'}</p>
          {user.created_at && (
            <p><strong>Member Since:</strong> {new Date(user.created_at).toLocaleDateString()}</p>
          )}
        </div>
      </div>
    </div>
  );
}
