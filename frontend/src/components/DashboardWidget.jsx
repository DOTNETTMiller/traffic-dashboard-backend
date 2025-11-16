import { theme } from '../styles/theme';

export default function DashboardWidget({
  title,
  icon,
  children,
  onRemove,
  size = 'medium' // small, medium, large
}) {
  const sizeStyles = {
    small: {
      gridColumn: 'span 1',
      minHeight: '200px'
    },
    medium: {
      gridColumn: 'span 1',
      minHeight: '300px'
    },
    large: {
      gridColumn: 'span 2',
      minHeight: '300px'
    }
  };

  return (
    <div style={{
      ...sizeStyles[size],
      background: theme.colors.glassDark,
      backdropFilter: 'blur(20px)',
      border: `1px solid ${theme.colors.border}`,
      borderRadius: '16px',
      padding: theme.spacing.lg,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing.md,
      transition: `all ${theme.transitions.medium}`,
      position: 'relative',
      overflow: 'hidden'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = theme.shadows.lg;
      e.currentTarget.style.transform = 'translateY(-2px)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.transform = 'translateY(0)';
    }}
    >
      {/* Widget Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${theme.colors.border}`,
        paddingBottom: theme.spacing.sm
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.sm
        }}>
          <span style={{ fontSize: '20px' }}>{icon}</span>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '700',
            color: theme.colors.text
          }}>
            {title}
          </h3>
        </div>

        {onRemove && (
          <button
            onClick={onRemove}
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              fontSize: '18px',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: `all ${theme.transitions.fast}`
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.colors.error.light;
              e.currentTarget.style.color = theme.colors.error.main;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = theme.colors.textSecondary;
            }}
            title="Remove widget"
          >
            ×
          </button>
        )}
      </div>

      {/* Widget Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing.sm
      }}>
        {children}
      </div>
    </div>
  );
}
