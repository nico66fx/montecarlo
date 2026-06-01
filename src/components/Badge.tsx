import type { ReactNode } from 'react';

type Tone = 'brand' | 'pos' | 'neg' | 'neutral';

const TONES: Record<Tone, string> = {
  brand: 'bg-brand/15 text-brand border-brand/30',
  pos: 'bg-pos/15 text-pos border-pos/30',
  neg: 'bg-neg/15 text-neg border-neg/30',
  neutral: 'bg-white/5 text-slate-300 border-white/10',
};

export function Badge({
  children,
  tone = 'neutral',
  pulse = false,
}: {
  children: ReactNode;
  tone?: Tone;
  pulse?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}
    >
      {pulse && (
        <span className={`h-1.5 w-1.5 rounded-full bg-current ${pulse ? 'animate-pulse-dot' : ''}`} />
      )}
      {children}
    </span>
  );
}
