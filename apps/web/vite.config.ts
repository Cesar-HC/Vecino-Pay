/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// /api se redirige a la API local (puerto 3000), tanto en desarrollo (vite) como en la demo (vite preview).
// xfwd agrega X-Forwarded-For: la API cuenta los intentos de ingreso por IP real (trust proxy = 1).
const proxy = {
  '/api': { target: process.env.API_URL ?? 'http://127.0.0.1:3000', xfwd: true },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy,
  },
  // La demo sirve el dist compilado en 127.0.0.1:8080; para verla desde otro equipo, usar --host a mano.
  preview: {
    host: '127.0.0.1',
    port: Number(process.env.WEB_PORT ?? 8080),
    strictPort: true,
    proxy,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/pruebas/entorno.ts'],
    css: false,
  },
});
