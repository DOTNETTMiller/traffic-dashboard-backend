const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
let trainingToken = null, betaToken = null;
export function setTrainingToken(value) { trainingToken = value; }
// Hosted beta: identifies this account's sandbox when choosing a training role.
export function setBetaToken(value) { betaToken = value; }
export async function druPreviewPhotoUrl(bundleId, index, signal) {
  const response = await fetch(base + '/api/atms/architecture/dru/bundles/' + encodeURIComponent(bundleId) + '/photos/' + index, {
    credentials: 'omit', cache: 'no-store', signal: signal || AbortSignal.timeout(25000),
    headers: { Authorization: 'Bearer ' + (trainingToken || localStorage.getItem('authToken')) }
  });
  if (!response.ok) throw new Error('Photograph unavailable');
  return URL.createObjectURL(await response.blob());
}
export async function uploadDruBundle(file, key) {
  const form = new FormData(); form.append('bundle', file);
  const response = await fetch(base + '/api/atms/architecture/dru/bundles', {
    method: 'POST', body: form, credentials: 'omit', signal: AbortSignal.timeout(60000),
    headers: { Authorization: 'Bearer ' + (trainingToken || localStorage.getItem('authToken')), 'X-ATMS-Client': 'workspace', 'Idempotency-Key': key }
  });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || 'DRU upload failed.'); return result;
}
export async function downloadDruBundle(id) {
  const response = await fetch(base + '/api/atms/architecture/dru/bundles/' + encodeURIComponent(id) + '/content', {
    credentials: 'omit', signal: AbortSignal.timeout(60000), headers: { Authorization: 'Bearer ' + (trainingToken || localStorage.getItem('authToken')) }
  });
  if (!response.ok) throw new Error('DRU source bundle is unavailable or failed its integrity check.');
  const url = URL.createObjectURL(await response.blob()), link = document.createElement('a');
  link.href = url; link.download = id + '.dru-session'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function uploadArchitecturePhoto(assetId, file, fields) {
  const form = new FormData(); form.append('photo', file);
  for (const [key, value] of Object.entries(fields)) if (value) form.append(key, value);
  const response = await fetch(base + '/api/atms/architecture/assets/' + encodeURIComponent(assetId) + '/photos', {
    method: 'POST', body: form, credentials: 'omit', signal: AbortSignal.timeout(30000),
    headers: { Authorization: 'Bearer ' + (trainingToken || localStorage.getItem('authToken')), 'X-ATMS-Client': 'workspace', 'Idempotency-Key': crypto.randomUUID() }
  });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Photo upload failed.'); return result;
}
export async function architecturePhotoUrl(id) {
  const response = await fetch(base + '/api/atms/architecture/photos/' + encodeURIComponent(id) + '/content', {
    credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(25000), headers: { Authorization: 'Bearer ' + (trainingToken || localStorage.getItem('authToken')) }
  });
  if (!response.ok) throw new Error('Photograph is unavailable or its integrity check failed.');
  return URL.createObjectURL(await response.blob());
}
export async function request(path, { method = 'GET', body, key, anonymous = false } = {}) {
  const token = trainingToken || localStorage.getItem('authToken');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(base + '/api/atms' + path, {
      method, signal: controller.signal, cache: 'no-store', credentials: 'omit',
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json', 'X-ATMS-Client': 'workspace', 'Idempotency-Key': key || crypto.randomUUID() } : {}), ...(!anonymous && token ? { Authorization: 'Bearer ' + token } : {}), ...(betaToken ? { 'X-ATMS-Beta': betaToken } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const text = await response.text();
    let data; try { data = JSON.parse(text); } catch { throw new Error('The ATMS service did not return a usable response. Check its connection.'); }
    if (!response.ok) { const error = new Error(data.error || 'The operation was not confirmed.'); error.status = response.status; throw error; }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The request timed out. Refresh and inspect the record before retrying; its outcome may be uncertain.');
    throw error;
  } finally { clearTimeout(timer); }
}
export function saveJson(value, filename) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function cameraMediaPath(cameraId, shareId) {
  return base + '/api/atms/video/' + (shareId ? 'public/' + encodeURIComponent(shareId) : 'cameras/' + encodeURIComponent(cameraId)) + '/media/index';
}
export function cameraAuthHeaders(url) {
  const target = new URL(url, location.href), apiOrigin = new URL(base || location.origin).origin;
  if (target.origin !== apiOrigin || !target.pathname.startsWith('/api/atms/video/')) throw new Error('Unapproved camera media address.');
  return { Authorization: 'Bearer ' + (trainingToken || localStorage.getItem('authToken')) };
}
