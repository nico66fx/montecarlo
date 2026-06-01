import { histogram } from '../lib/montecarlo';

interface Props {
  values: number[];
  /** 'sign' colorea verde/rojo según positivo/negativo · 'dd' todo rojo. */
  palette?: 'sign' | 'dd';
  unit?: string;
  buckets?: number;
}

/** Histograma ligero (sin librerías) de la distribución de resultados. */
export function Histogram({ values, palette = 'sign', unit = '%', buckets = 28 }: Props) {
  const bins = histogram(values, buckets);
  if (!bins.length) return <div className="h-32" />;
  const max = Math.max(...bins.map((b) => b.count));
  const lo = bins[0].lo;
  const hi = bins[bins.length - 1].hi;

  return (
    <div>
      <div className="flex h-36 items-end gap-px">
        {bins.map((b, i) => {
          const h = max ? (b.count / max) * 100 : 0;
          const color =
            palette === 'dd'
              ? '#f87171'
              : b.mid >= 0
                ? '#34d399'
                : '#f87171';
          return (
            <div
              key={i}
              className="flex-1 rounded-t-sm transition-all"
              style={{ height: `${h}%`, background: color, opacity: 0.55 + (h / 100) * 0.45, minHeight: b.count ? 2 : 0 }}
              title={`${b.lo.toFixed(1)}…${b.hi.toFixed(1)}${unit}: ${b.count}`}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-500 tnum">
        <span>{lo.toFixed(1)}{unit}</span>
        <span>{hi.toFixed(1)}{unit}</span>
      </div>
    </div>
  );
}
