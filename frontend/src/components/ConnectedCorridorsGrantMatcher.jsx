import { useState, useEffect } from 'react';
import api from '../services/api';

export default function ConnectedCorridorsGrantMatcher({ user, darkMode = false }) {
  const [projectData, setProjectData] = useState({
    description: '',
    primaryCorridor: '',
    requestedAmount: '',
    geographicScope: 'state'
  });

  const [results, setResults] = useState(null);
  const [liveOpportunities, setLiveOpportunities] = useState([]);
  const [deadlineAlerts, setDeadlineAlerts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchingLive, setSearchingLive] = useState(false);
  const [monitoringDeadlines, setMonitoringDeadlines] = useState(false);
  const [activeView, setActiveView] = useState('matcher'); // 'matcher', 'live', 'deadlines'

  const theme = {
    bg: darkMode ? '#0f172a' : '#ffffff',
    bgSecondary: darkMode ? '#1e293b' : '#f8fafc',
    bgTertiary: darkMode ? '#334155' : '#f1f5f9',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    textMuted: darkMode ? '#64748b' : '#94a3b8',
    border: darkMode ? '#334155' : '#e2e8f0',
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    primaryLight: darkMode ? '#1e3a8a' : '#dbeafe',
    accent: '#8b5cf6',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    shadow: darkMode
      ? '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
      : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  };

  // Auto-load deadline alerts on mount
  useEffect(() => {
    fetchDeadlineAlerts();
  }, []);

  const handleConnectedCorridorsMatch = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/api/grants/connected-corridors-match', {
        ...projectData,
        stateKey: user?.stateKey
      });

      if (response.data.success) {
        setResults(response.data);
      }
    } catch (error) {
      console.error('Error matching grants:', error);
      alert('Failed to match grants. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const searchLiveGrants = async () => {
    setSearchingLive(true);

    try {
      const response = await api.post('/api/grants/search-live', {
        keyword: projectData.description || 'intelligent transportation systems connected vehicles',
        fundingAgency: 'DOT',
        status: 'forecasted,posted'
      });

      if (response.data.success) {
        setLiveOpportunities(response.data.opportunities);
        setActiveView('live');
      }
    } catch (error) {
      console.error('Error searching live grants:', error);
      alert('Failed to search Grants.gov. Please try again.');
    } finally {
      setSearchingLive(false);
    }
  };

  const fetchDeadlineAlerts = async () => {
    setMonitoringDeadlines(true);

    try {
      const response = await api.get('/api/grants/monitor-deadlines', {
        params: {
          stateKey: user?.stateKey,
          daysAhead: 60
        }
      });

      if (response.data.success) {
        setDeadlineAlerts(response.data.deadlineAlerts);
      }
    } catch (error) {
      console.error('Error fetching deadlines:', error);
    } finally {
      setMonitoringDeadlines(false);
    }
  };

  const styles = {
    container: {
      background: theme.bg,
      minHeight: '100vh',
      padding: '24px',
    },
    card: {
      background: theme.bgSecondary,
      borderRadius: '16px',
      padding: '24px',
      boxShadow: theme.shadow,
      border: `1px solid ${theme.border}`,
      marginBottom: '24px',
    },
    input: {
      width: '100%',
      padding: '12px 16px',
      background: theme.bgTertiary,
      border: `2px solid ${theme.border}`,
      borderRadius: '10px',
      fontSize: '14px',
      color: theme.text,
      outline: 'none',
      transition: 'all 0.2s ease',
    },
    button: {
      padding: '12px 24px',
      background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryHover} 100%)`,
      color: 'white',
      border: 'none',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      boxShadow: theme.shadow,
      transition: 'all 0.3s ease',
    },
    label: {
      display: 'block',
      marginBottom: '8px',
      fontWeight: '600',
      fontSize: '13px',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    },
  };

  return (
    <div style={styles.container}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            margin: 0,
            fontSize: '32px',
            fontWeight: '800',
            background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.accent} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '12px',
          }}>
            🛣️ Connected Corridors Grant Matcher
          </h1>
          <p style={{
            margin: 0,
            color: theme.textSecondary,
            fontSize: '15px',
            lineHeight: '1.6',
          }}>
            Find funding opportunities aligned with your connected corridors strategy.
            Combines expert recommendations with live Grants.gov data and deadline monitoring.
          </p>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '8px',
          borderBottom: `2px solid ${theme.border}`,
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}>
          <TabButton
            active={activeView === 'matcher'}
            onClick={() => setActiveView('matcher')}
            label="🎯 Smart Matcher"
            theme={theme}
          />
          <TabButton
            active={activeView === 'live'}
            onClick={() => setActiveView('live')}
            label="🔴 Live Opportunities"
            count={liveOpportunities.length}
            theme={theme}
          />
          <TabButton
            active={activeView === 'deadlines'}
            onClick={() => setActiveView('deadlines')}
            label="⏰ Deadline Alerts"
            count={deadlineAlerts?.total || 0}
            urgent={deadlineAlerts?.critical?.length > 0}
            theme={theme}
          />
        </div>

        {/* Deadline Alerts Banner (Always visible if critical) */}
        {deadlineAlerts && deadlineAlerts.critical.length > 0 && (
          <div style={{
            background: darkMode ? '#7f1d1d' : '#fee2e2',
            border: `2px solid ${theme.error}`,
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{ fontSize: '24px' }}>🚨</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: darkMode ? '#fca5a5' : '#991b1b', marginBottom: '4px' }}>
                CRITICAL: {deadlineAlerts.critical.length} grant{deadlineAlerts.critical.length !== 1 ? 's' : ''} closing within 14 days!
              </div>
              <div style={{ fontSize: '13px', color: darkMode ? '#fca5a5' : '#991b1b', opacity: 0.9 }}>
                {deadlineAlerts.critical[0].title} closes in {deadlineAlerts.critical[0].daysUntilClose} day{deadlineAlerts.critical[0].daysUntilClose !== 1 ? 's' : ''}
              </div>
            </div>
            <button
              onClick={() => setActiveView('deadlines')}
              style={{
                padding: '8px 16px',
                background: theme.error,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              View All
            </button>
          </div>
        )}

        {/* Tab Content */}
        {activeView === 'matcher' && (
          <MatcherView
            projectData={projectData}
            setProjectData={setProjectData}
            results={results}
            loading={loading}
            handleSubmit={handleConnectedCorridorsMatch}
            theme={theme}
            styles={styles}
          />
        )}

        {activeView === 'live' && (
          <LiveOpportunitiesView
            opportunities={liveOpportunities}
            searching={searchingLive}
            onSearch={searchLiveGrants}
            theme={theme}
            styles={styles}
          />
        )}

        {activeView === 'deadlines' && (
          <DeadlineAlertsView
            alerts={deadlineAlerts}
            monitoring={monitoringDeadlines}
            onRefresh={fetchDeadlineAlerts}
            theme={theme}
            styles={styles}
          />
        )}
      </div>
    </div>
  );
}

// Tab Button Component
function TabButton({ active, onClick, label, count, urgent, theme }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 24px',
        border: 'none',
        background: active ? theme.primary : 'transparent',
        color: active ? '#ffffff' : theme.text,
        borderBottom: active ? `3px solid ${theme.primary}` : 'none',
        fontWeight: active ? '600' : '400',
        cursor: 'pointer',
        fontSize: '15px',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {label}
      {count > 0 && (
        <span style={{
          padding: '2px 8px',
          borderRadius: '12px',
          background: urgent ? theme.error : active ? 'rgba(255,255,255,0.2)' : theme.primaryLight,
          color: urgent ? 'white' : active ? 'white' : theme.primary,
          fontSize: '12px',
          fontWeight: '700',
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

// Matcher View Component
function MatcherView({ projectData, setProjectData, results, loading, handleSubmit, theme, styles }) {
  return (
    <>
      {/* Input Form */}
      <div style={styles.card}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '700', color: theme.text }}>
          Describe Your Connected Corridors Project
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '20px' }}>
            <div>
              <label style={styles.label}>Project Description *</label>
              <textarea
                required
                value={projectData.description}
                onChange={e => setProjectData({ ...projectData, description: e.target.value })}
                rows={4}
                placeholder="Describe your connected corridors project (e.g., Deploy V2X infrastructure, connected vehicle systems, ITS integration...)"
                style={{
                  ...styles.input,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
              <div>
                <label style={styles.label}>Primary Corridor</label>
                <input
                  type="text"
                  value={projectData.primaryCorridor}
                  onChange={e => setProjectData({ ...projectData, primaryCorridor: e.target.value })}
                  placeholder="e.g., I-80, I-35"
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>Requested Amount ($)</label>
                <input
                  type="number"
                  value={projectData.requestedAmount}
                  onChange={e => setProjectData({ ...projectData, requestedAmount: e.target.value })}
                  placeholder="5000000"
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>Geographic Scope</label>
                <select
                  value={projectData.geographicScope}
                  onChange={e => setProjectData({ ...projectData, geographicScope: e.target.value })}
                  style={styles.input}
                >
                  <option value="state">State</option>
                  <option value="regional">Regional</option>
                  <option value="multi-state">Multi-State</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.button,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '🔄 Analyzing...' : '🎯 Find Matching Grants'}
            </button>
          </div>
        </form>
      </div>

      {/* Results */}
      {results && (
        <>
          {/* Connected Corridors Strategy Alignment */}
          <div style={styles.card}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: theme.text }}>
              📊 Connected Corridors Strategy Alignment
            </h3>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              marginBottom: '20px',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '48px',
                  fontWeight: '800',
                  color: results.connectedCorridorsStrategy.alignmentScore >= 70 ? theme.success :
                         results.connectedCorridorsStrategy.alignmentScore >= 40 ? theme.warning : theme.error,
                }}>
                  {results.connectedCorridorsStrategy.alignmentScore}%
                </div>
                <div style={{ fontSize: '13px', color: theme.textSecondary, fontWeight: '600' }}>
                  Strategy Alignment Score
                </div>
              </div>

              <div style={{ flex: 2 }}>
                <div style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>
                  Key Focus Areas:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {results.connectedCorridorsStrategy.keyFocusAreas.map((area, idx) => (
                    <span key={idx} style={{
                      padding: '6px 12px',
                      background: theme.primaryLight,
                      color: theme.primary,
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                    }}>
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Strategy Recommendations */}
            <div>
              <div style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
                Strategic Recommendations:
              </div>
              <div style={{ display: 'grid', gap: '12px' }}>
                {results.connectedCorridorsStrategy.recommendations.map((rec, idx) => (
                  <div key={idx} style={{
                    padding: '16px',
                    background: theme.bgTertiary,
                    borderRadius: '12px',
                    borderLeft: `4px solid ${
                      rec.priority === 'CRITICAL' ? theme.error :
                      rec.priority === 'HIGH' ? theme.warning :
                      theme.primary
                    }`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: theme.text }}>{rec.area}</span>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        background: rec.priority === 'CRITICAL' ? theme.error :
                                  rec.priority === 'HIGH' ? theme.warning : theme.primary,
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: '700',
                      }}>
                        {rec.priority}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: theme.textSecondary, lineHeight: '1.6' }}>
                      {rec.suggestion}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Curated Grant Matches */}
          {results.curatedGrants && results.curatedGrants.length > 0 && (
            <div style={styles.card}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: theme.text }}>
                ✅ Top Curated Grant Matches
              </h3>
              <div style={{ display: 'grid', gap: '16px' }}>
                {results.curatedGrants.map((grant, idx) => (
                  <GrantCard key={idx} grant={grant} theme={theme} source="curated" />
                ))}
              </div>
            </div>
          )}

          {/* Live Opportunities */}
          {results.liveOpportunities && results.liveOpportunities.length > 0 && (
            <div style={styles.card}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: theme.text }}>
                🔴 Live Grants.gov Opportunities
              </h3>
              <div style={{ display: 'grid', gap: '16px' }}>
                {results.liveOpportunities.map((opp, idx) => (
                  <LiveOpportunityCard key={idx} opportunity={opp} theme={theme} />
                ))}
              </div>
            </div>
          )}

          {/* Block Grants */}
          {results.blockGrants && results.blockGrants.length > 0 && (
            <div style={styles.card}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: theme.text }}>
                📦 Block Grant Options
              </h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                {results.blockGrants.map((grant, idx) => (
                  <BlockGrantCard key={idx} grant={grant} theme={theme} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

// Live Opportunities View
function LiveOpportunitiesView({ opportunities, searching, onSearch, theme, styles }) {
  return (
    <div style={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: theme.text }}>
          Live Grant Opportunities from Grants.gov
        </h2>
        <button
          onClick={onSearch}
          disabled={searching}
          style={{
            ...styles.button,
            opacity: searching ? 0.6 : 1,
            cursor: searching ? 'not-allowed' : 'pointer',
          }}
        >
          {searching ? '🔄 Searching...' : '🔍 Search Now'}
        </button>
      </div>

      {opportunities.length === 0 ? (
        <div style={{
          padding: '60px 20px',
          textAlign: 'center',
          color: theme.textSecondary,
          background: theme.bgTertiary,
          borderRadius: '12px',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
            No live opportunities loaded yet
          </div>
          <div style={{ fontSize: '14px' }}>
            Click "Search Now" to fetch current opportunities from Grants.gov
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {opportunities.map((opp, idx) => (
            <LiveOpportunityCard key={idx} opportunity={opp} theme={theme} expanded />
          ))}
        </div>
      )}
    </div>
  );
}

// Deadline Alerts View
function DeadlineAlertsView({ alerts, monitoring, onRefresh, theme, styles }) {
  return (
    <div>
      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: theme.text }}>
            Deadline Monitoring (Next 60 Days)
          </h2>
          <button
            onClick={onRefresh}
            disabled={monitoring}
            style={{
              ...styles.button,
              opacity: monitoring ? 0.6 : 1,
              cursor: monitoring ? 'not-allowed' : 'pointer',
            }}
          >
            {monitoring ? '🔄 Refreshing...' : '🔄 Refresh'}
          </button>
        </div>

        {!alerts ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: theme.textSecondary,
          }}>
            Loading deadline alerts...
          </div>
        ) : alerts.total === 0 ? (
          <div style={{
            padding: '60px 20px',
            textAlign: 'center',
            color: theme.textSecondary,
            background: theme.bgTertiary,
            borderRadius: '12px',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>
              No upcoming deadlines in the next 60 days
            </div>
          </div>
        ) : (
          <>
            {/* Critical Alerts */}
            {alerts.critical.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '700', color: theme.error }}>
                  🚨 CRITICAL (Closing within 14 days)
                </h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {alerts.critical.map((alert, idx) => (
                    <DeadlineAlert key={idx} alert={alert} urgency="critical" theme={theme} />
                  ))}
                </div>
              </div>
            )}

            {/* High Priority Alerts */}
            {alerts.high.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '700', color: theme.warning }}>
                  ⚠️ HIGH PRIORITY (Closing within 30 days)
                </h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {alerts.high.map((alert, idx) => (
                    <DeadlineAlert key={idx} alert={alert} urgency="high" theme={theme} />
                  ))}
                </div>
              </div>
            )}

            {/* Medium Priority Alerts */}
            {alerts.medium.length > 0 && (
              <div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '700', color: theme.primary }}>
                  📅 Upcoming (31-60 days)
                </h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {alerts.medium.map((alert, idx) => (
                    <DeadlineAlert key={idx} alert={alert} urgency="medium" theme={theme} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Grant Card Component
function GrantCard({ grant, theme, source }) {
  return (
    <div style={{
      padding: '20px',
      background: theme.bgTertiary,
      borderRadius: '12px',
      borderLeft: `4px solid ${theme.primary}`,
      transition: 'all 0.2s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: theme.text }}>
            {grant.name}
          </h4>
          <div style={{ fontSize: '13px', color: theme.textSecondary }}>
            {grant.fullName}
          </div>
        </div>
        <div style={{
          padding: '6px 12px',
          borderRadius: '20px',
          background: grant.score >= 80 ? theme.success : grant.score >= 60 ? theme.warning : theme.primary,
          color: 'white',
          fontSize: '13px',
          fontWeight: '700',
        }}>
          {grant.score}% Match
        </div>
      </div>

      {grant.explanation && grant.explanation.length > 0 && (
        <ul style={{ margin: '12px 0', padding: '0 0 0 20px', fontSize: '13px', color: theme.textSecondary }}>
          {grant.explanation.map((reason, idx) => (
            <li key={idx} style={{ marginBottom: '4px' }}>{reason}</li>
          ))}
        </ul>
      )}

      {grant.keyIndicators && (
        <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {grant.keyIndicators.slice(0, 4).map((indicator, idx) => (
            <span key={idx} style={{
              padding: '4px 10px',
              background: theme.primaryLight,
              color: theme.primary,
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '600',
            }}>
              {indicator}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Live Opportunity Card
function LiveOpportunityCard({ opportunity, theme, expanded = false }) {
  return (
    <div style={{
      padding: '20px',
      background: theme.bgTertiary,
      borderRadius: '12px',
      borderLeft: `4px solid ${opportunity.closingSoon ? theme.error : theme.success}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: theme.text }}>
              {opportunity.title}
            </h4>
            {opportunity.status === 'posted' && (
              <span style={{
                padding: '3px 8px',
                background: theme.success,
                color: 'white',
                borderRadius: '10px',
                fontSize: '10px',
                fontWeight: '700',
                textTransform: 'uppercase',
              }}>
                ● OPEN
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: theme.textMuted, marginBottom: '4px' }}>
            {opportunity.agency} • Opportunity #{opportunity.opportunityNumber}
          </div>
        </div>
      </div>

      {expanded && opportunity.description && (
        <div style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '12px', lineHeight: '1.6' }}>
          {opportunity.description.slice(0, 200)}...
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '12px', fontSize: '13px' }}>
        {opportunity.daysUntilClose !== null && (
          <div>
            <span style={{ color: theme.textMuted }}>Closes in:</span>{' '}
            <span style={{
              fontWeight: '700',
              color: opportunity.closingSoon ? theme.error : theme.text,
            }}>
              {opportunity.daysUntilClose} days
            </span>
          </div>
        )}
        {opportunity.awardCeiling && (
          <div>
            <span style={{ color: theme.textMuted }}>Award Ceiling:</span>{' '}
            <span style={{ fontWeight: '700', color: theme.text }}>
              ${(opportunity.awardCeiling / 1000000).toFixed(1)}M
            </span>
          </div>
        )}
        {opportunity.matchScore && (
          <div>
            <span style={{ color: theme.textMuted }}>Match:</span>{' '}
            <span style={{ fontWeight: '700', color: theme.primary }}>
              {opportunity.matchScore}%
            </span>
          </div>
        )}
      </div>

      <a
        href={opportunity.grantsGovLink}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-block',
          padding: '8px 16px',
          background: theme.primary,
          color: 'white',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: '600',
          textDecoration: 'none',
          transition: 'all 0.2s ease',
        }}
      >
        View on Grants.gov →
      </a>
    </div>
  );
}

