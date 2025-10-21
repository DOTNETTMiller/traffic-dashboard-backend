// API Configuration helper
const envApiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';

const fallbackApiUrl = (() => {
  if (import.meta.env.DEV) {
    // Use same-origin paths so Vite's proxy can forward to the backend
    return '';
  }

  if (typeof window !== 'undefined') {
    // Assume production frontend is served from the same origin as the API
    return window.location.origin;
  }

  // Fallback for SSR/build tools
  return 'http://localhost:3001';
})();

export const config = {
  apiUrl: envApiUrl || fallbackApiUrl,
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};

// Log config on load (for debugging)
console.log('🔧 App Configuration:', config);
console.log('📡 API Base URL:', config.apiUrl || '(same origin)');
