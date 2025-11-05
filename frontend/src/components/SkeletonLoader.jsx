import { theme } from '../styles/theme';

// Skeleton loading component for modern, sleek loading states
export default function SkeletonLoader({ variant = 'card', count = 1, style = {} }) {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  return (
    <>
      {skeletons.map((_, index) => (
        <div key={index} style={{ ...getVariantStyle(variant), ...style }}>
          {variant === 'card' && <CardSkeleton />}
          {variant === 'list' && <ListSkeleton />}
          {variant === 'text' && <TextSkeleton />}
          {variant === 'metric' && <MetricSkeleton />}
          {variant === 'table' && <TableSkeleton />}
        </div>
      ))}
    </>
  );
}

// Base skeleton styles
const baseSkeletonStyle = {
  background: `linear-gradient(90deg, ${theme.colors.gray[200]} 0%, ${theme.colors.gray[100]} 50%, ${theme.colors.gray[200]} 100%)`,
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s ease-in-out infinite',
  borderRadius: theme.borderRadius.md
};

// Shimmer animation keyframes (inject into document)
if (typeof document !== 'undefined') {
  const styleSheet = document.styleSheets[0];
  const keyframes = `
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  try {
    styleSheet.insertRule(keyframes, styleSheet.cssRules.length);
  } catch (e) {
    // Rule may already exist
  }
}

function getVariantStyle(variant) {
  switch (variant) {
    case 'card':
      return {
        padding: theme.spacing.lg,
        borderRadius: theme.borderRadius.lg,
        backgroundColor: theme.colors.white,
        boxShadow: theme.shadows.base,
        marginBottom: theme.spacing.md
      };
    case 'list':
      return {
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.white,
        marginBottom: theme.spacing.sm
      };
    case 'text':
      return {
        marginBottom: theme.spacing.xs
      };
    case 'metric':
      return {
        padding: theme.spacing.lg,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.gray[50],
        border: `1px solid ${theme.colors.gray[200]}`
      };
    case 'table':
      return {
        width: '100%',
        borderRadius: theme.borderRadius.md,
        overflow: 'hidden'
      };
    default:
      return {};
  }
}

function CardSkeleton() {
  return (
    <>
      {/* Header */}
      <div style={{
        ...baseSkeletonStyle,
        height: '24px',
        width: '60%',
        marginBottom: theme.spacing.md
      }} />

      {/* Content lines */}
      <div style={{
        ...baseSkeletonStyle,
        height: '16px',
        width: '100%',
        marginBottom: theme.spacing.sm
      }} />
      <div style={{
        ...baseSkeletonStyle,
        height: '16px',
        width: '90%',
        marginBottom: theme.spacing.sm
      }} />
      <div style={{
        ...baseSkeletonStyle,
        height: '16px',
        width: '75%'
      }} />
    </>
  );
}

function ListSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
      {/* Icon/Avatar */}
      <div style={{
        ...baseSkeletonStyle,
        width: '40px',
        height: '40px',
        borderRadius: theme.borderRadius.full,
        flexShrink: 0
      }} />

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div style={{
          ...baseSkeletonStyle,
          height: '14px',
          width: '70%',
          marginBottom: theme.spacing.xs
        }} />
        <div style={{
          ...baseSkeletonStyle,
          height: '12px',
          width: '50%'
        }} />
      </div>
    </div>
  );
}

function TextSkeleton() {
  return (
    <div style={{
      ...baseSkeletonStyle,
      height: '14px',
      width: '100%'
    }} />
  );
}

function MetricSkeleton() {
  return (
    <>
      {/* Label */}
      <div style={{
        ...baseSkeletonStyle,
        height: '12px',
        width: '50%',
        marginBottom: theme.spacing.sm
      }} />

      {/* Value */}
      <div style={{
        ...baseSkeletonStyle,
        height: '32px',
        width: '80%',
        marginBottom: theme.spacing.xs
      }} />

      {/* Sub-text */}
      <div style={{
        ...baseSkeletonStyle,
        height: '10px',
        width: '60%'
      }} />
    </>
  );
}

function TableSkeleton() {
  const rows = [1, 2, 3, 4];

  return (
    <div style={{ width: '100%' }}>
      {/* Header row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        backgroundColor: theme.colors.gray[50],
        borderBottom: `1px solid ${theme.colors.gray[200]}`
      }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            ...baseSkeletonStyle,
            height: '12px'
          }} />
        ))}
      </div>

      {/* Data rows */}
      {rows.map((row) => (
        <div key={row} style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          borderBottom: `1px solid ${theme.colors.gray[100]}`
        }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{
              ...baseSkeletonStyle,
              height: '14px'
            }} />
          ))}
        </div>
      ))}
    </div>
  );
}