// Block Grant Card
function BlockGrantCard({ grant, theme }) {
  return (
    <div style={{
      padding: '16px',
      background: theme.bgTertiary,
      borderRadius: '10px',
      border: `1px solid ${theme.border}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '700', color: theme.text }}>
            {grant.name}
          </h4>
          <div style={{ fontSize: '12px', color: theme.textMuted }}>
            {grant.type} • Administered by {grant.administered}
          </div>
        </div>
        <div style={{
          padding: '4px 10px',
          borderRadius: '12px',
          background: theme.primaryLight,
          color: theme.primary,
          fontSize: '12px',
          fontWeight: '700',
        }}>
          {grant.score}%
        </div>
      </div>
      <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '8px' }}>
        {grant.focus}
      </div>
    </div>
  );
}

// Deadline Alert Component
function DeadlineAlert({ alert, urgency, theme }) {
  const urgencyColors = {
    critical: { bg: theme.error, text: 'white' },
    high: { bg: theme.warning, text: 'white' },
    medium: { bg: theme.primary, text: 'white' },
  };

  return (
    <div style={{
      padding: '16px',
      background: theme.bgTertiary,
      borderRadius: '10px',
      borderLeft: `4px solid ${urgencyColors[urgency].bg}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '16px',
    }}>
      <div style={{ flex: 1 }}>
        <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '700', color: theme.text }}>
          {alert.title}
        </h4>
        <div style={{ fontSize: '12px', color: theme.textMuted }}>
          {alert.agency}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontSize: '24px',
          fontWeight: '800',
          color: urgencyColors[urgency].bg,
          marginBottom: '2px',
        }}>
          {alert.daysUntilClose}
        </div>
        <div style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase' }}>
          days left
        </div>
      </div>
      <a
        href={alert.grantsGovLink}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          padding: '8px 16px',
          background: urgencyColors[urgency].bg,
          color: urgencyColors[urgency].text,
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: '600',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Apply Now →
      </a>
    </div>
  );
}
