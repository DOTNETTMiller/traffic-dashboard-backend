// API Configuration
// Using Railway backend (has all credentials and data)
export const config = {
  apiUrl: 'https://traffic-dashboard-backend-production.up.railway.app',
  isDevelopment: false,
  isProduction: true,
};

// Log config on load (for debugging)
console.log('🔧 App Configuration:', config);
console.log('📡 API Base URL:', config.apiUrl);
