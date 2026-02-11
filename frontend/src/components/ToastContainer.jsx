import { useState, useEffect, useCallback } from 'react';
import { theme } from '../styles/theme';

let toastId = 0;
let addToastCallback = null;

// Global function to show toasts from anywhere
export const showToast = (message, type = 'info', duration = 4000) => {
  if (addToastCallback) {
    addToastCallback(message, type, duration);
  }
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type, duration) => {
    const id = toastId++;
    const newToast = {
      id,
      message,
      type,
      duration
    };

    setToasts(prev => [...prev, newToast]);

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Register global callback
  useEffect(() => {
    addToastCallback = addToast;
    return () => {
      addToastCallback = null;
    };
  }, [addToast]);

  const getToastStyles = (type) => {
    const baseStyles = {
      padding: theme.spacing.md,
      borderRadius: '12px',
      marginBottom: theme.spacing.sm,
      minWidth: '300px',
      maxWidth: '500px',
      boxShadow: theme.shadows.xl,
      backdropFilter: 'blur(20px)',
      border: '1px solid',
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
      fontSize: '14px',
      fontWeight: '500',
      animation: 'slideInRight 0.3s ease-out, fadeIn 0.3s ease-out',
      cursor: 'pointer',
      transition: `all ${theme.transitions.fast}`
    };

    const typeStyles = {
      success: {
        background: 'rgba(16, 185, 129, 0.95)',
        borderColor: '#10b981',
        color: '#111827'
      },
      error: {
        background: 'rgba(239, 68, 68, 0.95)',
        borderColor: '#ef4444',
        color: '#111827'
      },
      warning: {
        background: 'rgba(251, 191, 36, 0.95)',
        bordercolor: '#6b7280',
        color: '#1f2937'
      },
      info: {
        background: 'rgba(59, 130, 246, 0.95)',
        borderColor: '#3b82f6',
        color: '#111827'
      }
    };

    return { ...baseStyles, ...typeStyles[type] };
  };

  const getIcon = (type) => {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    return icons[type] || icons.info;
  };

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '80px',
      right: '16px',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end'
    }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          onClick={() => removeToast(toast.id)}
          style={getToastStyles(toast.type)}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateX(-4px)';
            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.14)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateX(0)';
            e.currentTarget.style.boxShadow = theme.shadows.xl;
          }}
        >
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            flexShrink: 0
          }}>
            {getIcon(toast.type)}
          </div>
          <div style={{ flex: 1 }}>
            {toast.message}
          </div>
          <div style={{
            fontSize: '18px',
            opacity: 0.7,
            lineHeight: 1,
            flexShrink: 0
          }}>
            ×
          </div>
        </div>
      ))}

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
