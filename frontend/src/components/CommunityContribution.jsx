import React, { useState, useEffect } from 'react';
import api from '../services/api';

const CommunityContribution = () => {
  const [activeTab, setActiveTab] = useState('gaps');
  const [gaps, setGaps] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [votedStates, setVotedStates] = useState(new Set());

  // Form state
  const [formData, setFormData] = useState({
    contribution_type: 'missing_state_feed',
    state_code: '',
    feed_url: '',
    feed_name: '',
    feed_description: '',
    contact_email: '',
    contact_name: ''
  });

  const [submitStatus, setSubmitStatus] = useState(null);

  useEffect(() => {
    fetchGaps();
    fetchStatus();
  }, []);

  const fetchGaps = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/community/gaps');
      if (response.data.success) {
        setGaps(response.data.gaps);
      }
    } catch (error) {
      console.error('Error fetching gaps:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const response = await api.get('/api/community/status');
      if (response.data.success) {
        setStatus(response.data);
      }
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  const handleVote = async (stateCode) => {
    try {
      const response = await api.post('/api/community/vote', {
        state_code: stateCode
      });

      if (response.data.success) {
        // Update local state
        const newVotedStates = new Set(votedStates);
        if (response.data.action === 'added') {
          newVotedStates.add(stateCode);
        } else {
          newVotedStates.delete(stateCode);
        }
        setVotedStates(newVotedStates);

        // Refresh data
        fetchGaps();
        fetchStatus();
      }
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setSubmitStatus(null);

      const response = await api.post('/api/community/contribute', formData);

      if (response.data.success) {
        setSubmitStatus({
          type: 'success',
          message: 'Thank you for your contribution! We will review it shortly.'
        });

        // Reset form
        setFormData({
          contribution_type: 'missing_state_feed',
          state_code: '',
          feed_url: '',
          feed_name: '',
          feed_description: '',
          contact_email: '',
          contact_name: ''
        });

        // Hide form after 3 seconds
        setTimeout(() => {
          setShowForm(false);
          setSubmitStatus(null);
        }, 3000);
      }
    } catch (error) {
      setSubmitStatus({
        type: 'error',
        message: error.response?.data?.error || 'Failed to submit contribution'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const USStates = [
    { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
    { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
    { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
    { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
    { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
    { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
    { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
    { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
    { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
    { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
    { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
    { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
    { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
    { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
    { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
    { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
    { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
  ];

  return (
    <div className="community-contribution">
      <div className="header">
        <h2>Community Contribution - Build the NAPcore Killer Together</h2>
        <p className="subtitle">
          This is a free, open, public service. Help us achieve 50-state coverage!
        </p>
        <button
          className="btn-primary btn-contribute"
          onClick={() => setShowForm(!showForm)}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#111827',
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 'bold',
            fontSize: '16px',
            cursor: 'pointer',
            marginTop: '16px'
          }}
        >
          {showForm ? 'Cancel' : 'Report Missing Data'}
        </button>
      </div>

      {showForm && (
        <div className="contribution-form" style={{
          background: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          marginTop: '24px'
        }}>
          <h3>Submit Missing State Data</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Contribution Type</label>
              <select
                name="contribution_type"
                value={formData.contribution_type}
                onChange={handleFormChange}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  marginTop: '4px'
                }}
              >
                <option value="missing_state_feed">Missing State Feed</option>
                <option value="data_quality_issue">Data Quality Issue</option>
                <option value="new_data_source">New Data Source</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label>State</label>
              <select
                name="state_code"
                value={formData.state_code}
                onChange={handleFormChange}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  marginTop: '4px'
                }}
              >
                <option value="">Select a state...</option>
                {USStates.map(state => (
                  <option key={state.code} value={state.code}>
                    {state.name} ({state.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label>Feed URL</label>
              <input
                type="url"
                name="feed_url"
                value={formData.feed_url}
                onChange={handleFormChange}
                placeholder="https://example.com/traffic-feed.json"
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  marginTop: '4px'
                }}
              />
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label>Feed Name</label>
              <input
                type="text"
                name="feed_name"
                value={formData.feed_name}
                onChange={handleFormChange}
                placeholder="e.g., State DOT 511 Feed"
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  marginTop: '4px'
                }}
              />
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label>Description</label>
              <textarea
                name="feed_description"
                value={formData.feed_description}
                onChange={handleFormChange}
                placeholder="Describe the feed and what data it provides..."
                rows="3"
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  marginTop: '4px',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label>Your Name (Optional)</label>
              <input
                type="text"
                name="contact_name"
                value={formData.contact_name}
                onChange={handleFormChange}
                placeholder="For attribution"
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  marginTop: '4px'
                }}
              />
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label>Your Email (Optional)</label>
              <input
                type="email"
                name="contact_email"
                value={formData.contact_email}
                onChange={handleFormChange}
                placeholder="For follow-up questions"
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  marginTop: '4px'
                }}
              />
            </div>

            {submitStatus && (
              <div
                className={`alert alert-${submitStatus.type}`}
                style={{
                  padding: '12px',
                  borderRadius: '4px',
                  marginTop: '16px',
                  background: submitStatus.type === 'success' ? '#d4edda' : '#f8d7da',
                  color: submitStatus.type === 'success' ? '#155724' : '#721c24',
                  border: `1px solid ${submitStatus.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`
                }}
              >
                {submitStatus.message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: '#28a745',
                color: '#111827',
                padding: '10px 20px',
                borderRadius: '4px',
                border: 'none',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '16px',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Submitting...' : 'Submit Contribution'}
            </button>
          </form>
        </div>
      )}

      <div className="tabs" style={{ marginTop: '32px' }}>
        <button
          className={`tab ${activeTab === 'gaps' ? 'active' : ''}`}
          onClick={() => setActiveTab('gaps')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'gaps' ? '#667eea' : '#f0f0f0',
            color: activeTab === 'gaps' ? 'white' : '#333',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            marginRight: '4px'
          }}
        >
          Missing States ({gaps.length})
        </button>
        <button
          className={`tab ${activeTab === 'progress' ? 'active' : ''}`}
          onClick={() => setActiveTab('progress')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'progress' ? '#667eea' : '#f0f0f0',
            color: activeTab === 'progress' ? 'white' : '#333',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer'
          }}
        >
          Overall Progress
        </button>
      </div>

      <div className="tab-content" style={{
        background: 'white',
        padding: '24px',
        borderRadius: '0 12px 12px 12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        {activeTab === 'gaps' && (
          <div className="gaps-list">
            <p style={{ marginBottom: '16px', color: '#666' }}>
              Vote for states you need most. Your votes help us prioritize!
            </p>
            {loading ? (
              <p>Loading...</p>
            ) : (
              <div className="state-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '16px'
              }}>
                {gaps.map(gap => (
                  <div
                    key={gap.state_code}
                    className="state-card"
                    style={{
                      background: '#f9f9f9',
                      padding: '16px',
                      borderRadius: '8px',
                      border: '1px solid #e0e0e0'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <h4 style={{ margin: 0 }}>{gap.state_name}</h4>
                        <p style={{ margin: '4px 0', fontSize: '14px', color: '#666' }}>
                          {gap.status === 'not_started' ? 'Not Started' : 'In Progress'}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '24px',
                          fontWeight: 'bold',
                          color: '#667eea'
                        }}>
                          {gap.vote_count}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999' }}>votes</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleVote(gap.state_code)}
                      style={{
                        marginTop: '12px',
                        width: '100%',
                        padding: '8px',
                        background: votedStates.has(gap.state_code) ? '#6c757d' : '#667eea',
                        color: '#111827',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      {votedStates.has(gap.state_code) ? 'Remove Vote' : 'Vote for This State'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'progress' && status && (
          <div className="progress-view">
            <div className="stats-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '32px'
            }}>
              <div className="stat-card" style={{
                background: '#d4edda',
                padding: '20px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#155724' }}>
                  {status.summary.completed}
                </div>
                <div style={{ color: '#155724', fontWeight: 'bold' }}>States Live</div>
              </div>
              <div className="stat-card" style={{
                background: '#fff3cd',
                padding: '20px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#856404' }}>
                  {status.summary.in_progress}
                </div>
                <div style={{ color: '#856404', fontWeight: 'bold' }}>In Progress</div>
              </div>
              <div className="stat-card" style={{
                background: '#f8d7da',
                padding: '20px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#721c24' }}>
                  {status.summary.not_started}
                </div>
                <div style={{ color: '#721c24', fontWeight: 'bold' }}>Not Started</div>
              </div>
              <div className="stat-card" style={{
                background: '#e7f3ff',
                padding: '20px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#004085' }}>
                  {Math.round((status.summary.completed / status.summary.total) * 100)}%
                </div>
                <div style={{ color: '#004085', fontWeight: 'bold' }}>Complete</div>
              </div>
            </div>

            <div className="progress-bar" style={{
              background: '#e0e0e0',
              height: '30px',
              borderRadius: '15px',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <div style={{
                background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                height: '100%',
                width: `${(status.summary.completed / status.summary.total) * 100}%`,
                transition: 'width 0.3s ease'
              }}></div>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: '#111827',
                fontWeight: 'bold',
                textShadow: '0 1px 2px rgba(0,0,0,0.5)'
              }}>
                {status.summary.completed} / {status.summary.total} States
              </div>
            </div>

            <div style={{ marginTop: '32px' }}>
              <h3>Mission: The NAPcore Killer</h3>
              <p style={{ color: '#666', lineHeight: '1.6' }}>
                Together, we're building the first free, open, interstate-focused traffic data platform.
                Europe's NAPcore charges €50K-200K per state annually. We believe transportation data
                should be freely accessible to all: state DOTs, trucking companies, emergency responders,
                and the traveling public.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunityContribution;

