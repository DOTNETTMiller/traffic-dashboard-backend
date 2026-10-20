'use strict';

// Reuse Corridor Communicator's collectors, rather than independently polling
// the same DOTs. Each endpoint retains its own publisher/cache clock.
function createSourceProvider({ baseUrl, fetchImpl = fetch, now = Date.now } = {}) {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('Source URL must be HTTP(S) without credentials, query or fragment.');
  const sources = [
    { id: 'corridor-events', kind: 'events', path: '/api/events?slim=false' },
    { id: 'corridor-devices', kind: 'devices', path: '/api/devices' },
    { id: 'mn-traffic', kind: 'traffic', path: '/api/traffic/mn/detectors?limit=10000' },
    { id: 'iowa-its-inventory', kind: 'inventory', path: '/api/its-equipment?stateKey=ia' }
  ];
  return async () => {
    const results = await Promise.allSettled(sources.map(async source => {
      const response = await fetchImpl(new URL(source.path, base), { signal: AbortSignal.timeout(18000), redirect: 'error' });
      if (!response.ok) throw new Error('Source unavailable.');
      const chunks = []; let size = 0;
      for await (const chunk of response.body) {
        size += chunk.byteLength;
        if (size > 30 * 1024 * 1024) throw new Error('Source exceeds 30 MB.');
        chunks.push(chunk);
      }
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const rows = source.kind === 'events' ? payload.events : source.kind === 'devices' ? payload.devices : source.kind === 'inventory' ? payload.equipment : payload.rows;
      if (!Array.isArray(rows) || rows.length > 25000 || payload.success === false) throw new Error('Invalid source envelope.');
      if (source.kind === 'events' && !Number.isFinite(Date.parse(payload.timestamp))) throw new Error('Event snapshot time missing.');
      const partial = (payload.errors?.length > 0) || ['degraded', 'unavailable', 'stale-or-empty'].includes(payload.status) ||
        (Number.isInteger(payload.count) && payload.count > rows.length) || (Number.isInteger(payload.total) && payload.total > rows.length) || payload.collectionStatus === 'partial';
      const times = [payload.timestamp, ...(source.kind === 'traffic' ? [payload.timestamps?.detectors, payload.timestamps?.stations] : [])].filter(v => v && Number.isFinite(Date.parse(v)));
      const sourceObservedAt = times.length ? new Date(Math.max(...times.map(v => Date.parse(v)))).toISOString() : null;
      return { sourceId: source.id, kind: source.kind, collectedAt: new Date(now()).toISOString(),
        sourceObservedAt, status: partial || (!sourceObservedAt && source.kind !== 'inventory') ? 'partial' : rows.length ? 'ok' : 'empty', payload };
    }));
    const collectedAt = new Date(now()).toISOString();
    const collections = results.map((r, i) => r.status === 'fulfilled' ? r.value : {
      sourceId: sources[i].id, kind: sources[i].kind, collectedAt, sourceObservedAt: null,
      status: 'unavailable', payload: null, error: 'Source request failed, exceeded its limit, or returned an invalid envelope.'
    });
    const events = collections[0];
    return { observedAt: events.sourceObservedAt || collectedAt, eventsAvailable: events.status !== 'unavailable',
      eventsComplete: ['ok', 'empty'].includes(events.status),
      events: events.payload?.events || [], devices: [], collections,
      failedSources: collections.filter(c => ['partial', 'unavailable'].includes(c.status)).length,
      sourceName: 'Corridor Communicator' };
  };
}
module.exports = { createSourceProvider };
