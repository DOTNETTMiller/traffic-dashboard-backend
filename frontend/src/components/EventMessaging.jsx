import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import axios from 'axios';
import { config } from '../config';
import ComplianceGrades from './ComplianceGrades';

export default function EventMessaging({ event, messages, onSendMessage, onClose, currentUser }) {
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Check if user is logged in with a state affiliation
  // First check if user is logged in (new system)
  const user = currentUser || JSON.parse(localStorage.getItem('user') || 'null');
  const authToken = localStorage.getItem('authToken');

  // Fall back to old state login system
  const oldStateKey = localStorage.getItem('stateKey');
  const oldStateName = localStorage.getItem('stateName');
  const oldStatePassword = localStorage.getItem('statePassword');

  // Determine which auth system to use
  const stateKey = user?.stateKey || oldStateKey;
  const stateName = user?.organization || user?.fullName || oldStateName;
  const isAdmin = user?.role === 'admin';

  // Allow admins with authToken OR state-affiliated users with auth
  const isStateLoggedIn = !!(isAdmin && authToken) || !!(stateKey && (authToken || oldStatePassword));

  useEffect(() => {
    // Load comments for this event
    loadComments();
  }, [event.id]);

  useEffect(() => {
    // Auto-scroll to bottom when new comments arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const loadComments = async () => {
    try {
      const response = await axios.get(`${config.apiUrl}/api/events/${event.id}/comments`);
      if (response.data.success) {
        const loadedComments = Array.isArray(response.data.comments) ? response.data.comments : [];
        setComments(loadedComments);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !isStateLoggedIn) return;

    setLoading(true);
    try {
      // Use new user auth system with Bearer token if available, otherwise fall back to old state auth
      const authHeader = authToken
        ? `Bearer ${authToken}`
        : `State ${oldStateKey}:${oldStatePassword}`;

      const response = await axios.post(
        `${config.apiUrl}/api/events/${event.id}/comments`,
        { comment: newComment.trim() },
        {
          headers: {
            Authorization: authHeader
          }
        }
      );

      if (response.data.success) {
        setNewComment('');
        loadComments(); // Refresh comments

        // Notify parent component to update MessagesPanel
        if (onSendMessage && response.data.comment) {
          const messageForPanel = {
            eventId: event.id,
            sender: stateName,
            message: response.data.comment.comment,
            timestamp: response.data.comment.created_at,
            id: response.data.comment.id
          };
          onSendMessage(messageForPanel);
        }
      }
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        alert('Session expired. Please log in again.');
      } else {
        alert('Failed to add comment. Please try again.');
      }
      console.error('Error adding comment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && isStateLoggedIn) {
      e.preventDefault();
      handleAddComment();
    }
  };

  const safeComments = Array.isArray(comments) ? comments : [];

  // Group ALL duplicate messages (not just consecutive)
  const groupedComments = Object.values(
    safeComments.reduce((acc, comment) => {
      // Create a unique key for each message content + sender combo
      const key = `${comment.state_name}|${comment.comment}`;

      if (acc[key]) {
        // Add to existing group
        acc[key].count++;
        acc[key].timestamps.push(comment.created_at);
        // Keep earliest and latest timestamps
        acc[key].firstTimestamp = acc[key].firstTimestamp || comment.created_at;
        acc[key].latestTimestamp = comment.created_at;
      } else {
        // Start new group
        acc[key] = {
          ...comment,
          count: 1,
          timestamps: [comment.created_at],
          firstTimestamp: comment.created_at,
          latestTimestamp: comment.created_at
        };
      }

      return acc;
    }, {})
  ).sort((a, b) => new Date(b.latestTimestamp) - new Date(a.latestTimestamp)); // Sort by most recent

  if (!event) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.32)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        animation: 'cc-sheet-backdrop-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both'
      }}
    >
      <div style={{
        background: '#ffffff',
        borderRadius: '14px',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        width: '92%',
        maxWidth: '620px',
        maxHeight: '82vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 24px 48px rgba(0,0,0,0.16)',
        overflow: 'hidden',
        fontFamily: "'Inter Tight', -apple-system, BlinkMacSystemFont, sans-serif",
        color: '#1d1d1f',
        animation: 'cc-dialog-in 240ms cubic-bezier(0.32, 0.72, 0, 1) both'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px 14px',
          borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{
              margin: '0 0 4px 0',
              fontSize: '17px',
              fontWeight: 600,
              letterSpacing: '-0.022em',
              color: '#1d1d1f'
            }}>
              {event.eventType}
              <span style={{ color: '#6e6e73', fontWeight: 500, marginLeft: 6 }}>· {event.state}</span>
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#6e6e73' }}>
              {event.location}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              minWidth: 28,
              minHeight: 28,
              border: 'none',
              borderRadius: '999px',
              background: 'rgba(0, 0, 0, 0.05)',
              color: '#6e6e73',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
              transition: 'background-color 180ms cubic-bezier(0.32, 0.72, 0, 1)'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.10)'; e.currentTarget.style.color = '#1d1d1f'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'; e.currentTarget.style.color = '#6e6e73'; }}
          >
            ✕
          </button>
        </div>

        {/* Compliance grades — own row so they're always visible */}
        <div style={{
          padding: '12px 22px',
          borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
          background: '#f5f5f7'
        }}>
          <ComplianceGrades eventId={event.id} />
        </div>

        {/* State Login Notice */}
        {!isStateLoggedIn && (
          <div style={{
            padding: '14px 22px',
            background: 'rgba(0, 113, 227, 0.06)',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)'
          }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#0a4a8f' }}>
              To comment on this event, please log in as your state from the <strong>Messages</strong> tab.
            </p>
          </div>
        )}

        {/* Comments */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 22px',
          background: '#ffffff'
        }}>
          {groupedComments.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: '#6e6e73',
              padding: '40px 20px',
              fontSize: 13
            }}>
              No comments yet. {isStateLoggedIn ? 'Start the conversation!' : 'Log in to add the first comment.'}
            </div>
          ) : (
            groupedComments.map((comment) => (
              <div
                key={comment.id}
                style={{
                  marginBottom: 12,
                  padding: '12px 14px',
                  background: comment.state_key === stateKey ? 'rgba(0, 113, 227, 0.06)' : '#ffffff',
                  border: comment.state_key === stateKey
                    ? '1px solid rgba(0, 113, 227, 0.20)'
                    : '1px solid rgba(0, 0, 0, 0.08)',
                  borderRadius: 10
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                  gap: '12px'
                }}>
                  {/* Only show sender name if it's not "Matt's Experimental Sandbox" */}
                  <span style={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: '#1d1d1f',
                    flexShrink: 0,
                    letterSpacing: '-0.01em'
                  }}>
                    {comment.state_name !== "Matt's Experimental Sandbox" ? comment.state_name : 'System'}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                    {comment.count > 1 && (
                      <span style={{
                        fontSize: 10,
                        background: '#0071e3',
                        color: '#ffffff',
                        padding: '2px 7px',
                        borderRadius: 999,
                        fontWeight: 600,
                        flexShrink: 0,
                        letterSpacing: '0.02em',
                        fontVariantNumeric: 'tabular-nums'
                      }}>
                        ×{comment.count}
                      </span>
                    )}
                    <span style={{
                      fontSize: 11,
                      color: '#6e6e73',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {comment.count > 1
                        ? `${format(new Date(comment.firstTimestamp), 'MMM d')} – ${format(new Date(comment.latestTimestamp), 'MMM d')}`
                        : format(new Date(comment.latestTimestamp), 'MMM d, h:mm a')
                      }
                    </span>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: '#1d1d1f' }}>
                  {comment.comment}
                </p>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {isStateLoggedIn && (
          <div style={{
            padding: '14px 22px 16px',
            borderTop: '1px solid rgba(0, 0, 0, 0.08)',
            background: '#ffffff'
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a comment… (Press Enter to send)"
                rows={2}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  border: '1px solid rgba(0, 0, 0, 0.12)',
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  resize: 'none',
                  outline: 'none',
                  color: '#1d1d1f',
                  background: '#ffffff'
                }}
              />
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim() || loading}
                style={{
                  padding: '0 16px',
                  height: 36,
                  background: !newComment.trim() || loading ? '#c7c7cc' : '#0071e3',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 999,
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  cursor: newComment.trim() && !loading ? 'pointer' : 'not-allowed',
                  transition: 'background-color 200ms cubic-bezier(0.32, 0.72, 0, 1)'
                }}
              >
                {loading ? 'Sending…' : 'Send'}
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: '#6e6e73' }}>
              Commenting as <strong style={{ color: '#1d1d1f' }}>{stateName}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
