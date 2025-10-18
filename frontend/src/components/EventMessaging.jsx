import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import axios from 'axios';
import { config } from '../config';

export default function EventMessaging({ event, messages, onSendMessage, onClose }) {
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Check if user is logged in as a state
  const stateKey = localStorage.getItem('stateKey');
  const stateName = localStorage.getItem('stateName');
  const isStateLoggedIn = !!stateKey && !!stateName;

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
        setComments(response.data.comments);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !isStateLoggedIn) return;

    setLoading(true);
    try {
      // We need the password but don't store it - user will need to re-login periodically
      // For now, show message to login
      const response = await axios.post(
        `${config.apiUrl}/api/events/${event.id}/comments`,
        { comment: newComment.trim() },
        {
          headers: {
            Authorization: `State ${stateKey}:temp` // Password not stored
          }
        }
      );

      if (response.data.success) {
        setNewComment('');
        loadComments(); // Refresh comments
      }
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        alert('Session expired. Please log in again from the Messages tab.');
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

  if (!event) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>
              {event.eventType} - {event.state}
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
              {event.location}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '4px 8px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              fontSize: '24px',
              color: '#6b7280'
            }}
          >
            ×
          </button>
        </div>

        {/* State Login Notice */}
        {!isStateLoggedIn && (
          <div style={{
            padding: '20px',
            backgroundColor: '#fef3c7',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#92400e' }}>
              To comment on this event, please log in as your state from the <strong>Messages</strong> tab.
            </p>
          </div>
        )}

        {/* Comments */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          backgroundColor: '#f9fafb'
        }}>
          {comments.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: '#6b7280',
              padding: '40px 20px'
            }}>
              No comments yet. {isStateLoggedIn ? 'Start the conversation!' : 'Log in to add the first comment.'}
            </div>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                style={{
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: comment.state_key === stateKey ? '#dbeafe' : 'white',
                  borderRadius: '8px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '4px'
                }}>
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>
                    {comment.state_name}
                  </span>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '14px', whiteSpace: 'pre-wrap' }}>
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
            padding: '16px 20px',
            borderTop: '1px solid #e5e7eb',
            backgroundColor: 'white'
          }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a comment... (Press Enter to send)"
                rows={2}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  resize: 'none',
                  fontFamily: 'inherit'
                }}
              />
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim() || loading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: newComment.trim() && !loading ? 'pointer' : 'not-allowed',
                  opacity: newComment.trim() && !loading ? 1 : 0.5,
                  height: '40px'
                }}
              >
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
              Commenting as: <strong>{stateName}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
