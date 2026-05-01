import { useEffect, useState } from 'react';
import api from '../services/api';

/**
 * Lazy per-event compliance grading. Fetches grades for one event from
 * /api/events/:id/compliance, caches them in module-level memory for the
 * session, and renders four small letter chips (WZDx / TMDD / SAE / CWZ).
 *
 * The cache is keyed by event id, so repeated opens of the same event
 * are free. Server cache invalidates on the next /api/events refresh.
 */
const sessionCache = new Map();

export function useComplianceGrades(eventId) {
  const [data, setData] = useState(() => sessionCache.get(eventId) || null);
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!eventId) return;
    if (sessionCache.has(eventId)) {
      setData(sessionCache.get(eventId));
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    api.get(`/api/events/${encodeURIComponent(eventId)}/compliance`)
      .then(res => {
        if (cancelled) return;
        sessionCache.set(eventId, res.data);
        setData(res.data);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [eventId]);

  return { data, loading, error };
}

const GRADE_COLORS = {
  'A':  { fg: '#1d6f3b', bg: 'rgba(38, 153, 76, 0.10)',  border: 'rgba(38, 153, 76, 0.32)' },
  'A-': { fg: '#1d6f3b', bg: 'rgba(38, 153, 76, 0.10)',  border: 'rgba(38, 153, 76, 0.28)' },
  'B':  { fg: '#0a4a8f', bg: 'rgba(0, 113, 227, 0.10)',  border: 'rgba(0, 113, 227, 0.30)' },
  'C':  { fg: '#7a4d12', bg: 'rgba(201, 122, 22, 0.10)', border: 'rgba(201, 122, 22, 0.32)' },
  'D':  { fg: '#7a4d12', bg: 'rgba(201, 122, 22, 0.14)', border: 'rgba(201, 122, 22, 0.36)' },
  'F':  { fg: '#902929', bg: 'rgba(216, 58, 58, 0.10)',  border: 'rgba(216, 58, 58, 0.34)' },
  'N/A':{ fg: '#6e6e73', bg: 'rgba(0, 0, 0, 0.04)',      border: 'rgba(0, 0, 0, 0.10)' }
};

function GradeChip({ label, grade, percentage, criticalRatio, missing, loading }) {
  const tone = GRADE_COLORS[grade] || GRADE_COLORS['N/A'];

  const tooltipLines = loading
    ? [`${label}`, 'Grading…']
    : [
        `${label}`,
        `Score: ${percentage}%`,
        `Critical fields: ${criticalRatio}%`,
        missing && missing.length > 0
          ? `Missing (${missing.length}): ${missing.slice(0, 5).map(m => m.field).join(', ')}${missing.length > 5 ? '…' : ''}`
          : 'All required fields present'
      ];

  return (
    <span
      title={tooltipLines.join('\n')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 22,
        padding: '0 9px',
        borderRadius: 999,
        background: loading ? 'rgba(0, 0, 0, 0.04)' : tone.bg,
        border: `1px solid ${loading ? 'rgba(0, 0, 0, 0.08)' : tone.border}`,
        color: loading ? '#6e6e73' : tone.fg,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums'
      }}
    >
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        textTransform: 'none'
      }}>
        {loading ? '…' : grade}
      </span>
    </span>
  );
}

export default function ComplianceGrades({ eventId, compact = false }) {
  const { data, loading, error } = useComplianceGrades(eventId);

  if (error) {
    return (
      <div style={{ fontSize: 11, color: '#6e6e73' }}>
        Compliance grades unavailable
      </div>
    );
  }

  const standards = data?.standards || {};
  const order = [
    { key: 'wzdx', label: 'WZDx' },
    { key: 'tmdd', label: 'TMDD' },
    { key: 'sae',  label: 'SAE J2735' },
    { key: 'cwz',  label: 'CWZ' }
  ];

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      alignItems: 'center'
    }}>
      {!compact && (
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#6e6e73',
          marginRight: 4
        }}>
          Standards
        </span>
      )}
      {order.map(({ key, label }) => {
        const s = standards[key];
        return (
          <GradeChip
            key={key}
            label={label}
            grade={s?.grade || 'N/A'}
            percentage={s?.percentage ?? 0}
            criticalRatio={s?.criticalRatio ?? 0}
            missing={s?.missing}
            loading={loading}
          />
        );
      })}
    </div>
  );
}
