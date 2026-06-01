import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Retraso de animación de entrada (ms). */
  delay?: number;
}

/** Tarjeta glassmorphism base. */
export function Card({ children, className = '', delay = 0 }: CardProps) {
  return (
    <div
      className={`animate-fade-up card-glass rounded-2xl p-5 ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}

/** Cabecera de sección con detalle dorado tipo "PRO". */
export function SectionTitle({ title, subtitle, right }: SectionTitleProps) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-brand shadow-glow" />
          <h2 className="text-xl font-bold tracking-tight text-white brand-glow sm:text-2xl">
            {title}
          </h2>
        </div>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
