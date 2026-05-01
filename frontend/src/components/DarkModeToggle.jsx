import { useState } from 'react';

/**
 * iOS-style toggle switch. Flat track, white knob, sun/moon icon inside knob.
 * No gradients, no stars — calm.
 */
export default function DarkModeToggle({ isDarkMode, onToggle }) {
  const [pressed, setPressed] = useState(false);

  const W = 51;       // iOS Settings switch is ~51x31
  const H = 31;
  const KNOB = 27;
  const PAD = 2;

  const trackOff = '#d1d1d6';   // iOS gray
  const trackOn = '#1c1c1e';    // near-black for "dark mode on"
  const knobShadow = '0 2px 4px rgba(0,0,0,0.14), 0 0 0 0.5px rgba(0,0,0,0.04)';

  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      role="switch"
      aria-checked={isDarkMode}
      aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
      style={{
        position: 'relative',
        width: `${W}px`,
        height: `${H}px`,
        minWidth: `${W}px`,
        minHeight: `${H}px`,
        borderRadius: `${H / 2}px`,
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        background: isDarkMode ? trackOn : trackOff,
        transition: 'background-color 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        outline: 'none',
        boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.04)',
        flexShrink: 0
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: `${PAD}px`,
          left: isDarkMode ? `${W - KNOB - PAD}px` : `${PAD}px`,
          width: `${KNOB}px`,
          height: `${KNOB}px`,
          borderRadius: '50%',
          background: '#ffffff',
          boxShadow: knobShadow,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '13px',
          lineHeight: 1,
          transition: 'left 260ms cubic-bezier(0.32, 0.72, 0, 1), width 200ms cubic-bezier(0.32, 0.72, 0, 1)',
          width: pressed ? `${KNOB + 4}px` : `${KNOB}px`
        }}
      >
        <span style={{ opacity: 0.55 }}>{isDarkMode ? '🌙' : '☀️'}</span>
      </span>
    </button>
  );
}
