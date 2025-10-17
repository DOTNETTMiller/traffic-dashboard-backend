import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';

export default function EventMessaging({ event, messages, onSendMessage, onClose }) {
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const [isUsernameSet, setIsUsernameSet] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Check if username is stored in localStorage
    const storedUsername = localStorage.getItem('dotUsername');
    if (storedUsername) {
      setUsername(storedUsername);
      setIsUsernameSet(true);
    }
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSetUsername = () => {
    if (username.trim()) {
      localStorage.setItem('dotUsername', username.trim());
      setIsUsernameSet(true);
    }
  };

  const handleSendMessage = () => {
    if (newMessage.trim() && isUsernameSet) {
      onSendMessage({
        eventId: event.id,
        username,
        message: newMessage.trim(),
        timestamp: new Date().toISOString()
      });
      setNewMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isUsernameSet) {
        handleSendMessage();
      } else {
        handleSetUsername();
      }
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

        {/* Username Setup */}
        {!isUsernameSet && (
          <div style={{
            padding: '20px',
            backgroundColor: '#eff6ff',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Enter your name to join the conversation:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Your name"
                autoFocus
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
              <button
                onClick={handleSetUsername}
                disabled={!username.trim()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: username.trim() ? 'pointer' : 'not-allowed',
                  opacity: username.trim() ? 1 : 0.5
                }}
              >
                Join
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          backgroundColor: '#f9fafb'
        }}>
          {messages.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: '#6b7280',
              padding: '40px 20px'
            }}>
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: msg.username === username ? '#dbeafe' : 'white',
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
                    {msg.username}
                  </span>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    {format(new Date(msg.timestamp), 'MMM d, h:mm a')}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                  {msg.message}
                </p>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {isUsernameSet && (
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid #e5e7eb',
            backgroundColor: 'white'
          }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message... (Press Enter to send)"
                rows={2}
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
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                  opacity: newMessage.trim() ? 1 : 0.5,
                  height: '40px'
                }}
              >
                Send
              </button>
            </div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
              Posting as: <strong>{username}</strong>
              {' '}
              <button
                onClick={() => {
                  localStorage.removeItem('dotUsername');
                  setIsUsernameSet(false);
                  setUsername('');
                }}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#3b82f6',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: '12px'
                }}
              >
                Change
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
