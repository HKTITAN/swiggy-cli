import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `fs.allow: ['..']` lets the scenes read the repo's package.json (the
// version in the app header) and assets/swiggy-logo.svg, unmodified.
export default defineConfig({
  plugins: [react()],
  build: { target: 'es2022' },
  server: { host: '127.0.0.1', port: 4720, strictPort: true, fs: { allow: ['..'] } },
  resolve: { dedupe: ['react', 'react-dom'] },
})
