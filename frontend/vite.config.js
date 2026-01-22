import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite configuration for Corridor Communicator - includes 3D model viewer support
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
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  },
  // Explicitly allow WASM files
  assetsInclude: ['**/*.wasm']
})
