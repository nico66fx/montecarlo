import type { ReactNode } from 'react';
import { Card } from './Card';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  /** Color del valor: positivo/negativo/oro/neutral. */
  tone?: 'pos' | 'neg' | 'brand' | 'default';
  delay?: number;
  big?: boolean;
}

const TONE_CLASS: Record<NonNullable<StatCardProps['tone']>, string> = {
  pos: 'text-pos',
  neg: 'text-neg',
  brand: 'text-brand',
  default: 'text-white',
};

export function StatCard({ label, value, hint, tone = 'default', delay = 0, big = false }: StatCardProps) {
  return (
    <Card delay={delay} className="flex flex-col justify-between">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`tnum mt-2 font-bold ${big ? 'text-3xl' : 'text-2xl'} ${TONE_CLASS[tone]}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </Card>
  );
}
