// Unified Design System for DOT Corridor Communicator

// Base theme tokens (mode-agnostic)
const baseTheme = {
  // Spacing scale (4px base unit)
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px'
  },

  // Border radius
  borderRadius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    full: '9999px'
  },

  // Colors
  colors: {
    // Primary (actions)
    primary: {
      light: '#60a5fa',
      main: '#3b82f6',
      dark: '#2563eb',
      darker: '#1d4ed8'
    },
    // Gradients
    gradients: {
      primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      blue: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      error: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
    },
    // Success
    success: {
      light: '#86efac',
      main: '#22c55e',
      dark: '#16a34a',
      bg: '#d1fae5',
      text: '#065f46'
    },
    // Warning
    warning: {
      light: '#fcd34d',
      main: '#fbbf24',
      dark: '#f59e0b',
      bg: '#fef3c7',
      text: '#92400e'
    },
    // Error/Critical
    error: {
      light: '#fca5a5',
      main: '#ef4444',
      dark: '#dc2626',
      darker: '#991b1b',
      bg: '#fee2e2',
      text: '#991b1b'
    },
    // Neutral/Gray scale
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827'
    },
    // Special
    white: '#ffffff',
    black: '#000000'
  },

  // Shadows (elevation system)
  shadows: {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)'
  },

  // Transitions
  transitions: {
    fast: '0.15s ease',
    base: '0.2s ease',
    slow: '0.3s ease',
    all: 'all 0.2s ease'
  },

  // Typography
  fontSize: {
    xs: '11px',
    sm: '12px',
    base: '14px',
    md: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '28px'
  },

  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700'
  },

  // Glassmorphism styles
  glass: {
    light: {
      background: 'rgba(255, 255, 255, 0.85)',
      backdropFilter: 'blur(10px) saturate(180%)',
      WebkitBackdropFilter: 'blur(10px) saturate(180%)',
      border: '1px solid rgba(255, 255, 255, 0.3)'
    },
    medium: {
      background: 'rgba(255, 255, 255, 0.75)',
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      border: '1px solid rgba(255, 255, 255, 0.25)'
    },
    dark: {
      background: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(10px) saturate(180%)',
      WebkitBackdropFilter: 'blur(10px) saturate(180%)',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }
  },

  // Z-index scale
  zIndex: {
    base: 1,
    dropdown: 100,
    sticky: 200,
    fixed: 300,
    modal: 400,
    popover: 500,
    tooltip: 600
  }
};

// Helper functions for common style patterns
export const styles = {
  // Card with glassmorphism
  glassCard: (level = 'light') => ({
    ...theme.glass[level],
    borderRadius: theme.borderRadius.lg,
    boxShadow: theme.shadows.lg,
    padding: theme.spacing.lg,
    transition: theme.transitions.all
  }),

  // Standard card
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    boxShadow: theme.shadows.base,
    padding: theme.spacing.lg,
    transition: theme.transitions.all
  },

  // Button base
  button: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    border: 'none',
    cursor: 'pointer',
    transition: theme.transitions.all,
    outline: 'none'
  },

  // Hover lift effect
  hoverLift: {
    transition: theme.transitions.all,
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows.lg
    }
  }
};

// Light mode specific colors
const lightModeColors = {
  text: '#1f2937',
  textSecondary: '#6b7280',
  background: '#ffffff',
  backgroundSecondary: '#f9fafb',
  surface: '#ffffff',
  border: '#e5e7eb',
  glassLight: 'rgba(255, 255, 255, 0.85)',
  glassDark: 'rgba(249, 250, 251, 0.9)',
  accentBlue: '#3b82f6',
  accentPurple: '#8b5cf6'
};

// Dark mode specific colors
const darkModeColors = {
  text: '#f9fafb',
  textSecondary: '#9ca3af',
  background: '#111827',
  backgroundSecondary: '#1f2937',
  surface: '#1f2937',
  border: '#374151',
  glassLight: 'rgba(31, 41, 55, 0.85)',
  glassDark: 'rgba(17, 24, 39, 0.95)',
  accentBlue: '#60a5fa',
  accentPurple: '#a78bfa'
};

// Get theme based on mode
export const getTheme = (isDarkMode = false) => ({
  ...baseTheme,
  colors: {
    ...baseTheme.colors,
    ...(isDarkMode ? darkModeColors : lightModeColors)
  },
  shadows: isDarkMode ? {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.4)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.4)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.4)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.3)'
  } : baseTheme.shadows
});

// Default export is light mode theme for backward compatibility
export const theme = getTheme(false);

export default theme;
