const DEMO_URL = '/demos/crossing-projection.html';

export default function CrossingProjectionDemo() {
  return (
    <section style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', fontSize: 13 }}>
        <span style={{ color: 'var(--fg-muted)' }}>Crossing Projection Demo · sample data</span>
        <a href={DEMO_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
          Open full screen ↗
        </a>
      </div>
      <iframe
        src={DEMO_URL}
        title="CCAI crossing projection and routing demonstration"
        style={{ flex: 1, minHeight: '75vh', width: '100%', border: 0, background: '#fff' }}
      />
    </section>
  );
}
