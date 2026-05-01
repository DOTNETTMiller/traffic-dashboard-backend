/**
 * Shimmer placeholder. Use during loading states instead of "Loading..." text.
 *
 * <Skeleton width="120px" height="14px" />
 * <Skeleton lines={3} />     // stacked rows, the last 60% width
 * <Skeleton circle size={32} />
 */
export default function Skeleton({
  width = '100%',
  height = 12,
  circle = false,
  size,
  lines,
  style = {},
  ...rest
}) {
  if (lines && lines > 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }} {...rest}>
        {Array.from({ length: lines }).map((_, i) => (
          <span
            key={i}
            className="cc-skeleton"
            style={{
              width: i === lines - 1 ? '60%' : '100%',
              height: typeof height === 'number' ? `${height}px` : height
            }}
          />
        ))}
      </div>
    );
  }

  if (circle) {
    const s = size || 32;
    return (
      <span
        className="cc-skeleton"
        style={{
          width: `${s}px`,
          height: `${s}px`,
          borderRadius: '50%',
          display: 'inline-block',
          ...style
        }}
        {...rest}
      />
    );
  }

  return (
    <span
      className="cc-skeleton"
      style={{
        display: 'block',
        width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style
      }}
      {...rest}
    />
  );
}
