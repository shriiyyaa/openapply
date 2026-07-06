import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works at any path (GitHub Pages serves under /openapply/).
  base: './',
  plugins: [react(), tailwindcss()],
})
