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

/**
 * Tone band by percentage. Three semantic states matching the per-field
 * validator on the Raw Feed tab (pass / warn / fail) so the dashboard reads
 * coherently — a chip's color always means the same thing wherever it sits.
 *   ≥85   pass (brand green)
 *   70-84 warn (brand amber)
 *   <70   fail (brand red)
 *   null  N/A (neutral gray)
 */
const TONE_NA   = { fg: '#6e6e73', bg: 'rgba(0, 0, 0, 0.04)',       border: 'rgba(0, 0, 0, 0.10)' };
const TONE_PASS = { fg: '#15803d', bg: 'rgba(22, 163, 74, 0.10)',   border: 'rgba(22, 163, 74, 0.30)' };
const TONE_WARN = { fg: '#a55e10', bg: 'rgba(201, 122, 22, 0.10)',  border: 'rgba(201, 122, 22, 0.32)' };
const TONE_FAIL = { fg: '#9a1c1c', bg: 'rgba(211, 47, 47, 0.10)',   border: 'rgba(211, 47, 47, 0.32)' };

function toneFor(percentage) {
  if (percentage === null || percentage === undefined) return TONE_NA;
  if (percentage >= 85) return TONE_PASS;
  if (percentage >= 70) return TONE_WARN;
  return TONE_FAIL;
}

function GradeChip({ label, grade, percentage, criticalRatio, missing, loading }) {
  const hasScore = !loading && percentage !== null && percentage !== undefined;
  const tone = hasScore ? toneFor(percentage) : TONE_NA;

  const tooltipLines = loading
    ? [`${label}`, 'Grading…']
    : [
        `${label}`,
        hasScore ? `Score: ${percentage}% (${grade || '—'})` : 'Score: not available',
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
        {loading ? '…' : hasScore ? `${Math.round(percentage)}%` : 'N/A'}
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
