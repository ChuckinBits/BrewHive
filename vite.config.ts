import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps every asset path relative, so the same build works on
// GitHub Pages, a custom domain, or any folder of a self-hosted server.
export default defineConfig({
  base: './',
  plugins: [react()],
});
