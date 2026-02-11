import { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from '../config';
import '../styles/UserLogin.css';

export default function UserLogin({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    organization: '',
    stateKey: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [states, setStates] = useState([]);

  // Fetch available states on component mount
  useEffect(() => {
    const fetchStates = async () => {
      try {
        const response = await axios.get(`${config.apiUrl}/api/states/list`);
        if (response.data.success) {
          setStates(response.data.states);
        }
      } catch (error) {
        console.error('Error fetching states:', error);
        // Fallback to empty array if fetch fails
        setStates([]);
      }
    };
    fetchStates();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${config.apiUrl}/api/users/login`, {
        username: formData.username,
        password: formData.password
      });

      if (response.data.success) {
        // Store token and user info in localStorage
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));

        // Call onLoginSuccess callback
        if (onLoginSuccess) {
          onLoginSuccess(response.data.user, response.data.token);
        }
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${config.apiUrl}/api/users/register`, {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        organization: formData.organization,
        stateKey: formData.stateKey || null
      });

      if (response.data.success) {
        // Store token and user info in localStorage
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));

        // Call onLoginSuccess callback
        if (onLoginSuccess) {
          onLoginSuccess(response.data.user, response.data.token);
        }
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setResetMessage('');
    setLoading(true);

    try {
      const response = await axios.post(`${config.apiUrl}/api/users/request-password-reset`, {
        email: resetEmail
      });

      if (response.data.success) {
        setResetMessage('Password reset instructions sent! Check your email.');
        setTimeout(() => {
          setShowPasswordReset(false);
          setResetEmail('');
          setResetMessage('');
        }, 3000);
      }
    } catch (error) {
      setResetMessage(error.response?.data?.error || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-login-container">
      <div className="user-login-card">
        <div className="user-login-header">
          <h1>DOT Corridor Communicator</h1>
          <p>Real-time traffic event monitoring and collaboration</p>
        </div>

        <div className="user-login-tabs">
          <button
            className={isLogin ? 'active' : ''}
            onClick={() => {
              setIsLogin(true);
              setError('');
            }}
          >
            Login
          </button>
          <button
            className={!isLogin ? 'active' : ''}
            onClick={() => {
              setIsLogin(false);
              setError('');
            }}
          >
            Register
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {isLogin ? (
          <form onSubmit={handleLogin} className="user-login-form">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
              />
              <div style={{ textAlign: 'right', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowPasswordReset(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: '14px'
                  }}
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-login">
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="user-login-form">
            <div className="form-group">
              <label htmlFor="username">Username *</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                autoComplete="name"
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
                autoComplete="organization"
              />
            </div>

            <div className="form-group">
              <label htmlFor="stateKey">State/Agency Affiliation (Optional)</label>
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
              <small>Select if you represent a state DOT or FHWA to enable messaging features</small>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength="6"
                autoComplete="new-password"
              />
              <small>At least 6 characters</small>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                minLength="6"
                autoComplete="new-password"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-register">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}

        <div className="user-login-footer">
          <p>Access traffic events, send messages to state agencies, and view compliance reports.</p>
        </div>
      </div>

      {/* Password Reset Modal */}
      {showPasswordReset && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '32px',
            borderRadius: '12px',
            maxWidth: '450px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '24px' }}>Reset Password</h2>
            <p style={{ marginBottom: '24px', color: '#6b7280', fontSize: '14px' }}>
              Enter your email address and we'll send you instructions to reset your password.
            </p>

            {resetMessage && (
              <div style={{
                padding: '12px',
                marginBottom: '16px',
                borderRadius: '8px',
                backgroundColor: resetMessage.includes('sent') ? '#d1fae5' : '#fee2e2',
                color: resetMessage.includes('sent') ? '#065f46' : '#991b1b',
                fontSize: '14px'
              }}>
                {resetMessage}
              </div>
            )}

            <form onSubmit={handlePasswordReset}>
              <div className="form-group">
                <label htmlFor="resetEmail">Email Address</label>
                <input
                  type="email"
                  id="resetEmail"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  placeholder="your.email@example.com"
                  autoComplete="email"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordReset(false);
                    setResetEmail('');
                    setResetMessage('');
                  }}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '10px 20px',
                    backgroundcolor: '#6b7280',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '10px 20px',
                    backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                    color: '#111827',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
