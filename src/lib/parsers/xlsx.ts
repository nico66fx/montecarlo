// Parser de XLSX/XLS usando SheetJS. Recorre todas las hojas y elige la que
// produzca operaciones. Soporta el informe completo del Probador de Estrategias
// de MT5 (metadatos + tabla "Órdenes" + tabla "Transacciones").

import type { ParseResult, ReportMeta } from '../../types';
import { tradesFromTable } from './fromTable';
import { normHeader, parseNumber } from './utils';

type Cell = string | number | null;

/** Extrae metadatos de las filas etiqueta:valor de la cabecera del informe MT5. */
function extractMeta(rows: Cell[][], fileName: string): ReportMeta {
  const meta: ReportMeta = { source: 'xlsx', fileName, reported: {} };
  const limit = Math.min(rows.length, 80);
  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    const label = normHeader(String(row[0] ?? ''));
    if (!label) continue;
    // El valor suele estar en la primera celda no vacía tras la etiqueta.
    const value = row.slice(1).find((c) => c != null && String(c).trim() !== '');
    const vStr = value != null ? String(value).trim() : '';

    if (!meta.symbol && /^simbolo/.test(label)) meta.symbol = vStr;
    else if (!meta.currency && /^divisa|^currency/.test(label)) meta.currency = vStr;
    else if (meta.initialDeposit == null && /deposito inicial|initial deposit/.test(label))
      meta.initialDeposit = parseNumber(vStr);
    else if (!meta.leverage && /apalancamiento|leverage/.test(label)) meta.leverage = vStr;
    else if (!meta.period && /^periodo|^period/.test(label)) meta.period = vStr;
    else if (!meta.modelQuality && /calidad del historial|calidad de modelado|modelling quality/.test(label))
      meta.modelQuality = vStr;
    else if (/beneficio neto|net profit/.test(label) && value != null)
      meta.reported!['Beneficio neto'] = vStr;
    else if (/factor de beneficio|profit factor/.test(label) && value != null)
      meta.reported!['Profit Factor'] = vStr;
  }
  return meta;
}

export async function parseXlsx(buffer: ArrayBuffer, fileName: string): Promise<ParseResult> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const warnings: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: null,
      raw: true,
    }) as Cell[][];
    if (!rows.length) continue;
    const meta = extractMeta(rows, fileName);
    const out = tradesFromTable(rows, meta.initialDeposit);
    if (out.trades.length) {
      return { trades: out.trades, meta, warnings: out.warnings };
    }
    warnings.push(...out.warnings);
  }

  return {
    trades: [],
    meta: { source: 'xlsx', fileName },
    warnings: warnings.length ? warnings : ['No se encontraron operaciones en el libro.'],
  };
}
