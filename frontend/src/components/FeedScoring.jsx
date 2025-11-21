import { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from '../config';
import FeedScoringModal from './FeedScoringModal';

export default function FeedScoring() {
  const [feeds, setFeeds] = useState([]);
  const [filteredFeeds, setFilteredFeeds] = useState([]);
  const [selectedFeed, setSelectedFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    fetchFeeds();
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    filterFeeds();
  }, [feeds, filterType, showIncompleteOnly]);

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const response = await axios.get(`${config.apiUrl}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCurrentUser(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch current user:', err);
    }
  };

  const fetchFeeds = async () => {
    try {
      const response = await axios.get(`${config.apiUrl}/api/data-quality/feeds`);
      setFeeds(response.data.feeds || []);
      setLoading(false);
    } catch (err) {
      setError('Failed to load feeds');
      setLoading(false);
      console.error(err);
    }
  };

  const filterFeeds = () => {
    let filtered = [...feeds];

    if (showIncompleteOnly) {
      filtered = filtered.filter(f => f.letter_grade === 'INCOMPLETE' || !f.dqi);
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(f => f.service_type === filterType);
    }

    setFilteredFeeds(filtered);
  };

  const handleSubmitScore = async (scoreData) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${config.apiUrl}/api/data-quality/submit-score`, scoreData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Refresh feeds
      await fetchFeeds();
      setSelectedFeed(null);

      alert('Score submitted successfully!');
    } catch (err) {
      console.error('Failed to submit score:', err);
      alert(`Failed to submit score: ${err.response?.data?.error || err.message}`);
    }
  };

  const getGradeColor = (grade) => {
    switch (grade) {
      case 'A': return '#10b981';
      case 'B': return '#3b82f6';
      case 'C': return '#f59e0b';
      case 'D': return '#f97316';
      case 'F': return '#ef4444';
      default: return '#9ca3af';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#6b7280' }}>Loading feeds...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#ef4444' }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: '#1f2937' }}>
          TETC Feed Scoring
        </h1>
        <p style={{ margin: '8px 0 0 0', fontSize: '16px', color: '#6b7280' }}>
          Score traffic data feeds using the MDODE framework
        </p>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '24px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '8px'
          }}>
            Service Type
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              padding: '8px 12px',
              fontSize: '14px',
              border: '2px solid #d1d5db',
              borderRadius: '6px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Types</option>
            <option value="travel_time_speed">Travel Time & Speed</option>
            <option value="volume">Volume</option>
            <option value="origin_destination">Origin-Destination</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '28px' }}>
          <input
            type="checkbox"
            id="incomplete-only"
            checked={showIncompleteOnly}
            onChange={(e) => setShowIncompleteOnly(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <label htmlFor="incomplete-only" style={{ fontSize: '14px', color: '#374151', cursor: 'pointer' }}>
            Show incomplete only
          </label>
        </div>

        <div style={{ marginLeft: 'auto', marginTop: '28px', fontSize: '14px', color: '#6b7280' }}>
          Showing {filteredFeeds.length} of {feeds.length} feeds
        </div>
      </div>

      {/* Feeds List */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
        gap: '20px'
      }}>
        {filteredFeeds.map((feed, idx) => (
          <div key={idx} style={{
            backgroundColor: 'white',
            border: '2px solid #e5e7eb',
            borderRadius: '12px',
            padding: '20px',
            transition: 'all 0.2s',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#3b82f6';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e5e7eb';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
          }}>
            {/* Provider Badge */}
            <div style={{
              display: 'inline-block',
              padding: '4px 12px',
              backgroundColor: '#f3f4f6',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '12px'
            }}>
              {feed.provider}
            </div>

            {/* Feed Name */}
            <h3 style={{
              margin: '0 0 8px 0',
              fontSize: '18px',
              fontWeight: '700',
              color: '#1f2937'
            }}>
              {feed.feed_name}
            </h3>

            {/* Service Type */}
            <p style={{
              margin: '0 0 16px 0',
              fontSize: '14px',
              color: '#6b7280'
            }}>
              {feed.service_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </p>

            {/* Current Grade */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <div style={{
                width: '50px',
                height: '50px',
                backgroundColor: getGradeColor(feed.letter_grade),
                color: 'white',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: '700'
              }}>
                {feed.letter_grade === 'INCOMPLETE' ? '?' : feed.letter_grade}
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>
                  {feed.dqi ? 'Current DQI' : 'Not Scored'}
                </div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#1f2937' }}>
                  {feed.dqi ? feed.dqi.toFixed(1) : 'N/A'}
                </div>
              </div>
            </div>

            {/* Score Button */}
            <button
              onClick={() => setSelectedFeed(feed)}
              disabled={!currentUser}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: currentUser ? '#3b82f6' : '#d1d5db',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: currentUser ? 'pointer' : 'not-allowed',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (currentUser) e.target.style.backgroundColor = '#2563eb';
              }}
              onMouseLeave={(e) => {
                if (currentUser) e.target.style.backgroundColor = '#3b82f6';
              }}
            >
              {currentUser ? (feed.dqi ? 'Update Score' : 'Score Feed') : 'Login to Score'}
            </button>
          </div>
        ))}
      </div>

      {filteredFeeds.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#f9fafb',
          borderRadius: '12px',
          border: '2px dashed #d1d5db'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
            No feeds found
          </div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            {showIncompleteOnly ? 'All feeds have been scored!' : 'Try adjusting your filters'}
          </div>
        </div>
      )}

      {/* Scoring Modal */}
      {selectedFeed && (
        <FeedScoringModal
          feed={selectedFeed}
          currentUser={currentUser}
          onClose={() => setSelectedFeed(null)}
          onSubmit={handleSubmitScore}
        />
      )}
    </div>
  );
}
