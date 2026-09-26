import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

const API_TARGET = 'http://localhost:4000';
// Phones only allow camera access over HTTPS, so Scan Mode on a real device needs `npm run dev:https`.
const https = process.env.HTTPS === '1';

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(https ? [basicSsl()] : [])],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    port: 5173,
    // host: true lets you open the app from a phone on the same Wi-Fi (Scan Mode).
    host: true,
    proxy: {
      '/api': API_TARGET,
      '/socket.io': { target: API_TARGET, ws: true },
    },
  },
});
