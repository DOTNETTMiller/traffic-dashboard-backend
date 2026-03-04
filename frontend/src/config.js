// API Configuration helper
// In production, use empty string (relative URLs) since frontend and backend are on same origin
// In development, use empty string with Vite proxy
const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';

export const config = {
  apiUrl,
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};

// Log config on load (for debugging)
console.log('🔧 App Configuration:', config);
console.log('📡 API URL:', config.apiUrl || '(relative URLs - same origin)');
