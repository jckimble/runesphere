import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig(function () {
    return {
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
                    start_url: '.',
                    background_color: '#020617',
                    theme_color: '#0f172a',
                    icons: [
                        {
                            src: 'favicon.svg',
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
    };
});
