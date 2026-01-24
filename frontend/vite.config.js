import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite configuration for Corridor Communicator - includes 3D model viewer support and PWA
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    // Ensure WASM files are copied to dist folder
    assetsInlineLimit: 0, // Don't inline WASM files
    rollupOptions: {
      output: {
        // Keep WASM files in their original location
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.wasm')) {
            return 'wasm/[name][extname]';
          }
          // Keep PWA assets in root
          if (assetInfo.name && (assetInfo.name.endsWith('.json') || assetInfo.name === 'service-worker.js')) {
            return '[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    },
    // Copy public assets to dist
    copyPublicDir: true
  },
  // Explicitly allow WASM files and PWA assets
  assetsInclude: ['**/*.wasm'],
  publicDir: 'public'
})
