// Construye operaciones normalizadas a partir de una tabla genérica (matriz de celdas).
// Lo usan los parsers de CSV, XLSX y las tablas de "Deals" de HTML MT5.

import type { Trade } from '../../types';
import {
  mapHeaders,
  normHeader,
  parseDate,
  parseNumber,
  parseNumberOr0,
  parseSide,
} from './utils';

type Cell = string | number | null;

/** Encuentra la fila de cabecera dentro de las primeras filas de la matriz. */
function findHeaderRow(rows: Cell[][]): number {
  // Columnas "normales" (1 punto) y columnas "fuertes" propias de una tabla de
  // operaciones/transacciones (3 puntos), para preferir la tabla de Deals/Trades
  // frente a la de Órdenes en informes MT5 con varias secciones.
  const wanted = [
    'symbol', 'simbolo', 'type', 'tipo', 'volume', 'volumen', 'lots', 'lotes',
    'price', 'precio', 'swap', 'comision', 'commission',
  ];
  const strong = ['profit', 'beneficio', 'ganancia', 'balance', 'saldo', 'direccion', 'direction'];
  let best = -1;
  let bestScore = 0;
  // Recorremos TODAS las filas: en informes completos la tabla buena puede estar
  // muy abajo (p.ej. "Transacciones" tras decenas de filas de metadatos y órdenes).
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map((c) => normHeader(String(c ?? '')));
    let score = 0;
    for (const c of cells) {
      if (!c) continue;
      if (wanted.includes(c)) score += 1;
      else if (strong.includes(c)) score += 3;
    }
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return bestScore >= 3 ? best : -1;
}

export interface TableParseOutput {
  trades: Trade[];
  warnings: string[];
}

/**
 * Convierte una matriz de celdas en operaciones.
 * Detecta si es una tabla de "Deals" (MT5, dos filas por trade: in/out) o una tabla
 * de trades cerrados (una fila por operación) y normaliza ambas.
 */
export function tradesFromTable(rows: Cell[][], initialDeposit?: number): TableParseOutput {
  const warnings: string[] = [];
  const headerRow = findHeaderRow(rows);
  if (headerRow < 0) {
    return { trades: [], warnings: ['No se encontró una fila de cabeceras reconocible.'] };
  }
  const headers = rows[headerRow].map((c) => String(c ?? ''));
  const cols = mapHeaders(headers);
  const dataRows = rows.slice(headerRow + 1).filter((r) => r.some((c) => c != null && String(c).trim() !== ''));

  // ¿Es un libro de "Deals"/"Transacciones" de MT5? Heurística: hay columna
  // Dirección/Direction y aparece "in"/"out". Normalizamos para tolerar acentos
  // ("Dirección") e idiomas.
  const dirColRaw = headers.findIndex((h) => {
    const n = normHeader(h);
    return n === 'direccion' || n === 'direction' || n.includes('direccion') || n.includes('direction') || n === 'entry';
  });
  const looksLikeDeals =
    dirColRaw >= 0 &&
    cols.profit != null &&
    dataRows.some((r) => /^(in|out|en|sal)/i.test(normHeader(String(r[dirColRaw] ?? ''))));

  const trades = looksLikeDeals
    ? tradesFromDeals(dataRows, cols, dirColRaw, warnings)
    : tradesFromClosedRows(dataRows, cols, warnings);

  // Rellenar balanceAfter si falta.
  let running = initialDeposit ?? 0;
  const hasBalance = trades.some((t) => Number.isFinite(t.balanceAfter) && t.balanceAfter !== 0);
  if (!hasBalance) {
    for (const t of trades) {
      running += t.profit;
      t.balanceAfter = running;
    }
  }
  return { trades, warnings };
}

