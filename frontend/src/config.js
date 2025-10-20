// API Configuration
// TEMPORARY: Using local backend to see Ohio fix before Railway deployment
export const config = {
  apiUrl: 'http://localhost:3001',
  isDevelopment: true,
  isProduction: false,
};

// Log config on load (for debugging)
console.log('🔧 App Configuration:', config);
console.log('📡 API Base URL:', config.apiUrl);
