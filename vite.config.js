import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import netlify from '@netlify/vite-plugin';

export default defineConfig({
  plugins: [react(), netlify()],
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
