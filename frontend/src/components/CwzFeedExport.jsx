import { useState, useMemo } from 'react';
import { theme } from '../styles/theme';
import { apiFetch } from '../utils/apiFetch';

/**
 * CwzFeedExport — dashboard button that outputs the Connected Work Zone (CWZ 1.0)
 * data feed built from the VALIDATED work zones (the same set as the "Validated
 * Work Zones" map layer: confirmed by a connected device, camera AI, TomTom probe,
 * or a DMS message). Backed by GET /api/cwz/events, which emits a WZDx 4.2 / CWZ 1.0
 * RoadEvent FeatureCollection. Offers: download a snapshot, copy the live subscribe
 * URL, or open the feed.
 */
const FEED_PATH = '/api/cwz/events';
const isValidated = (e) => e.x_cwz_connected || e.x_camera_verified || e.x_tomtom_corroborated || e.x_dms_corroborated;

export default function CwzFeedExport({ events = [] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState('');

  // Live estimate of what the feed will contain (authoritative count comes from the feed itself).
  const validatedCount = useMemo(() => (events || []).filter(isValidated).length, [events]);
  const feedUrl = `${window.location.origin}${FEED_PATH}`;

  const download = async () => {
    setBusy(true); setStatus('');
    try {
      const res = await apiFetch(FEED_PATH);
      if (!res.ok) throw new Error(`Feed returned ${res.status}`);
      const feed = await res.json();
      const n = feed?.features?.length ?? 0;
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const blob = new Blob([JSON.stringify(feed, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `cwz-1.0-validated-workzones-${stamp}.json`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
      setStatus(`Downloaded ${n} validated work zone${n === 1 ? '' : 's'} (CWZ 1.0).`);
    } catch (err) {
      setStatus(`Could not fetch the feed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(feedUrl); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { setStatus('Copy failed — select the URL and copy manually.'); }
  };

  const btnBase = {
    padding: '8px 16px', border: `1px solid ${theme.colors.border}`, borderRadius: '8px',
    cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center',
    gap: theme.spacing.sm, transition: `all ${theme.transitions.fast}`
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Output the CWZ 1.0 data feed of validated work zones"
        style={{ ...btnBase, background: open ? theme.colors.accentBlue : theme.colors.glassDark,
          color: open ? '#111827' : theme.colors.text }}
      >
        <span>🔗</span> CWZ 1.0 Feed
        <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 999,
          background: 'rgba(16,185,129,0.18)', color: '#0f9d6e', fontVariantNumeric: 'tabular-nums' }}>
          {validatedCount}
        </span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 50, width: 360, maxWidth: '90vw',
          background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: 12,
          padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.18)'
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: theme.colors.text, marginBottom: 2 }}>
            Connected Work Zone feed (CWZ 1.0)
          </div>
          <div style={{ fontSize: 12.5, color: theme.colors.textSecondary, lineHeight: 1.45, marginBottom: 12 }}>
            A WZDx 4.2 / CWZ 1.0 RoadEvent feed of the <b>validated</b> work zones — those confirmed by a
            connected device, camera AI, TomTom probe, or DMS message. <b>{validatedCount}</b> in view now.
          </div>

          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
            color: theme.colors.textSecondary }}>Live subscribe URL</label>
          <div style={{ display: 'flex', gap: 6, margin: '4px 0 12px' }}>
            <input readOnly value={feedUrl} onFocus={e => e.target.select()}
              style={{ flex: 1, fontSize: 12, padding: '7px 9px', borderRadius: 7,
                border: `1px solid ${theme.colors.border}`, background: theme.colors.backgroundSecondary,
                color: theme.colors.text, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
            <button onClick={copy} style={{ ...btnBase, padding: '7px 12px',
              background: copied ? 'rgba(16,185,129,0.15)' : theme.colors.glassDark,
              color: copied ? '#0f9d6e' : theme.colors.text }}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={download} disabled={busy}
              style={{ ...btnBase, flex: 1, justifyContent: 'center', background: theme.colors.accentBlue,
                color: '#111827', opacity: busy ? 0.6 : 1, cursor: busy ? 'default' : 'pointer' }}>
              {busy ? 'Fetching…' : '⬇ Download JSON'}
            </button>
            <button onClick={() => window.open(feedUrl, '_blank', 'noopener')}
              style={{ ...btnBase, flex: 1, justifyContent: 'center', background: theme.colors.glassDark,
                color: theme.colors.text }}>
              ↗ Open feed
            </button>
          </div>

          {status && (
            <div style={{ marginTop: 10, fontSize: 12, color: theme.colors.textSecondary }}>{status}</div>
          )}
        </div>
      )}
    </div>
  );
}
