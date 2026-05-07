import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { config } from '../config';
import api from '../services/api';

/**
 * Aerial Overlays admin page.
 *
 * Drop a TIF / GeoTIFF (server reads bounds from TIFF tags + downsamples
 * to JPEG q80) or a PDF (rendered client-side via pdfjs-dist to a canvas
 * → uploaded as JPEG; bounds set later by dragging corners on the map).
 *
 * The list below is the management view: rename / delete / toggle. The
 * actual map rendering of these overlays happens via the Map Layers
 * "Aerial Overlays" toggle, which mounts AerialOverlaysLayer on the main
 * map and pulls the same /api/aerial-overlays list.
 */
export default function AerialOverlaysPanel() {
  const [overlays, setOverlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const tifInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  useEffect(() => { fetchOverlays(); }, []);

  async function fetchOverlays() {
    setLoading(true);
    try {
      const res = await api.get('/api/aerial-overlays');
      setOverlays(res?.data?.overlays || []);
    } catch (err) {
      console.warn('aerial overlays fetch:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function uploadTif(file) {
    if (!file) return;
    setUploading(true); setError(null); setSuccess(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', file.name);
      const res = await api.post('/api/aerial-overlays/upload-tif', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res?.data?.success) {
        setSuccess(`Uploaded ${file.name}${res.data.overlay?.bounds ? ' with embedded geo bounds' : ' — no GeoTIFF tags, set bounds on the map'}`);
        await fetchOverlays();
      } else {
        setError(res?.data?.error || 'Upload failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setUploading(false);
    }
  }

  async function uploadPdf(file) {
    if (!file) return;
    setUploading(true); setError(null); setSuccess(null);
    try {
      // Lazy-load pdfjs-dist so it isn't in the main bundle for users who
      // never upload a PDF. The component is itself code-split via React.lazy.
      const pdfjs = await import('pdfjs-dist');
      const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

      const buf = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));

      const fd = new FormData();
      fd.append('file', blob, file.name.replace(/\.pdf$/i, '.jpg'));
      fd.append('name', file.name);
      fd.append('file_type', 'pdf');
      const res = await api.post('/api/aerial-overlays/upload-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res?.data?.success) {
        setSuccess(`Uploaded ${file.name} — flip the Aerial Overlays map layer on, then drag the corners to size it.`);
        await fetchOverlays();
      } else {
        setError(res?.data?.error || 'Upload failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'PDF processing failed');
    } finally {
      setUploading(false);
    }
  }

  async function deleteOverlay(o) {
    if (!window.confirm(`Delete overlay "${o.name}"?`)) return;
    try {
      await api.delete(`/api/aerial-overlays/${o.id}`);
      await fetchOverlays();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }

  return (
    <div style={{
      flex: 1, overflowY: 'auto', padding: '24px',
      maxWidth: 1100, margin: '0 auto', width: '100%',
      fontFamily: 'var(--font-sans)'
    }}>
      <h2 style={{
        margin: '0 0 4px',
        fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700,
        letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--accent)'
      }}>
        Aerial Overlays
      </h2>
      <p style={{ margin: '0 0 24px', color: 'var(--fg-muted)', fontSize: '13px' }}>
        Drop a drone GeoTIFF or a site-plan PDF to overlay on the live map.
        TIFFs with embedded geo tags auto-position; PDFs and plain rasters
        are placed by dragging the corner handles on the map.
      </p>

      {error && <Banner tone="error">{error}</Banner>}
      {success && <Banner tone="success">{success}</Banner>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <DropZone
          label="GeoTIFF / TIF"
          accept=".tif,.tiff,image/tiff"
          onPick={uploadTif}
          inputRef={tifInputRef}
          disabled={uploading}
          hint="Server downsamples to ≤2048px JPEG and reads bounds from TIFF tags."
        />
        <DropZone
          label="PDF site plan"
          accept=".pdf,application/pdf"
          onPick={uploadPdf}
          inputRef={pdfInputRef}
          disabled={uploading}
          hint="Page 1 rendered to JPEG. You set its position on the map after upload."
        />
      </div>

      <SectionLabel>Saved overlays</SectionLabel>
      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--fg-muted)' }}>Loading…</p>
      ) : overlays.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--fg-muted)' }}>None yet — upload a TIF or PDF above.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {overlays.map(o => (
            <OverlayRow key={o.id} overlay={o} onDelete={() => deleteOverlay(o)} />
          ))}
        </div>
      )}
    </div>
  );
}

function DropZone({ label, accept, onPick, inputRef, disabled, hint }) {
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setOver(false);
        if (e.dataTransfer.files?.[0]) onPick(e.dataTransfer.files[0]);
      }}
      style={{
        display: 'block',
        border: `2px dashed ${over ? 'var(--accent)' : 'var(--border-strong)'}`,
        background: over ? 'rgba(240, 130, 48, 0.06)' : '#f9fafb',
        borderRadius: 12, padding: 24, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'border-color 160ms, background-color 160ms'
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(e) => { if (e.target.files?.[0]) onPick(e.target.files[0]); }}
        style={{ display: 'none' }}
      />
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.02em',
        color: 'var(--accent)', marginBottom: 6
      }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.5 }}>
        Drop a file here, or click to choose.
        <br /><span style={{ opacity: 0.75 }}>{hint}</span>
      </div>
    </label>
  );
}

function OverlayRow({ overlay, onDelete }) {
  const hasBounds = !!overlay.bounds;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px',
      border: '1px solid var(--border)', borderRadius: 10,
      background: '#ffffff'
    }}>
      <img
        src={overlay.file_url}
        alt=""
        style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, background: '#f3f4f6', flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1d1d1f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {overlay.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
          {overlay.file_type.toUpperCase()} · {overlay.width_px}×{overlay.height_px}
          {' · '}{overlay.created_at ? format(new Date(overlay.created_at), 'MMM d, h:mm a') : ''}
        </div>
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
        padding: '3px 8px', borderRadius: 999,
        background: hasBounds ? 'rgba(22, 163, 74, 0.10)' : 'rgba(201, 122, 22, 0.10)',
        color: hasBounds ? '#15803d' : '#a55e10',
        border: `1px solid ${hasBounds ? 'rgba(22, 163, 74, 0.28)' : 'rgba(201, 122, 22, 0.32)'}`
      }}>
        {hasBounds ? 'positioned' : 'no bounds'}
      </span>
      <button
        type="button"
        onClick={onDelete}
        style={{
          height: 26, padding: '0 12px', borderRadius: 999,
          background: 'rgba(211, 47, 47, 0.08)', color: '#9a1c1c',
          border: '1px solid rgba(211, 47, 47, 0.28)',
          fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600,
          letterSpacing: '0.04em', textTransform: 'uppercase',
          cursor: 'pointer'
        }}
      >Delete</button>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
      textTransform: 'uppercase', color: 'var(--fg-muted)',
      marginTop: 24, marginBottom: 8
    }}>{children}</div>
  );
}

function Banner({ tone, children }) {
  const palette = {
    error:   { bg: 'rgba(211, 47, 47, 0.08)',  border: 'rgba(211, 47, 47, 0.24)', fg: '#9a1c1c' },
    success: { bg: 'rgba(22, 163, 74, 0.08)',   border: 'rgba(22, 163, 74, 0.24)', fg: '#15803d' }
  }[tone];
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13,
      background: palette.bg, border: `1px solid ${palette.border}`, color: palette.fg
    }}>{children}</div>
  );
}
