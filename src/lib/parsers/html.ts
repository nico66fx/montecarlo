// Parser de reportes HTML de MetaTrader 4 (Statement / Strategy Tester Report)
// y MetaTrader 5 (Open XML / Report con tablas de Deals y Orders).

import type { ParseResult, ReportMeta, Trade } from '../../types';
import { tradesFromTable } from './fromTable';
import { normHeader, parseDate, parseNumber, parseNumberOr0, parseSide } from './utils';

type Cell = string | number | null;

/** Extrae todas las tablas del documento como matrices de texto. */
function extractTables(doc: Document): Cell[][][] {
  const tables: Cell[][][] = [];
  doc.querySelectorAll('table').forEach((table) => {
    const rows: Cell[][] = [];
    table.querySelectorAll('tr').forEach((tr) => {
      const cells: Cell[] = [];
      tr.querySelectorAll('th, td').forEach((td) => {
        cells.push((td.textContent ?? '').replace(/ /g, ' ').trim());
      });
      if (cells.length) rows.push(cells);
    });
    if (rows.length) tables.push(rows);
  });
  return tables;
}

/** Aplana toda la matriz de una tabla a una sola lista de filas (para reportes anidados). */
function flattenAllRows(tables: Cell[][][]): Cell[][] {
  return tables.flat();
}

/** Extrae metadatos del texto plano del reporte. */
function extractMeta(doc: Document, fileName: string, source: ReportMeta['source']): ReportMeta {
  const text = doc.body?.textContent ?? '';
  const meta: ReportMeta = { source, fileName, reported: {} };

  const symbol = text.match(/(?:Symbol|S[íi]mbolo|Instrument)\s*[:：]?\s*([A-Za-z0-9._]+)/i);
  if (symbol) meta.symbol = symbol[1];

  const deposit = text.match(/(?:Initial deposit|Dep[óo]sito inicial)\s*[:：]?\s*([\d ,. ]+)/i);
  if (deposit) meta.initialDeposit = parseNumber(deposit[1]);

  const leverage = text.match(/(?:Leverage|Apalancamiento)\s*[:：]?\s*([\d:]+)/i);
  if (leverage) meta.leverage = leverage[1];

  const period = text.match(/(?:Period|Per[íi]odo)\s*[:：]?\s*([^\n]{3,40})/i);
  if (period) meta.period = period[1].trim();

  const quality = text.match(/(?:Modelling quality|Calidad de modelado)\s*[:：]?\s*([\d.,%]+)/i);
  if (quality) meta.modelQuality = quality[1];

  // Métricas ya reportadas (para validación visual).
  const grab = (label: RegExp): string | undefined => {
    const m = text.match(label);
    return m ? m[1].trim() : undefined;
  };
  const reported = meta.reported!;
  const pf = grab(/(?:Profit Factor|Factor de beneficio)\s*[:：]?\s*([\d.,]+)/i);
  if (pf) reported['Profit Factor'] = pf;
  const tnp = grab(/(?:Total Net Profit|Beneficio neto total)\s*[:：]?\s*([(\d ,. )\-]+)/i);
  if (tnp) reported['Beneficio neto'] = tnp;

  return meta;
}

/**
 * Parsea el Statement clásico de MT4 (una fila por operación cerrada, con
 * columnas duplicadas Time/Price para apertura y cierre).
 */
