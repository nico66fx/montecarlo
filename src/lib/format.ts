// Helpers de formato para la UI.

export function fmtMoney(n: number, currency = 'USD'): string {
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function fmtNum(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return n === Infinity ? '∞' : '—';
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function fmtPct(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return n === Infinity ? '∞' : '—';
  return `${n >= 0 ? '' : ''}${fmtNum(n, decimals)}%`;
}

export function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-ES').format(Math.round(n));
}

export function fmtDate(d: Date | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(d);
}

export function fmtDateTime(d: Date | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** Duración legible a partir de ms. */
export function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const mins = ms / 60000;
  if (mins < 60) return `${Math.round(mins)} min`;
  const hours = mins / 60;
  if (hours < 48) return `${fmtNum(hours, 1)} h`;
  const days = hours / 24;
  return `${fmtNum(days, 1)} días`;
}

export function fmtDays(d: number): string {
  if (!Number.isFinite(d)) return '—';
  return `${fmtNum(d, d < 10 ? 1 : 0)} días`;
}
