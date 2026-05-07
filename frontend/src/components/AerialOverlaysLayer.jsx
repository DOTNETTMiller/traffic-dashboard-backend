import { Fragment, useEffect, useState } from 'react';
import { ImageOverlay, Marker } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';

/**
 * Map layer that renders saved aerial overlays as ImageOverlays at their
 * stored geographic bounds. Overlays without bounds (newly-uploaded PDFs)
 * pop into a "place me" mode: spawn at the current map view with two
 * corner handles you drag to size, then auto-save when you stop dragging.
 *
 * The Map Layers nav toggle "Aerial Overlays" mounts this component;
 * gated by the visible prop.
 */
export default function AerialOverlaysLayer({ visible = false, mapRef }) {
  const [overlays, setOverlays] = useState([]);
  const [opacity] = useState(0.7);

  // Track in-progress bounds drags so the parent doesn't re-fetch and clobber
  // the user's edits. Keyed by overlay id.
  const [draftBounds, setDraftBounds] = useState({});

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    api.get('/api/aerial-overlays').then(res => {
      if (!cancelled) setOverlays(res?.data?.overlays || []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      {overlays.map(o => {
        const draft = draftBounds[o.id];
        const stored = o.bounds;
        // Decide what bounds to render with:
        //   (1) live drag values, if user is positioning right now
        //   (2) the saved DB bounds
        //   (3) nothing yet — initialize a default rect in the current
        //       viewport so the user can grab it and drag
        let bounds = draft || stored;
        if (!bounds) {
          bounds = defaultBoundsAtViewport(mapRef);
          if (!bounds) return null;  // map ref not ready yet
          // Stash as a draft so subsequent renders are stable until saved
          setDraftBounds(d => d[o.id] ? d : { ...d, [o.id]: bounds });
          return null;  // re-render will pick up the draft
        }

        const sw = [bounds.south, bounds.west];
        const ne = [bounds.north, bounds.east];

        const setCorner = (corner, latLng) => {
          const next = { ...bounds };
          if (corner === 'sw') { next.south = latLng.lat; next.west = latLng.lng; }
          else { next.north = latLng.lat; next.east = latLng.lng; }
          // Keep the rect well-formed: south < north, west < east
          if (next.south > next.north) [next.south, next.north] = [next.north, next.south];
          if (next.west > next.east) [next.west, next.east] = [next.east, next.west];
          setDraftBounds(d => ({ ...d, [o.id]: next }));
        };

        const persist = async () => {
          if (!draft) return;
          try {
            await api.patch(`/api/aerial-overlays/${o.id}`, { bounds: draft });
            // Reflect the saved bounds onto the row so the chip flips green;
            // clear the draft so future loads use the stored bounds.
            setOverlays(list => list.map(row =>
              row.id === o.id ? { ...row, bounds: draft } : row
            ));
            setDraftBounds(d => { const { [o.id]: _, ...rest } = d; return rest; });
          } catch (err) {
            console.warn('Saving overlay bounds failed:', err.message);
          }
        };

        return (
          <Fragment key={o.id}>
            <ImageOverlay
              url={o.file_url}
              bounds={[sw, ne]}
              opacity={opacity}
            />
            {/* Always show corner handles when there is a draft (i.e. the
                row hadn't been positioned yet, or the user hasn't saved). */}
            {draft && (
              <>
                <CornerHandle
                  position={sw}
                  label="A"
                  onDragEnd={(latLng) => { setCorner('sw', latLng); }}
                  onMouseUpAfterDrag={persist}
                />
                <CornerHandle
                  position={ne}
                  label="B"
                  onDragEnd={(latLng) => { setCorner('ne', latLng); }}
                  onMouseUpAfterDrag={persist}
                />
              </>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

function CornerHandle({ position, label, onDragEnd, onMouseUpAfterDrag }) {
  return (
    <Marker
      position={position}
      draggable={true}
      icon={L.divIcon({
        html: `<div style="
          width: 18px; height: 18px; border-radius: 50%;
          background: #F08230; border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          color: #0E0E10; font-size: 10px; font-weight: 700;
          text-align: center; line-height: 14px;
          cursor: move;
        ">${label}</div>`,
        className: '',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      })}
      eventHandlers={{
        drag: (e) => onDragEnd(e.target.getLatLng()),
        dragend: () => onMouseUpAfterDrag()
      }}
    />
  );
}

function defaultBoundsAtViewport(mapRef) {
  const map = mapRef?.current;
  if (!map) return null;
  const b = map.getBounds();
  // Use the inner ~50% of the viewport as a sensible starting rect so the
  // overlay is visible without filling the whole map.
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  const latSpan = ne.lat - sw.lat;
  const lngSpan = ne.lng - sw.lng;
  return {
    south: sw.lat + latSpan * 0.25,
    west:  sw.lng + lngSpan * 0.25,
    north: sw.lat + latSpan * 0.75,
    east:  sw.lng + lngSpan * 0.75
  };
}