function parseMt4Statement(rows: Cell[][]): Trade[] | null {
  // Busca la fila de cabecera con el patrón posicional de MT4.
  let headerIdx = -1;
  let map: Record<string, number> = {};
  for (let i = 0; i < rows.length; i++) {
    const h = rows[i].map((c) => normHeader(String(c ?? '')));
    const idxItem = h.findIndex((x) => x === 'item' || x === 'symbol' || x === 'simbolo');
    const idxType = h.findIndex((x) => x === 'type' || x === 'tipo');
    const idxProfit = h.findIndex((x) => x === 'profit' || x === 'beneficio');
    const idxSize = h.findIndex((x) => x === 'size' || x === 'lots' || x === 'volumen' || x === 'tamano');
    if (idxItem >= 0 && idxType >= 0 && idxProfit >= 0 && idxSize >= 0) {
      // Las dos columnas "time" y dos "price".
      const times = h.flatMap((x, j) => (x.includes('time') || x.includes('hora') ? [j] : []));
      const prices = h.flatMap((x, j) => (x.includes('price') || x.includes('precio') ? [j] : []));
      map = {
        ticket: h.findIndex((x) => x.includes('ticket') || x.includes('orden')),
        openTime: times[0] ?? -1,
        closeTime: times[1] ?? times[0] ?? -1,
        type: idxType,
        size: idxSize,
        item: idxItem,
        openPrice: prices[0] ?? -1,
        closePrice: prices[1] ?? prices[0] ?? -1,
        sl: h.findIndex((x) => x.includes('s l') || x === 'sl'),
        tp: h.findIndex((x) => x.includes('t p') || x === 'tp'),
        commission: h.findIndex((x) => x.includes('commission') || x.includes('comision')),
        swap: h.findIndex((x) => x.includes('swap')),
        profit: idxProfit,
      };
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return null;

  const trades: Trade[] = [];
  let idx = 0;
  let running = 0;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const cell = (k: string) => (map[k] >= 0 ? r[map[k]] : null);
    const side = parseSide(String(cell('type') ?? ''));
    if (!side) continue; // filas de subtotales / depósitos
    const lots = parseNumber(cell('size'));
    if (!Number.isFinite(lots)) continue;
    const profit = parseNumberOr0(cell('profit'));
    const commission = parseNumberOr0(cell('commission'));
    const swap = parseNumberOr0(cell('swap'));
    running += profit + commission + swap;
    trades.push({
      index: idx++,
      openTime: parseDate(cell('openTime')),
      closeTime: parseDate(cell('closeTime')),
      symbol: String(cell('item') ?? '').trim() || '—',
      type: side,
      lots,
      openPrice: nOrNull(parseNumber(cell('openPrice'))),
      closePrice: nOrNull(parseNumber(cell('closePrice'))),
      sl: nOrNull(parseNumber(cell('sl'))),
      tp: nOrNull(parseNumber(cell('tp'))),
      commission,
      swap,
      profit: profit + commission + swap,
      balanceAfter: running,
    });
  }
  return trades.length ? trades : null;
}

export function parseHtml(html: string, fileName: string): ParseResult {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tables = extractTables(doc);
  if (tables.length === 0) {
    return {
      trades: [],
      meta: { source: 'mt4-html', fileName },
      warnings: ['El HTML no contiene tablas reconocibles.'],
    };
  }

  const text = (doc.body?.textContent ?? '').toLowerCase();
  const isMt5 = text.includes('metatrader 5') || text.includes('deals') || tables.some((t) => t.flat().some((c) => /direction|direccion/i.test(String(c ?? ''))));
  const source: ReportMeta['source'] = isMt5 ? 'mt5-html' : 'mt4-html';
  const meta = extractMeta(doc, fileName, source);
  const warnings: string[] = [];

  // 1) MT5: probar tabla de deals (la que tenga columna Direction o Deal+Balance).
  if (isMt5) {
    const dealTable = tables.find((t) =>
      t.some((row) => {
        const h = row.map((c) => normHeader(String(c ?? '')));
        return (h.includes('direction') || h.includes('direccion')) || (h.includes('deal') && h.includes('balance'));
      }),
    );
    if (dealTable) {
      const out = tradesFromTable(dealTable, meta.initialDeposit);
      if (out.trades.length) {
        return { trades: out.trades, meta, warnings: out.warnings };
      }
      warnings.push(...out.warnings);
    }
  }

  // 2) MT4 statement posicional sobre todas las filas aplanadas.
  const flat = flattenAllRows(tables);
  const mt4 = parseMt4Statement(flat);
  if (mt4 && mt4.length) {
    if (meta.initialDeposit && mt4[0]) {
      // recomputar balanceAfter partiendo del depósito
      let run = meta.initialDeposit;
      for (const t of mt4) {
        run += t.profit;
        t.balanceAfter = run;
      }
    }
    return { trades: mt4, meta, warnings };
  }

  // 3) Fallback genérico: la tabla más grande.
  const biggest = tables.reduce((a, b) => (b.length > a.length ? b : a), tables[0]);
  const generic = tradesFromTable(biggest, meta.initialDeposit);
  warnings.push(...generic.warnings);
  if (generic.trades.length === 0) {
    warnings.push('No se reconocieron operaciones. ¿Es un reporte de Strategy Tester o Statement?');
  }
  return { trades: generic.trades, meta, warnings };
}

function nOrNull(n: number): number | null {
  return Number.isFinite(n) ? n : null;
}
