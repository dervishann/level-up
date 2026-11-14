import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' = App läuft unter jeder Adresse (auch GitHub Pages im Unterordner)
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: Number(process.env.PORT) || 5173 },
})
