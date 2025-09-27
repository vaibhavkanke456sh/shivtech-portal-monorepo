import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 3000,
    // Force reload on file changes
    watch: {
      usePolling: true,
    },
    // Disable caching in development
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  },
  build: {
    // Generate unique filenames for cache busting
    rollupOptions: {
      output: {
        // Add timestamp to chunk names for cache busting
        chunkFileNames: 'assets/[name]-[hash]-[timestamp].js',
        entryFileNames: 'assets/[name]-[hash]-[timestamp].js',
        assetFileNames: 'assets/[name]-[hash]-[timestamp].[ext]'
      }
    }
  },
  // Clear cache on startup
  cacheDir: '.vite-cache-' + Date.now()
});
