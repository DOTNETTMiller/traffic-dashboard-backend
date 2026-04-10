/**
 * Centralized fetch wrapper that handles auth and session expiration.
 *
 * - Automatically attaches Authorization header from localStorage
 * - On 401/403 with a token present, clears the session and redirects to login
 * - Falls through to caller for all other responses (caller can check .ok)
 *
 * Usage:
 *   import { apiFetch } from '../utils/apiFetch';
 *   const res = await apiFetch('/api/events');
 *   const data = await res.json();
 */

let sessionExpiredHandled = false;

function handleExpiredSession() {
  if (sessionExpiredHandled) return;
  sessionExpiredHandled = true;
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  alert('Your session has expired. Please log in again to continue.');
  window.location.reload();
}

export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('authToken');
  const stateKey = localStorage.getItem('stateKey');
  const statePassword = localStorage.getItem('statePassword');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // Only attach auth if not already provided
  if (!headers['Authorization']) {
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (stateKey && statePassword) {
      headers['Authorization'] = `State ${stateKey}:${statePassword}`;
    }
  }

  const response = await fetch(url, { ...options, headers });

  // If we sent a token and got rejected, the session is dead — force re-login
  if ((response.status === 401 || response.status === 403) && token) {
    // Don't redirect for endpoints that legitimately return 403 for non-auth reasons
    // (e.g., permission denied with valid token). Only handle if response indicates
    // expired/invalid token.
    try {
      const cloned = response.clone();
      const data = await cloned.json();
      const errMsg = (data.error || '').toLowerCase();
      if (errMsg.includes('expired') || errMsg.includes('invalid') || errMsg.includes('token')) {
        handleExpiredSession();
      }
    } catch {
      // Body wasn't JSON or couldn't be parsed — assume expired session
      handleExpiredSession();
    }
  }

  return response;
}

/**
 * Convenience for JSON responses
 */
export async function apiFetchJson(url, options = {}) {
  const response = await apiFetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response.json();
}
