import { useCallback, useRef, useState } from 'react';
import type { ParseResult } from '../types';
import { parseFile } from '../lib/parsers';
import { generateSample } from '../lib/sample';

interface FileDropProps {
  onLoaded: (result: ParseResult) => void;
}

export function FileDrop({ onLoaded }: FileDropProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || !files.length) return;
      setLoading(true);
      setError(null);
      try {
        const result = await parseFile(files[0]);
        if (result.trades.length === 0) {
          setError(result.warnings[0] ?? 'No se encontraron operaciones en el archivo.');
          setLoading(false);
          return;
        }
        onLoaded(result);
      } catch (e) {
        setError(`Error al leer el archivo: ${(e as Error).message}`);
      }
      setLoading(false);
    },
    [onLoaded],
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`group cursor-pointer rounded-3xl border-2 border-dashed p-10 text-center transition ${
          dragOver ? 'border-brand bg-brand/5 shadow-glow' : 'border-white/15 bg-surface/40 hover:border-brand/50 hover:bg-surface/60'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".htm,.html,.xml,.csv,.tsv,.txt,.xlsx,.xls"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand-400 transition group-hover:scale-105">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 16V4m0 0L8 8m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-lg font-bold text-white">{loading ? 'Procesando…' : 'Arrastra tu reporte de backtest aquí'}</p>
        <p className="mt-1 text-sm text-slate-400">o haz clic · MT4 (.htm) · MT5 (.html / .xml) · CSV · XLSX</p>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-neg/30 bg-neg/10 px-4 py-3 text-sm text-red-200">{error}</div>
      )}

      <div className="mt-6 flex flex-col items-center gap-3">
        <button onClick={() => onLoaded(generateSample())} className="btn-primary">
          Cargar datos de ejemplo
        </button>
        <p className="max-w-md text-center text-xs text-slate-500">
          🔒 Todo se procesa en tu navegador. Tu backtest no se sube a ningún servidor.
        </p>
      </div>
    </div>
  );
}
