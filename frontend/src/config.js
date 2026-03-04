// API Configuration helper
// Use getter to ensure runtime evaluation in browser
const getApiUrl = () => {
  const envApiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '');

  if (envApiUrl) {
    return envApiUrl;
  }

  if (import.meta.env.DEV) {
    // Use same-origin paths so Vite's proxy can forward to the backend
    return '';
  }

  // Production: use same origin (Railway serves frontend and backend on same domain)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Should never reach here in browser, but needed for build time
  return '';
};

export const config = {
  get apiUrl() {
    return getApiUrl();
  },
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};

// Log config on load (for debugging)
console.log('🔧 App Configuration:', config);
console.log('📡 API Base URL:', config.apiUrl || '(same origin)');