/** Una fila = una operación cerrada (formato típico de exports/statement). */
function tradesFromClosedRows(
  rows: Cell[][],
  cols: Partial<Record<string, number>>,
  warnings: string[],
): Trade[] {
  const trades: Trade[] = [];
  let idx = 0;
  for (const r of rows) {
    const get = (k: string) => (cols[k] != null ? r[cols[k]!] : null);

    const sideRaw = String(get('type') ?? '');
    const side = parseSide(sideRaw);
    // Saltar filas que no son operaciones (balance, deposit, etc.)
    if (!side) {
      if (/balance|deposit|deposito|credit|withdrawal/i.test(sideRaw)) continue;
      if (cols.type != null) continue;
    }

    const lots = parseNumber(get('volume'));
    const profitRaw = get('profit');
    if (profitRaw == null && lots == null) continue;

    const openTime = parseDate(get('openTime') ?? get('time'));
    const closeTime = parseDate(get('closeTime') ?? get('time'));

    trades.push({
      index: idx++,
      openTime,
      closeTime: closeTime ?? openTime,
      symbol: String(get('symbol') ?? '').trim() || '—',
      type: side ?? 'long',
      lots: Number.isFinite(lots) ? lots : 0,
      openPrice: finiteOrNull(parseNumber(get('openPrice') ?? get('price'))),
      closePrice: finiteOrNull(parseNumber(get('closePrice'))),
      sl: finiteOrNull(parseNumber(get('sl'))),
      tp: finiteOrNull(parseNumber(get('tp'))),
      commission: parseNumberOr0(get('commission')),
      swap: parseNumberOr0(get('swap')),
      profit: parseNumberOr0(profitRaw),
      balanceAfter: parseNumber(get('balance')),
    });
  }
  if (trades.length === 0) warnings.push('No se extrajeron operaciones de la tabla.');
  return trades;
}

interface PendingIn {
  time: Date | null;
  price: number | null;
  side: ReturnType<typeof parseSide>;
  symbol: string;
  lots: number;
}

/**
 * Tabla de "Deals" / "Transacciones" de MT5: cada posición tiene un deal "in"
 * (entrada) y "out" (salida). El deal "out" trae Beneficio/Comisión/Swap/Balance.
 *
 * Emparejamos las entradas con una cola FIFO por símbolo, de modo que funcione
 * aunque haya varias posiciones abiertas a la vez (cobertura / multi-posición).
 */
function tradesFromDeals(
  rows: Cell[][],
  cols: Partial<Record<string, number>>,
  dirCol: number,
  warnings: string[],
): Trade[] {
  const trades: Trade[] = [];
  let idx = 0;
  // Cola de entradas pendientes por símbolo (FIFO).
  const pending = new Map<string, PendingIn[]>();

  for (const r of rows) {
    const get = (k: string) => (cols[k] != null ? r[cols[k]!] : null);
    const dir = normHeader(String(r[dirCol] ?? ''));
    const isIn = dir.startsWith('in') || dir.startsWith('en');
    const isOut = dir.startsWith('out') || dir.startsWith('sal');

    const side = parseSide(String(get('type') ?? ''));
    const time = parseDate(get('time') ?? get('closeTime') ?? get('openTime'));
    const price = finiteOrNull(parseNumber(get('price') ?? get('openPrice')));
    const symbol = String(get('symbol') ?? '').trim();
    const lots = parseNumber(get('volume'));

    if (isIn && symbol) {
      const q = pending.get(symbol) ?? [];
      q.push({ time, price, side, symbol, lots: Number.isFinite(lots) ? lots : 0 });
      pending.set(symbol, q);
      continue;
    }
    if (isOut) {
      const q = pending.get(symbol);
      const entry = q && q.length ? q.shift()! : null;
      const commission = parseNumberOr0(get('commission'));
      const swap = parseNumberOr0(get('swap'));
      const gross = parseNumberOr0(get('profit'));
      // En MT5 el deal "out" tiene tipo contrario a la posición; usamos el "in".
      trades.push({
        index: idx++,
        openTime: entry?.time ?? null,
        closeTime: time,
        symbol: entry?.symbol ?? symbol ?? '—',
        type: entry?.side ?? (side === 'long' ? 'short' : 'long'),
        lots: entry?.lots ?? (Number.isFinite(lots) ? lots : 0),
        openPrice: entry?.price ?? null,
        closePrice: price,
        sl: finiteOrNull(parseNumber(get('sl'))),
        tp: finiteOrNull(parseNumber(get('tp'))),
        commission,
        swap,
        // P&L neto de la operación (consistente con la columna Balance).
        profit: gross + commission + swap,
        balanceAfter: parseNumber(get('balance')),
      });
    }
    // Filas "balance"/"deposit" (sin dirección): se ignoran.
  }
  if (trades.length === 0) warnings.push('No se pudieron emparejar deals de entrada/salida.');
  return trades;
}

function finiteOrNull(n: number): number | null {
  return Number.isFinite(n) ? n : null;
}
