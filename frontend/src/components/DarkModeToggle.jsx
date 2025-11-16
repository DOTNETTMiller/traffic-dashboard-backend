import { useEffect, useState } from 'react';
import { theme } from '../styles/theme';

export default function DarkModeToggle({ isDarkMode, onToggle }) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isAnimating) {
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isAnimating]);

  const handleToggle = () => {
    setIsAnimating(true);
    onToggle();
  };

  return (
    <>
      <button
        onClick={handleToggle}
        aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
        style={{
          position: 'relative',
          width: '64px',
          height: '32px',
          borderRadius: '16px',
          border: `2px solid ${isDarkMode ? theme.colors.accentBlue : theme.colors.gray[300]}`,
          background: isDarkMode
            ? 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)'
            : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
          cursor: 'pointer',
          padding: 0,
          transition: `all ${theme.transitions.medium}`,
          boxShadow: isDarkMode ? theme.shadows.lg : theme.shadows.md,
          overflow: 'hidden'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = theme.shadows.xl;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = isDarkMode ? theme.shadows.lg : theme.shadows.md;
        }}
      >
        {/* Background stars for dark mode */}
        {isDarkMode && (
          <div style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden'
          }}>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  width: '2px',
                  height: '2px',
                  background: 'white',
                  borderRadius: '50%',
                  top: `${20 + i * 15}%`,
                  left: `${15 + i * 12}%`,
                  opacity: 0.6,
                  animation: `twinkle ${1 + i * 0.3}s ease-in-out infinite`
                }}
              />
            ))}
          </div>
        )}

        {/* Sliding toggle */}
        <div
          style={{
            position: 'absolute',
            top: '2px',
            left: isDarkMode ? 'calc(100% - 30px)' : '2px',
            width: '24px',
            height: '24px',
            borderRadius: '12px',
            background: 'white',
            boxShadow: theme.shadows.md,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            transition: `all ${theme.transitions.medium}`,
            transform: isAnimating ? 'rotate(360deg)' : 'rotate(0deg)'
          }}
        >
          {isDarkMode ? '🌙' : '☀️'}
        </div>
      </button>

      <style>{`
        @keyframes twinkle {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.2);
          }
        }
      `}</style>
    </>
  );
}
