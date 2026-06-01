import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// En producción se sirve en https://nico66fx.github.io/montecarlo/.
// En dev se sirve en la raíz para facilitar la previsualización.
export default defineConfig(function (_a) {
    var _b;
    var command = _a.command;
    return ({
        base: (_b = process.env.VITE_BASE) !== null && _b !== void 0 ? _b : (command === 'build' ? '/montecarlo/' : '/'),
        plugins: [react()],
        worker: { format: 'es' },
    });
});
