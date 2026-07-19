import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/runesphere/', 
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'RuneSphere Finder',
        short_name: 'RuneSphere',
        description: 'Predict RuneSphere search windows for RuneScape 3.',
        // Vite prefixes 'base' automatically if you omit the leading slash here
        start_url: '.', 
        background_color: '#020617',
        theme_color: '#0f172a',
        icons: [
          {
            src: 'favicon.svg', // Becomes /runesphere/favicon.svg automatically
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      }
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});