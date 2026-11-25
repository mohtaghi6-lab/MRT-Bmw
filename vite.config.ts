import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

function disableHmrClientWsPlugin(): Plugin {
  return {
    name: 'disable-hmr-client-ws',
    apply: 'serve',
    enforce: 'post',
    transform(code, id) {
      if (id.includes('vite/dist/client/client.mjs') || id.endsWith('/@vite/client')) {
        return code.replace(
          /const transport = normalizeModuleRunnerTransport\(\s*\(\(\) => \{[\s\S]*?\}\)\(\)\s*\);/,
          'const transport = normalizeModuleRunnerTransport({ connect() {}, disconnect() {}, send() {} });'
        );
      }
      return null;
    },
  };
}

export default defineConfig(() => {
  const rawBase = process.env.VITE_BASE_PATH || '/';
  const basePath = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

  return {
    base: basePath,
    plugins: [
      react(),
      tailwindcss(),
      disableHmrClientWsPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'apple-touch-icon.png',
          'icon.svg',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: basePath,
          name: 'BMW 728Li iDrive Cockpit',
          short_name: 'BMW 728Li',
          description: 'سیستم هوشمند کاکپیت، داشبورد و دستیار صوتی خودروی BMW 728Li',
          theme_color: '#09090b',
          background_color: '#09090b',
          display: 'standalone',
          orientation: 'landscape',
          start_url: basePath,
          scope: basePath,
          icons: [
            {
              src: `${basePath}pwa-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${basePath}pwa-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${basePath}pwa-maskable-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          clientsClaim: true,
          skipWaiting: true,
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff,woff2}'],
          navigateFallback: `${basePath}index.html`,
          navigateFallbackDenylist: [/^\/api\//, /^\/src\//, /^\/@/, /^\/node_modules\//],
          runtimeCaching: [
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|webp|woff2?)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'bmw-cockpit-static-assets',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 950,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('/node_modules/three/')) {
              return 'vendor-three';
            }
            if (id.includes('/node_modules/firebase/') || id.includes('/node_modules/@firebase/')) {
              return 'vendor-firebase';
            }
            if (
              id.includes('/node_modules/recharts/') ||
              id.includes('/node_modules/d3-') ||
              id.includes('/node_modules/victory-vendor/')
            ) {
              return 'vendor-charts';
            }
            if (id.includes('/node_modules/lucide-react/')) {
              return 'vendor-icons';
            }
            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
