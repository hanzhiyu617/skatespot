import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/healthz': 'http://127.0.0.1:3000'
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) {
            return 'react-vendor';
          }
          if (id.includes('/node_modules/gsap/') || id.includes('/node_modules/@gsap/')) return 'animation-vendor';
          if (id.includes('/node_modules/@hugeicons/')) return 'icon-vendor';
          if (id.includes('/node_modules/leaflet/')) return 'map-vendor';
        }
      }
    }
  }
});
