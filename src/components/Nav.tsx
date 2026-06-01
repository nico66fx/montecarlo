import { LINKS } from '../lib/links';

interface NavProps {
  hasData: boolean;
  onReset: () => void;
  fileName?: string;
}

export function Nav({ hasData, onReset, fileName }: NavProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-base/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <a href="https://nico66fx.github.io/tools/" className="flex items-center gap-2.5" title="Volver a las herramientas">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl shadow-glow">
            <svg viewBox="0 0 64 64" className="h-9 w-9">
              <defs>
                <linearGradient id="mclogo" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
              <rect width="64" height="64" rx="16" fill="url(#mclogo)" />
              <circle cx="22" cy="24" r="4" fill="#0a0f1d" />
              <circle cx="40" cy="18" r="4" fill="#0a0f1d" />
              <circle cx="32" cy="38" r="4" fill="#0a0f1d" />
              <circle cx="46" cy="44" r="4" fill="#0a0f1d" />
              <circle cx="18" cy="46" r="4" fill="#0a0f1d" />
            </svg>
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-extrabold tracking-tight text-white">Monte Carlo</span>
            <span className="block text-[10px] uppercase tracking-widest text-brand-400">Robustez · by nico66fx</span>
          </span>
        </a>

        <span className="rounded-full border border-pos/30 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
          100% LOCAL
        </span>

        <div className="ml-auto flex items-center gap-3">
          {hasData && fileName && (
            <span className="hidden max-w-[200px] truncate text-xs text-slate-500 md:inline" title={fileName}>
              {fileName}
            </span>
          )}
          {hasData && (
            <button
              onClick={onReset}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-neg/40 hover:text-neg"
            >
              Otro backtest
            </button>
          )}
          <a href={LINKS.site} target="_blank" rel="noopener noreferrer" className="btn-glow" title="Bots y comunidad de trading algorítmico">
            <span className="glow-dot" />
            Comunidad PRO
          </a>
        </div>
      </div>
    </header>
  );
}
