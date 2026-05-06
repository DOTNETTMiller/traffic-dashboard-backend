import { useEffect, useState } from 'react';
import { Marker, Popup, Polyline, Polygon } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import api from '../services/api';

// V2X deployment type colors (federal USDOT data)
const deploymentStyles = {
  operational: {
    color: '#fbbf24', // yellow - operational
    icon: '📡',
    label: 'Operational V2X'
  },
  planned: {
    color: '#60a5fa', // blue - planned
    icon: '🔵',
    label: 'Planned V2X'
  },
  rsu: {
    color: '#8b5cf6', // purple - RSU
    icon: '📶',
    label: 'RSU (Roadside Unit)'
  },
  corridor: {
    color: '#10b981', // green - corridor
    icon: '🛣️',
    label: 'V2X Corridor'
  },
  default: {
    color: '#6b7280', // gray - unknown
    icon: '📍',
    label: 'V2X Site'
  }
};

// Create custom marker icon for V2X deployments
const createV2XIcon = (deployment) => {
  // USDOT's republished schema uses lowercase truncated field names
  // (loc_status, v2x_type, etc.). Fall back to the older capitalized
  // names so the layer keeps working if USDOT swaps formats again.
  const p = deployment.properties || {};
  const status = (p.loc_status || p.Status || p.status || '').toString();
  const type = (p.v2x_type || p.co_v2x_typ || p.Type || p.type || '').toString();
  const cohort = (p.cohort_mem || '').toString();

  let style;
  if (status.toLowerCase().includes('operational') || status.toLowerCase().includes('active')) {
    style = deploymentStyles.operational;
  } else if (status.toLowerCase().includes('planned') || status.toLowerCase().includes('future')) {
    style = deploymentStyles.planned;
  } else if (type.toLowerCase().includes('rsu') || type.toLowerCase().includes('roadside')) {
    style = deploymentStyles.rsu;
  } else if (cohort.toUpperCase() === 'Y' || type.toLowerCase().includes('corridor')) {
    style = deploymentStyles.corridor;
  } else {
    style = deploymentStyles.default;
  }

  return L.divIcon({
    html: `
      <div style="
        background: ${style.color};
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        position: relative;
      ">
        <span style="
          transform: rotate(45deg);
          font-size: 16px;
        ">${style.icon}</span>
        <div style="
          position: absolute;
          top: -4px;
          right: -4px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #C66A1F;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        "></div>
      </div>
    `,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

export default function V2XDeploymentsLayer({ visible = true, stateKey = null }) {
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      fetchDeployments();
    }
  }, [visible, stateKey]);

  const fetchDeployments = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get('/api/v2x/deployments');

      if (response.data.success && response.data.data?.features) {
        let features = response.data.data.features;

        // Filter by state if specified
        if (stateKey) {
          const stateUpper = stateKey.toUpperCase();
          features = features.filter(f => {
            const state = f.properties?.State || f.properties?.state || '';
            return state.toUpperCase() === stateUpper;
          });
        }

        setDeployments(features);
        console.log(`📡 Loaded ${features.length} USDOT V2X deployments${stateKey ? ` for ${stateKey.toUpperCase()}` : ''}`);
      } else {
        setError('No V2X deployment data available');
      }
    } catch (err) {
      console.error('Error fetching V2X deployments:', err);
      setError('Failed to load USDOT V2X deployment data');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  // Show loading or error state
  if (loading || error) {
    return (
      <div style={{
        position: 'absolute',
        bottom: '24px',
        right: '20px',
        zIndex: 1000,
        backgroundColor: error ? '#fee2e2' : '#e3f2fd',
        border: `2px solid ${error ? '#ef4444' : '#1976d2'}`,
        borderRadius: '8px',
        padding: '12px',
        maxWidth: '300px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>{error ? '❌' : '⏳'}</span>
          <div style={{ fontSize: '13px', color: error ? '#991b1b' : '#C66A1F' }}>
            <strong>{error ? 'V2X Data Error' : 'Loading V2X Deployments...'}</strong>
            {error && <p style={{ margin: '4px 0 0 0' }}>{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  // Filter to only Point geometries (ignore polygons/lines for now)
  const pointDeployments = deployments.filter(d =>
    d.geometry?.type === 'Point' &&
    d.geometry?.coordinates?.length === 2
  );

  if (pointDeployments.length === 0) {
    return (
      <div style={{
        position: 'absolute',
        bottom: '24px',
        right: '20px',
        zIndex: 1000,
        backgroundColor: '#fef3c7',
        border: '2px solid #f59e0b',
        borderRadius: '8px',
        padding: '12px',
        maxWidth: '300px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>ℹ️</span>
          <div style={{ fontSize: '13px', color: '#92400e' }}>
            <strong>No V2X Deployments Found</strong>
            <p style={{ margin: '4px 0 0 0' }}>
              {stateKey
                ? `No V2X sites in ${stateKey.toUpperCase()}`
                : 'No deployment locations available'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Info Panel */}
      <div style={{
        position: 'absolute',
        bottom: '24px',
        right: '20px',
        zIndex: 1000,
        backgroundColor: '#dbeafe',
        border: '2px solid #1976d2',
        borderRadius: '8px',
        padding: '12px',
        maxWidth: '300px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
      }}>
        <div style={{ fontSize: '13px', color: '#C66A1F' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '20px' }}>🇺🇸</span>
            <strong>USDOT V2X Deployments</strong>
          </div>
          <div style={{ marginBottom: '6px' }}>
            <strong>Displayed:</strong> {pointDeployments.length} sites
          </div>
          <div style={{ fontSize: '11px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #1976d2' }}>
            <div><strong>Legend:</strong></div>
            <div>📡 Operational V2X (Yellow)</div>
            <div>🔵 Planned V2X (Blue)</div>
            <div>📶 RSU Locations (Purple)</div>
          </div>
          <div style={{ fontSize: '10px', marginTop: '8px', color: '#6b7280' }}>
            Source: U.S. Department of Transportation
          </div>
        </div>
      </div>

      {/* V2X Deployment Markers */}
      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={50}
        spiderfyOnMaxZoom={true}
        showCoverageOnHover={false}
        iconCreateFunction={(cluster) => {
          const count = cluster.getChildCount();
          return L.divIcon({
            html: `<div style="
              background: linear-gradient(135deg, #fbbf24 0%, #60a5fa 100%);
              width: 40px;
              height: 40px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              border: 3px solid white;
              box-shadow: 0 3px 10px rgba(0,0,0,0.3);
            ">
              <div style="font-size: 14px;">🇺🇸</div>
              <div style="
                position: absolute;
                top: -5px;
                right: -5px;
                background: #C66A1F;
                color: white;
                border-radius: 10px;
                padding: 2px 6px;
                font-size: 11px;
                font-weight: bold;
                border: 2px solid white;
              ">${count}</div>
            </div>`,
            className: '',
            iconSize: [40, 40]
          });
        }}
      >
        {pointDeployments.map((deployment, idx) => {
          const [lng, lat] = deployment.geometry.coordinates;
          const props = deployment.properties || {};

          return (
            <Marker
              key={`v2x-${idx}`}
              position={[lat, lng]}
              icon={createV2XIcon(deployment)}
            >
              <Popup>
                <V2XPopupBody props={props} />
              </Popup>
            </Marker>
          );
        })}
      </MarkerClusterGroup>
    </>
  );
}

/**
 * Renders the popup contents for a USDOT V2X deployment feature.
 *
 * The dataset's field names changed when USDOT republished (capitalized
 * Name/Location/Status etc. → lowercase truncated location/loc_status/...
 * + cohort_mem/federal_gr/etc.). The popup walks both shapes so it keeps
 * working across re-publishes, and falls back to "show every non-empty
 * property with a humanized label" so even unanticipated schemas aren't
 * silently empty.
 */
function V2XPopupBody({ props }) {
  // Pick from the new schema first, fall back to the older capitalized one.
  const get = (...keys) => {
    for (const k of keys) {
      const v = props?.[k];
      if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim();
    }
    return null;
  };

  const headlineLocation = get('location', 'Location') || get('agency_hq_') || get('City');
  const state            = get('state', 'State');
  const v2xType          = get('v2x_type', 'co_v2x_typ', 'Type', 'Technology');
  const status           = get('loc_status', 'Status');
  const leadAgency       = get('lead_agenc', 'Agency') || get('co_agency_');
  const federalGrant     = get('federal_gr');
  const fundingYear      = get('federal__1');
  const cohortName       = get('co_name');
  const cohortMember     = get('cohort_mem');
  const network          = get('network_v2');
  const itswcName        = get('itswc_name');
  const itswcLocation    = get('itswc_loca');
  const description      = get('co_descrip', 'Description', 'description');
  const otherName        = get('other_name');
  const sourceLink       = get('rel_links');

  // Build the "rendered as headline rows" set — pairs we'll render explicitly.
  const headlineRows = [
    ['Location',        headlineLocation && state && !headlineLocation.endsWith(state) ? `${headlineLocation}, ${state}` : (headlineLocation || state)],
    ['V2X Type',        v2xType],
    ['Status',          status],
    ['Lead Agency',     leadAgency],
    ['Federal Grant',   federalGrant && fundingYear ? `${federalGrant} (FY${fundingYear})` : (federalGrant || (fundingYear ? `FY${fundingYear}` : null))],
    ['Cohort Program',  cohortName && cohortMember ? `${cohortName}${cohortMember.toUpperCase() === 'Y' ? ' (member)' : ''}` : cohortName],
    ['Network',         network],
    ['ITS World Cong.', itswcName || itswcLocation],
    ['Other Name',      otherName]
  ].filter(([, v]) => v);

  // Final safety net — if for any reason none of the above matched (a future
  // schema change), drop into a generic "every non-empty property" view so
  // the popup never reads as empty again.
  const fallbackRows = headlineRows.length === 0
    ? Object.entries(props || {})
        .filter(([k, v]) => v !== null && v !== undefined && String(v).trim() !== '' && !['fid', 'objectid', 'latitude', 'longitude'].includes(k.toLowerCase()))
        .slice(0, 12)
        .map(([k, v]) => [humanizeKey(k), String(v)])
    : [];

  return (
    <div style={{ minWidth: '240px', maxWidth: '320px' }}>
      <div style={{
        fontSize: '15px',
        fontWeight: 700,
        marginBottom: '8px',
        color: '#0E0E10',
        borderBottom: '2px solid #F08230',
        paddingBottom: '6px',
        fontFamily: 'var(--font-display)',
        textTransform: 'uppercase',
        letterSpacing: '0.02em'
      }}>
        USDOT V2X Deployment
      </div>

      {(headlineRows.length > 0 ? headlineRows : fallbackRows).map(([label, value]) => (
        <div key={label} style={{ marginBottom: '5px', fontSize: '12.5px', lineHeight: 1.45 }}>
          <strong style={{ color: '#1d1d1f' }}>{label}:</strong>{' '}
          <span style={{ color: '#374151' }}>{value}</span>
        </div>
      ))}

      {description && (
        <div style={{
          marginTop: '10px',
          paddingTop: '8px',
          borderTop: '1px solid #e5e7eb',
          fontSize: '12px',
          color: '#374151',
          lineHeight: 1.5
        }}>
          {description}
        </div>
      )}

      {sourceLink && (
        <div style={{ marginTop: '8px', fontSize: '11px' }}>
          <a href={sourceLink} target="_blank" rel="noopener noreferrer" style={{ color: '#C66A1F' }}>
            More info ↗
          </a>
        </div>
      )}

      <div style={{
        marginTop: '10px',
        paddingTop: '8px',
        borderTop: '1px solid #e5e7eb',
        fontSize: '10px',
        color: '#6b7280'
      }}>
        Source: U.S. Department of Transportation
      </div>
    </div>
  );
}

function humanizeKey(k) {
  return String(k)
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}
