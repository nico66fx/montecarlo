import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En producción se sirve en https://nico66fx.github.io/montecarlo/.
// En dev se sirve en la raíz para facilitar la previsualización.
export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE ?? (command === 'build' ? '/montecarlo/' : '/'),
  plugins: [react()],
  worker: { format: 'es' },
}));
