import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const wasmMimeTypePlugin: Plugin = {
  name: 'wasm-mime-type',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url && req.url.endsWith('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm')
      }
      next()
    })
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const projectId = env.VITE_SUPABASE_PROJECT_ID
  const proxyTarget = projectId
    ? `https://${projectId}.supabase.co/functions/v1`
    : undefined

  return {
    plugins: [react(), wasmMimeTypePlugin],
    resolve: {
      // IMPORTANT: .ts/.tsx must resolve before .js/.jsx. Vite's default order is
      // ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'], which silently prefers
      // a stale compiled .js file over the real .ts source whenever both exist with the
      // same basename (this bit us project-wide - 78 stale compiled .js twins were
      // shadowing their .ts sources). Keep .ts/.tsx first to avoid a repeat.
      extensions: ['.mts', '.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
      alias: {
        '@': resolve(__dirname, './src'),
        '@/components': resolve(__dirname, './components'),
        '@/hooks': resolve(__dirname, './hooks'),
        '@/styles': resolve(__dirname, './styles'),
        '@/supabase': resolve(__dirname, './supabase'),
        '@/contexts': resolve(__dirname, './contexts')
      }
    },
    server: {
      port: 3000,
      host: true,
      fs: {
        allow: ['.']
      },
      proxy: proxyTarget
        ? {
            '/api/functions': {
              target: proxyTarget,
              changeOrigin: true,
              secure: true,
              rewrite: (path) => path.replace(/^\/api\/functions/, '')
            }
          }
        : undefined
    },
    optimizeDeps: {
      include: ['@babylonjs/core'],
      exclude: ['@babylonjs/havok']
    },
    define: {
      global: 'globalThis'
    },
    build: {
      // IMPORTANT: do NOT add a manual `@babylonjs/core` chunk here. Forcing all of
      // @babylonjs/core into one named chunk (via rollupOptions.output.manualChunks)
      // causes Rollup to treat that entire chunk as an eager dependency of the main
      // entry the instant ANY single symbol from it is imported synchronously anywhere
      // in the app - even one small utility - which silently pulled the full ~1.25MB
      // gzip engine into every page load regardless of the React.lazy() boundaries set
      // up around BabylonWorkspace/AIVoiceAssistant/TrafficParkingSimulationPage.
      // Rollup's automatic chunker correctly splits Babylon's internals along real
      // usage boundaries and only fetches them when the lazy-loaded 3D workspace is
      // actually opened, cutting the initial page payload to ~175KB gzip.
    }
  }
})
