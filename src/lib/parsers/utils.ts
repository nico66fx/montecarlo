// Utilidades compartidas por todos los parsers: números, fechas, cabeceras.

/**
 * Parsea un número tolerando formatos europeos y americanos.
 * Maneja "1 234,56", "1,234.56", "1.234,56", espacios finos, paréntesis (negativos).
 */
export function parseNumber(raw: string | number | null | undefined): number {
  if (raw == null) return NaN;
  if (typeof raw === 'number') return raw;
  let s = String(raw).trim();
  if (!s) return NaN;

  // Negativos entre paréntesis: (123.45) => -123.45
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }

  // Quitar símbolos de moneda, espacios (incluido NBSP/espacio fino) y demás ruido.
  s = s.replace(/[\s  ]/g, '').replace(/[^0-9.,\-+eE]/g, '');
  if (!s) return NaN;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    // El último separador que aparece es el decimal.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // formato europeo: 1.234,56
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // formato US: 1,234.56
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Solo coma: si parece separador de miles (grupos de 3) lo quitamos; si no, es decimal.
    if (/^\d{1,3}(,\d{3})+$/.test(s)) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(',', '.');
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -n : n) : NaN;
}

/** Igual que parseNumber pero devuelve 0 en vez de NaN (para swaps/comisiones opcionales). */
export function parseNumberOr0(raw: string | number | null | undefined): number {
  const n = parseNumber(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parsea fechas de MT4/MT5 en sus múltiples formatos:
 * "2023.05.14 10:30:00", "2023-05-14 10:30", "14/05/2023 10:30", "2023.05.14 10:30:00.123"
 */
export function parseDate(raw: string | number | Date | null | undefined): Date | null {
  if (raw == null) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'number') {
    // Posible serial de Excel (días desde 1899-12-30).
    if (raw > 20000 && raw < 80000) {
      const ms = Math.round((raw - 25569) * 86400 * 1000);
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  let s = String(raw).trim();
  if (!s) return null;
  // Quitar milisegundos.
  s = s.replace(/\.\d+$/, '');

  // Formato MT: 2023.05.14 10:30:00
  let m = s.match(
    /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/,
  );
  if (m) {
    const [, y, mo, d, h = '0', mi = '0', se = '0'] = m;
    return new Date(+y, +mo - 1, +d, +h, +mi, +se);
  }
  // Formato DD/MM/YYYY o DD.MM.YYYY
  m = s.match(
    /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/,
  );
  if (m) {
    const [, d, mo, y, h = '0', mi = '0', se = '0'] = m;
    return new Date(+y, +mo - 1, +d, +h, +mi, +se);
  }
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/** Normaliza texto de cabecera: minúsculas, sin acentos, sin signos. */
export function normHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Sinónimos de cabeceras (EN/ES) -> clave canónica. */
const HEADER_SYNONYMS: Record<string, string[]> = {
  time: ['time', 'open time', 'close time', 'hora', 'fecha', 'tiempo', 'time close'],
  openTime: ['open time', 'time open', 'hora apertura', 'fecha apertura', 'apertura'],
  closeTime: ['close time', 'time close', 'hora cierre', 'fecha cierre', 'cierre'],
  deal: ['deal', 'order', 'ticket', 'orden', 'transaccion', 'transaction', 'position'],
  symbol: ['symbol', 'simbolo', 'instrumento', 'item', 'par'],
  type: ['type', 'tipo', 'direccion', 'direction', 'action'],
  volume: ['volume', 'lots', 'size', 'volumen', 'lotes', 'lote'],
  price: ['price', 'precio'],
  openPrice: ['open price', 'price open', 'precio apertura'],
  closePrice: ['close price', 'price close', 'precio cierre'],
  sl: ['s l', 'sl', 'stop loss', 'stoploss'],
  tp: ['t p', 'tp', 'take profit', 'takeprofit'],
  commission: ['commission', 'comision', 'comisiones', 'fee'],
  swap: ['swap', 'rollover'],
  profit: ['profit', 'beneficio', 'ganancia', 'pnl', 'p l', 'net profit', 'resultado'],
  balance: ['balance', 'saldo'],
  comment: ['comment', 'comentario'],
};

/**
 * Dado un array de cabeceras crudas, devuelve un mapa clave-canónica -> índice de columna.
 */
export function mapHeaders(headers: string[]): Partial<Record<string, number>> {
  const normed = headers.map(normHeader);
  const result: Partial<Record<string, number>> = {};
  for (const [canonical, syns] of Object.entries(HEADER_SYNONYMS)) {
    for (let i = 0; i < normed.length; i++) {
      if (result[canonical] != null) break;
      const h = normed[i];
      if (syns.includes(h)) {
        result[canonical] = i;
      }
    }
    // Segunda pasada: coincidencia parcial.
    if (result[canonical] == null) {
      for (let i = 0; i < normed.length; i++) {
        const h = normed[i];
        if (syns.some((syn) => h === syn || h.includes(syn))) {
          result[canonical] = i;
          break;
        }
      }
    }
  }
  return result;
}

/** Detecta el lado (long/short) a partir del texto del tipo. */
export function parseSide(raw: string): TradeSide | null {
  const t = normHeader(raw);
  if (!t) return null;
  if (/\b(buy|long|compra|comprar)\b/.test(t) || t === 'buy') return 'long';
  if (/\b(sell|short|venta|vender)\b/.test(t) || t === 'sell') return 'short';
  if (t.includes('buy') || t.includes('compra') || t.includes('long')) return 'long';
  if (t.includes('sell') || t.includes('venta') || t.includes('short')) return 'short';
  return null;
}

import type { TradeSide } from '../../types';
