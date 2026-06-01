import { LINKS } from '../lib/links';

/**
 * Bloque de redirección a la comunidad de nico66fx. Tasteful, sin spam:
 * deja claro que la tool es gratis y ofrece el siguiente paso a quien quiera.
 */
export function CommunityCTA() {
  return (
    <div className="animate-rise relative overflow-hidden rounded-2xl border border-brand/25 card-glass p-6 sm:p-8">
      {/* glow decorativo */}
      <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-brand/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <div className="eyebrow text-accent-400">nico66fx PRO · Trading algorítmico</div>
          <h3 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">
            ¿Y si tus <span className="text-gradient">bots operasen por ti?</span>
          </h3>
          <p className="mt-2 text-sm text-slate-300">
            Esta herramienta es 100% gratuita. Si quieres dar el siguiente paso: bots listos para
            usar, copy-trading, cuentas auditadas en Myfxbook y una comunidad privada de trading
            algorítmico te esperan.
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="live-dot" /> Cuentas auditadas en vivo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="glow-dot" /> Comunidad +3.700 traders
            </span>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2.5 sm:w-auto">
          <a
            href={LINKS.site}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full sm:w-auto"
          >
            Descubrir los bots
            <span aria-hidden>↗</span>
          </a>
          <a
            href={LINKS.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-glow w-full justify-center sm:w-auto"
          >
            <span className="glow-dot" />
            Comunidad gratis en Telegram
          </a>
        </div>
      </div>
    </div>
  );
}
