import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The Content-Security-Policy for the built app. BrewHive loads nothing from anywhere else and
 * sends your data nowhere, so the policy only allows its own files: if anything ever slipped
 * into the page, it couldn't load a script or send data off. Styles allow inline because React
 * sets style attributes. Added to the build only: the dev server injects inline scripts.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'brewhive-csp',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
  };
}

// base './' keeps every asset path relative, so the same build works on
// GitHub Pages, a custom domain, or any folder of a self-hosted server.
export default defineConfig({
  base: './',
  plugins: [react(), contentSecurityPolicy()],
});
