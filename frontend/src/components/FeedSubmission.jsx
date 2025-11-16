import { useState, useEffect } from 'react';
import api from '../services/api';
import { theme } from '../styles/theme';

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
  const [integratedFeeds, setIntegratedFeeds] = useState([]);
  const [loadingFeeds, setLoadingFeeds] = useState(true);
  const [showFeeds, setShowFeeds] = useState(false);

  useEffect(() => {
    fetchIntegratedFeeds();
  }, []);

  const fetchIntegratedFeeds = async () => {
    try {
      const response = await api.get('/api/states/list');
      if (response.data.success) {
        setIntegratedFeeds(response.data.states);
      }
    } catch (err) {
      console.error('Error fetching integrated feeds:', err);
    } finally {
      setLoadingFeeds(false);
    }
  };

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
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '16px' }}>Submit a Data Feed</h2>
      <p style={{ marginBottom: '20px', color: '#475569' }}>
        Provide details about your traffic data feed. Our team will review and, if approved, integrate it into the dashboard outputs.
      </p>

      {/* Architecture Diagram */}
      <div style={{
        background: theme.colors.glassDark,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '16px',
        padding: theme.spacing.lg,
        boxShadow: theme.shadows.xl,
        marginBottom: theme.spacing.xl,
        transition: `all ${theme.transitions.medium}`,
        maxHeight: '500px',
        overflow: 'auto'
      }}>
        <h3 style={{
          margin: 0,
          marginBottom: theme.spacing.md,
          fontSize: '18px',
          fontWeight: '700',
          background: theme.colors.gradients.primary,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textAlign: 'center'
        }}>
          How the DOT Corridor Communicator Works
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: theme.spacing.md,
          marginTop: theme.spacing.lg
        }}>
          {/* Step 1: Data Sources */}
          <div style={{
            background: theme.colors.glassLight,
            borderRadius: '12px',
            padding: theme.spacing.md,
            border: `2px solid ${theme.colors.accentBlue}40`,
            position: 'relative'
          }}>
            <div style={{
              fontSize: '32px',
              marginBottom: '8px',
              textAlign: 'center'
            }}>📡</div>
            <div style={{
              fontWeight: '700',
              fontSize: '14px',
              color: theme.colors.accentBlue,
              marginBottom: '8px',
              textAlign: 'center'
            }}>
              1. Data Sources
            </div>
            <div style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
              • 46 Data Feeds<br/>
              • WZDx v4.x (GeoJSON)<br/>
              • FEU-G XML (TMDD)<br/>
              • CHP Incidents (XML)<br/>
              • Real-time updates
            </div>
          </div>

          {/* Step 2: Interstate Filter */}
          <div style={{
            background: theme.colors.glassLight,
            borderRadius: '12px',
            padding: theme.spacing.md,
            border: `2px solid ${theme.colors.accentPurple}40`,
            position: 'relative'
          }}>
            <div style={{
              fontSize: '32px',
              marginBottom: '8px',
              textAlign: 'center'
            }}>🛣️</div>
            <div style={{
              fontWeight: '700',
              fontSize: '14px',
              color: theme.colors.accentPurple,
              marginBottom: '8px',
              textAlign: 'center'
            }}>
              2. Interstate Filter
            </div>
            <div style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
              • Focus on I-XX routes<br/>
              • Exclude state/US routes<br/>
              • Cross-state coordination<br/>
              • Federal highway system
            </div>
          </div>

          {/* Step 3: Normalization */}
          <div style={{
            background: theme.colors.glassLight,
            borderRadius: '12px',
            padding: theme.spacing.md,
            border: `2px solid ${theme.colors.success}40`,
            position: 'relative'
          }}>
            <div style={{
              fontSize: '32px',
              marginBottom: '8px',
              textAlign: 'center'
            }}>⚙️</div>
            <div style={{
              fontWeight: '700',
              fontSize: '14px',
              color: theme.colors.success,
              marginBottom: '8px',
              textAlign: 'center'
            }}>
              3. Normalization
            </div>
            <div style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
              • Unified event format<br/>
              • Geocoding & validation<br/>
              • Corridor extraction<br/>
              • Severity classification
            </div>
          </div>

          {/* Step 4: Outputs */}
          <div style={{
            background: theme.colors.glassLight,
            borderRadius: '12px',
            padding: theme.spacing.md,
            border: `2px solid ${theme.colors.warning}40`,
            position: 'relative'
          }}>
            <div style={{
              fontSize: '32px',
              marginBottom: '8px',
              textAlign: 'center'
            }}>📤</div>
            <div style={{
              fontWeight: '700',
              fontSize: '14px',
              color: theme.colors.warning,
              marginBottom: '8px',
              textAlign: 'center'
            }}>
              4. Outputs
            </div>
            <div style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
              • TIM (SAE J2735)<br/>
              • CV-TIM (SAE J2540)<br/>
              • Detour alerts<br/>
              • DOT messaging
            </div>
          </div>
        </div>

        {/* Additional Features */}
        <div style={{
          marginTop: theme.spacing.lg,
          padding: theme.spacing.md,
          background: `${theme.colors.accentBlue}10`,
          borderRadius: '12px',
          border: `1px solid ${theme.colors.accentBlue}30`
        }}>
          <div style={{
            fontWeight: '700',
            fontSize: '13px',
            color: theme.colors.accentBlue,
            marginBottom: '8px'
          }}>
            Key Features
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            fontSize: '12px',
            color: theme.colors.text
          }}>
            <div>✅ 117 Interstate Interchanges</div>
            <div>✅ 15km Watch Radius Alerts</div>
            <div>✅ AI-Powered Ground Truth</div>
            <div>✅ V2X Message Export</div>
          </div>
        </div>
      </div>

      {/* Integrated Feeds Section */}
      <div style={{
        background: theme.colors.glassDark,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '16px',
        padding: theme.spacing.lg,
        boxShadow: theme.shadows.xl,
        marginBottom: theme.spacing.xl,
        transition: `all ${theme.transitions.medium}`
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
          borderBottom: `1px solid ${theme.colors.border}`
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '700',
            background: theme.colors.gradients.primary,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Currently Integrated Feeds
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
            <span style={{
              background: theme.colors.success,
              color: 'white',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '700'
            }}>
              {integratedFeeds.length} Active
            </span>
            <button
              onClick={() => setShowFeeds(!showFeeds)}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.colors.accentBlue,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                padding: '4px 8px',
                borderRadius: '6px',
                transition: `all ${theme.transitions.fast}`
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = `${theme.colors.accentBlue}10`}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {showFeeds ? 'Hide' : 'Show All'}
            </button>
          </div>
        </div>

        {loadingFeeds ? (
          <div style={{ textAlign: 'center', padding: '20px', color: theme.colors.textSecondary }}>
            Loading integrated feeds...
          </div>
        ) : showFeeds ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: theme.spacing.md,
            marginTop: theme.spacing.md
          }}>
            {integratedFeeds.map((feed) => (
              <div
                key={feed.stateKey}
                style={{
                  background: theme.colors.glassLight,
                  borderRadius: '12px',
                  padding: theme.spacing.md,
                  border: `1px solid ${theme.colors.border}`,
                  transition: `all ${theme.transitions.fast}`
                }}
              >
                <div style={{
                  fontWeight: '700',
                  fontSize: '14px',
                  color: theme.colors.text,
                  marginBottom: '8px'
                }}>
                  {feed.stateName}
                </div>

                <div style={{
                  display: 'flex',
                  gap: '6px',
                  flexWrap: 'wrap',
                  marginBottom: '10px'
                }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '600',
                    backgroundColor: `${theme.colors.accentBlue}15`,
                    color: theme.colors.accentBlue,
                    border: `1px solid ${theme.colors.accentBlue}60`
                  }}>
                    {feed.format?.toUpperCase() || 'N/A'}
                  </span>
                  {feed.apiType && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '600',
                      backgroundColor: `${theme.colors.accentPurple}15`,
                      color: theme.colors.accentPurple,
                      border: `1px solid ${theme.colors.accentPurple}60`
                    }}>
                      {feed.apiType}
                    </span>
                  )}
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '600',
                    backgroundColor: feed.enabled ? `${theme.colors.success}15` : `${theme.colors.textSecondary}15`,
                    color: feed.enabled ? theme.colors.success : theme.colors.textSecondary,
                    border: `1px solid ${feed.enabled ? theme.colors.success : theme.colors.textSecondary}60`
                  }}>
                    {feed.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>

                {feed.apiUrl && (
                  <div style={{
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                    marginTop: '6px',
                    padding: '6px 8px',
                    background: `${theme.colors.border}40`,
                    borderRadius: '6px',
                    wordBreak: 'break-all',
                    fontFamily: 'monospace'
                  }}>
                    <div style={{ fontWeight: '600', marginBottom: '2px', color: theme.colors.text }}>Feed URL:</div>
                    <a
                      href={feed.apiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: theme.colors.accentBlue,
                        textDecoration: 'none'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                    >
                      {feed.apiUrl.length > 60 ? feed.apiUrl.substring(0, 60) + '...' : feed.apiUrl}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '12px',
            color: theme.colors.textSecondary,
            fontSize: '14px'
          }}>
            Click "Show All" to view {integratedFeeds.length} integrated feeds
          </div>
        )}
      </div>

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
