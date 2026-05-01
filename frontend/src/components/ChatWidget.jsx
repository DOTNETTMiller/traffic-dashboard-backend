import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { config } from '../config';

export default function ChatWidget({ user, context, isDarkMode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load chat history when widget opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadHistory();
    }
  }, [isOpen]);

  // Auto-trigger corridor briefing when corridor context changes
  useEffect(() => {
    if (context && context.type === 'corridor' && context.data.corridor && isOpen) {
      // Check if we've already sent a briefing for this corridor
      const lastMessage = messages[messages.length - 1];
      const corridorName = context.data.corridor;

      // Only trigger if the last message wasn't about this corridor
      if (!lastMessage || !lastMessage.message.includes(corridorName)) {
        triggerCorridorBriefing(corridorName);
      }
    }
  }, [context, isOpen, messages]);

  const triggerCorridorBriefing = async (corridor) => {
    const briefingPrompt = `Please provide a brief corridor summary for ${corridor} including bridge clearances, regulations, and what drivers should expect.`;

    setIsLoading(true);

    // Add auto-generated prompt to UI
    const userMsg = {
      role: 'user',
      message: briefingPrompt,
      createdAt: new Date().toISOString(),
      isAuto: true
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.post(
        `${config.apiUrl}/api/chat`,
        { message: briefingPrompt, context },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const assistantMsg = {
          role: 'assistant',
          message: response.data.message,
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (err) {
      console.error('Error getting corridor briefing:', err);
      setMessages(prev => prev.filter(m => m !== userMsg));
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${config.apiUrl}/api/chat/history?limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setMessages(response.data.messages);
      }
    } catch (err) {
      console.error('Error loading chat history:', err);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    // Add user message to UI immediately
    const userMsg = {
      role: 'user',
      message: userMessage,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.post(
        `${config.apiUrl}/api/chat`,
        { message: userMessage, context },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        // Add assistant response
        const assistantMsg = {
          role: 'assistant',
          message: response.data.message,
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      let errorMessage = 'Failed to send message. Please try again.';

      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);

      // Remove the user message on error
      setMessages(prev => prev.filter(m => m !== userMsg));
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!window.confirm('Clear all chat history?')) return;

    try {
      const token = localStorage.getItem('authToken');
      await axios.delete(`${config.apiUrl}/api/chat/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages([]);
    } catch (err) {
      console.error('Error clearing history:', err);
    }
  };

  if (!user) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      zIndex: 1000
    }}>
      {/* Chat Widget */}
      {isOpen && (
        <div style={{
          width: '400px',
          height: '600px',
          backgroundColor: isDarkMode ? '#1d1d1f' : '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 16px 40px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          marginBottom: '12px',
          border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          overflow: 'hidden'
        }}>
          {/* Header — flat surface, hairline border, restrained */}
          <div style={{
            padding: '14px 18px',
            background: isDarkMode ? '#1d1d1f' : '#ffffff',
            color: isDarkMode ? '#f5f5f7' : '#1d1d1f',
            borderTopLeftRadius: '14px',
            borderTopRightRadius: '14px',
            borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{
                fontWeight: 600,
                fontSize: '14px',
                letterSpacing: '-0.01em'
              }}>DOT Assistant</div>
              <div style={{
                fontSize: '11px',
                color: isDarkMode ? 'rgba(245,245,247,0.62)' : '#6e6e73',
                marginTop: '2px'
              }}>
                {context && context.type === 'corridor'
                  ? `${context.data.corridor} corridor expert`
                  : 'WZDx · TMDD · SAE J2735'
                }
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={clearHistory}
                style={{
                  background: 'transparent',
                  border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)'}`,
                  color: isDarkMode ? '#f5f5f7' : '#6e6e73',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontFamily: 'inherit',
                  fontWeight: 500
                }}
                title="Clear history"
              >
                Clear
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                  border: 'none',
                  color: isDarkMode ? '#f5f5f7' : '#6e6e73',
                  width: '24px',
                  height: '24px',
                  minWidth: '24px',
                  minHeight: '24px',
                  borderRadius: '999px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  lineHeight: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                aria-label="Close chat"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '16px',
            backgroundColor: isDarkMode ? '#111827' : '#f9fafb',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {messages.length === 0 && !isLoading && (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#6b7280',
                fontSize: '14px'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>👋</div>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                  Hi! I'm your DOT Assistant
                </div>
                <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                  Ask me about compliance scores, standards, or feed issues
                </div>
                <div style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>
                  💡 Tip: Select a corridor filter (like I-35) to get an auto-generated briefing!
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  gap: '4px'
                }}
              >
                {msg.isAuto && (
                  <div style={{
                    fontSize: '11px',
                    color: '#9ca3af',
                    fontStyle: 'italic',
                    paddingLeft: msg.role === 'user' ? '0' : '4px',
                    paddingRight: msg.role === 'user' ? '4px' : '0'
                  }}>
                    🤖 Auto-generated corridor briefing
                  </div>
                )}
                <div style={{
                  maxWidth: '80%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  backgroundColor: msg.role === 'user' ? '#0071e3' : (isDarkMode ? '#374151' : 'white'),
                  color: msg.role === 'user' ? 'white' : (isDarkMode ? '#f9fafb' : '#1f2937'),
                  fontSize: '14px',
                  lineHeight: '1.5',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {msg.message}
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{
                display: 'flex',
                justifyContent: 'flex-start'
              }}>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  backgroundColor: isDarkMode ? '#374151' : 'white',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#9ca3af',
                    animation: 'pulse 1.4s ease-in-out infinite'
                  }} />
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#9ca3af',
                    animation: 'pulse 1.4s ease-in-out 0.2s infinite'
                  }} />
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#9ca3af',
                    animation: 'pulse 1.4s ease-in-out 0.4s infinite'
                  }} />
                </div>
              </div>
            )}

            {error && (
              <div style={{
                padding: '12px',
                backgroundColor: '#6b7280',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#991b1b',
                border: '1px solid #fecaca'
              }}>
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} style={{
            padding: '16px',
            borderTop: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
            backgroundColor: isDarkMode ? '#1f2937' : 'white',
            borderBottomLeftRadius: '12px',
            borderBottomRightRadius: '12px'
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about compliance, standards, or feed issues..."
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: `1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  backgroundColor: isDarkMode ? '#374151' : 'white',
                  color: isDarkMode ? '#f9fafb' : '#1f2937'
                }}
                onFocus={(e) => e.target.style.borderColor = '#0071e3'}
                onBlur={(e) => e.target.style.borderColor = isDarkMode ? '#4b5563' : '#d1d5db'}
              />
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                style={{
                  padding: '8px 18px',
                  backgroundColor: isLoading || !inputMessage.trim() ? '#c7c7cc' : '#0071e3',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '999px',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  cursor: isLoading || !inputMessage.trim() ? 'not-allowed' : 'pointer',
                  transition: 'background-color 200ms cubic-bezier(0.32, 0.72, 0, 1)'
                }}
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toggle Button — glass pebble matching header chrome */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'rgba(29, 29, 31, 0.78)',
          color: '#f5f5f7',
          border: '1px solid rgba(255, 255, 255, 0.10)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16), 0 6px 16px rgba(0,0,0,0.18)',
          cursor: 'pointer',
          fontSize: '22px',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1), background-color 200ms cubic-bezier(0.32, 0.72, 0, 1)',
          position: 'relative',
          backdropFilter: 'blur(14px) saturate(180%)',
          WebkitBackdropFilter: 'blur(14px) saturate(180%)'
        }}
        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(29, 29, 31, 0.92)'; }}
        onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(29, 29, 31, 0.78)'; }}
        onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)'; }}
        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        title="AI Assistant"
      >
        {isOpen ? '✕' : '🤖'}
      </button>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.4;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

