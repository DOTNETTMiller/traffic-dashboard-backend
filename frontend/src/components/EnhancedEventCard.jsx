import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { theme } from '../styles/theme';
import { isNearBorder } from '../utils/borderProximity';

export default function EnhancedEventCard({
  event,
  messages = [],
  onClick,
  onViewOnMap,
  onAddComment,
  compact = false
}) {
  const [expanded, setExpanded] = useState(false);
  const borderInfo = isNearBorder(event);
  const messageCount = messages.length;
  const hasMessages = messageCount > 0;
  const latestMessage = hasMessages ? messages[messages.length - 1] : null;

  const getSeverityColor = () => {
    switch (event.severity?.toLowerCase()) {
      case 'high': return theme.colors.error.main;
      case 'medium': return theme.colors.warning.main;
      case 'low': return theme.colors.success.main;
      default: return theme.colors.gray[400];
    }
  };

  const getSeverityGradient = () => {
    switch (event.severity?.toLowerCase()) {
      case 'high': return theme.colors.gradients.error;
      case 'medium': return theme.colors.gradients.warning;
      case 'low': return theme.colors.gradients.success;
      default: return theme.colors.gradients.primary;
    }
  };

  const getEventTypeIcon = () => {
    const type = event.eventType?.toLowerCase() || '';
    if (type.includes('construction')) return '🚧';
    if (type.includes('closure')) return '🚫';
    if (type.includes('incident') || type.includes('crash')) return '⚠️';
    if (type.includes('weather')) return '🌧️';
    if (type.includes('restriction')) return '⛔';
    if (type.includes('maintenance')) return '🔧';
    return '📍';
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Unknown';
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  if (compact) {
    return (
      <div
        onClick={onClick}
        style={{
          background: theme.colors.glassDark,
          backdropFilter: 'blur(20px)',
          border: `1px solid ${theme.colors.border}`,
          borderLeft: `4px solid ${getSeverityColor()}`,
          borderRadius: '12px',
          padding: theme.spacing.md,
          cursor: 'pointer',
          transition: `all ${theme.transitions.fast}`,
          marginBottom: theme.spacing.sm
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateX(4px)';
          e.currentTarget.style.boxShadow = theme.shadows.lg;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateX(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs }}>
          <span style={{ fontSize: '20px' }}>{getEventTypeIcon()}</span>
          <span style={{ fontSize: '14px', fontWeight: '700', color: theme.colors.text }}>
            {event.corridor}
          </span>
          <span style={{
            padding: '2px 8px',
            borderRadius: '12px',
            background: getSeverityColor(),
            color: '#111827',
            fontSize: '10px',
            fontWeight: '700',
            textTransform: 'uppercase'
          }}>
            {event.severity}
          </span>
          {hasMessages && (
            <span style={{
              marginLeft: 'auto',
              padding: '2px 8px',
              borderRadius: '12px',
              background: theme.colors.accentBlue,
              color: '#111827',
              fontSize: '10px',
              fontWeight: '700'
            }}>
              💬 {messageCount}
            </span>
          )}
        </div>
        <div style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
          {event.location}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: theme.colors.glassDark,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: theme.shadows.md,
        transition: `all ${theme.transitions.medium}`,
        marginBottom: theme.spacing.md
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = theme.shadows.xl;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = theme.shadows.md;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Header with Severity Gradient */}
      <div style={{
        background: getSeverityGradient(),
        padding: theme.spacing.md,
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: '200px',
          height: '200px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '50%',
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
              <span style={{ fontSize: '28px' }}>{getEventTypeIcon()}</span>
              <div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#111827' }}>
                  {event.corridor}
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.9)', fontWeight: '600' }}>
                  {event.state} • {event.eventType}
                </div>
              </div>
            </div>
            <div style={{
              padding: '6px 12px',
              borderRadius: '20px',
              background: 'rgba(255,255,255,0.25)',
              backdropFilter: 'blur(10px)',
              fontSize: '11px',
              fontWeight: '700',
              color: '#111827',
              textTransform: 'uppercase',
              border: '1px solid rgba(255,255,255,0.3)'
            }}>
              {event.severity} Severity
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: theme.spacing.lg }}>
        {/* Location */}
        <div style={{ marginBottom: theme.spacing.md }}>
          <div style={{
            fontSize: '11px',
            fontWeight: '700',
            color: theme.colors.textSecondary,
            textTransform: 'uppercase',
            marginBottom: theme.spacing.xs
          }}>
            📍 Location
          </div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: theme.colors.text }}>
            {event.location}
          </div>
          {event.direction && (
            <div style={{ fontSize: '12px', color: theme.colors.textSecondary, marginTop: '4px' }}>
              Direction: {event.direction}
            </div>
          )}
        </div>

        {/* Description */}
        {event.description && (
          <div style={{ marginBottom: theme.spacing.md }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '700',
              color: theme.colors.textSecondary,
              textTransform: 'uppercase',
              marginBottom: theme.spacing.xs
            }}>
              📝 Description
            </div>
            <div style={{
              fontSize: '13px',
              color: theme.colors.text,
              lineHeight: '1.6',
              maxHeight: expanded ? 'none' : '60px',
              overflow: 'hidden',
              position: 'relative'
            }}>
              {event.description}
              {!expanded && event.description.length > 150 && (
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '30px',
                  background: 'linear-gradient(transparent, rgba(255,255,255,0.95))'
                }} />
              )}
            </div>
            {event.description.length > 150 && (
              <button
                onClick={() => setExpanded(!expanded)}
                style={{
                  marginTop: theme.spacing.xs,
                  background: 'transparent',
                  border: 'none',
                  color: theme.colors.accentBlue,
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: '4px 0'
                }}
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        {/* Metadata Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.md
        }}>
          {event.startTime && (
            <div style={{
              padding: theme.spacing.sm,
              background: theme.colors.glassLight,
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`
            }}>
              <div style={{ fontSize: '10px', color: theme.colors.textSecondary, marginBottom: '2px' }}>
                Started
              </div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: theme.colors.text }}>
                {formatDateTime(event.startTime)}
              </div>
            </div>
          )}
          {event.lanesAffected && (
            <div style={{
              padding: theme.spacing.sm,
              background: theme.colors.glassLight,
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`
            }}>
              <div style={{ fontSize: '10px', color: theme.colors.textSecondary, marginBottom: '2px' }}>
                Lanes Affected
              </div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: theme.colors.text }}>
                {event.lanesAffected}
              </div>
            </div>
          )}
          {event.source && (
            <div style={{
              padding: theme.spacing.sm,
              background: theme.colors.glassLight,
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`
            }}>
              <div style={{ fontSize: '10px', color: theme.colors.textSecondary, marginBottom: '2px' }}>
                Source
              </div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: theme.colors.text }}>
                {event.source}
              </div>
            </div>
          )}
        </div>

        {/* Status Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs, marginBottom: theme.spacing.md }}>
          {borderInfo && borderInfo.nearBorder && (
            <span style={{
              padding: '4px 10px',
              borderRadius: '12px',
              background: `${theme.colors.accentPurple}20`,
              border: `1px solid ${theme.colors.accentPurple}`,
              fontSize: '11px',
              fontWeight: '700',
              color: theme.colors.accentPurple,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              🔵 Near {borderInfo.borderName} ({borderInfo.distance} mi)
            </span>
          )}
          {event.requiresCollaboration && (
            <span style={{
              padding: '4px 10px',
              borderRadius: '12px',
              background: `${theme.colors.warning.main}20`,
              border: `1px solid ${theme.colors.warning.main}`,
              fontSize: '11px',
              fontWeight: '700',
              color: theme.colors.warning.main,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              🤝 Cross-State Coordination
            </span>
          )}
          {hasMessages && (
            <span style={{
              padding: '4px 10px',
              borderRadius: '12px',
              background: `${theme.colors.accentBlue}20`,
              border: `1px solid ${theme.colors.accentBlue}`,
              fontSize: '11px',
              fontWeight: '700',
              color: theme.colors.accentBlue,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              💬 {messageCount} {messageCount === 1 ? 'Message' : 'Messages'}
            </span>
          )}
        </div>

        {/* Latest Message Preview */}
        {latestMessage && (
          <div style={{
            padding: theme.spacing.md,
            background: theme.colors.glassLight,
            borderRadius: '12px',
            border: `1px solid ${theme.colors.border}`,
            marginBottom: theme.spacing.md
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '700',
              color: theme.colors.textSecondary,
              textTransform: 'uppercase',
              marginBottom: theme.spacing.xs
            }}>
              💬 Latest Update
            </div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: theme.colors.accentBlue, marginBottom: '4px' }}>
              {latestMessage.sender}
            </div>
            <div style={{ fontSize: '13px', color: theme.colors.text, lineHeight: '1.5' }}>
              {latestMessage.message}
            </div>
            <div style={{ fontSize: '11px', color: theme.colors.textSecondary, marginTop: '4px' }}>
              {formatDateTime(latestMessage.timestamp)}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: theme.spacing.sm }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewOnMap && onViewOnMap(event);
            }}
            style={{
              flex: 1,
              padding: theme.spacing.sm,
              background: theme.colors.gradients.primary,
              border: 'none',
              borderRadius: '8px',
              color: '#111827',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: `all ${theme.transitions.fast}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            🗺️ View on Map
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddComment && onAddComment(event);
            }}
            style={{
              flex: 1,
              padding: theme.spacing.sm,
              background: theme.colors.glassLight,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '8px',
              color: theme.colors.text,
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: `all ${theme.transitions.fast}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${theme.colors.accentBlue}20`;
              e.currentTarget.style.borderColor = theme.colors.accentBlue;
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = theme.colors.glassLight;
              e.currentTarget.style.borderColor = theme.colors.border;
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            💬 Add Comment
          </button>
        </div>
      </div>
    </div>
  );
}
