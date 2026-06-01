// Parser de reportes MT5 exportados como XML (SpreadsheetML de Excel 2003).
// Estructura: <Workbook><Worksheet><Table><Row><Cell ss:Index><Data>...

import type { ParseResult, ReportMeta } from '../../types';
import { tradesFromTable } from './fromTable';
import { parseNumber } from './utils';

type Cell = string | number | null;

export function parseXml(xml: string, fileName: string): ParseResult {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    return {
      trades: [],
      meta: { source: 'mt5-xml', fileName },
      warnings: ['El XML no es válido o no se pudo parsear.'],
    };
  }

  // getElementsByTagName ignora prefijos de namespace de forma robusta entre navegadores.
  const rowsEls = Array.from(doc.getElementsByTagName('Row')) as Element[];
  const matrix: Cell[][] = [];

  for (const rowEl of rowsEls) {
    const cells = Array.from(rowEl.getElementsByTagName('Cell')) as Element[];
    const row: Cell[] = [];
    let col = 0;
    for (const cellEl of cells) {
      // ss:Index permite saltar columnas vacías.
      const idxAttr =
        cellEl.getAttribute('ss:Index') ?? cellEl.getAttribute('Index');
      if (idxAttr) {
        const target = parseInt(idxAttr, 10) - 1;
        while (col < target) {
          row.push(null);
          col++;
        }
      }
      const dataEl = cellEl.getElementsByTagName('Data')[0] ?? cellEl.getElementsByTagName('ss:Data')[0];
      row.push(dataEl ? (dataEl.textContent ?? '').trim() : null);
      col++;
    }
    matrix.push(row);
  }

  if (matrix.length === 0) {
    return {
      trades: [],
      meta: { source: 'mt5-xml', fileName },
      warnings: ['No se encontraron filas en el XML.'],
    };
  }

  const meta: ReportMeta = { source: 'mt5-xml', fileName, reported: {} };
  // Buscar metadatos en celdas de texto antes de la tabla.
  for (const row of matrix.slice(0, 40)) {
    const joined = row.map((c) => String(c ?? '')).join(' ');
    const dep = joined.match(/(?:Initial Deposit|Dep[óo]sito inicial)\s*[:：]?\s*([\d ,.]+)/i);
    if (dep && meta.initialDeposit == null) meta.initialDeposit = parseNumber(dep[1]);
    const sym = joined.match(/(?:Symbol|S[íi]mbolo)\s*[:：]?\s*([A-Za-z0-9._]+)/i);
    if (sym && !meta.symbol) meta.symbol = sym[1];
  }

  const out = tradesFromTable(matrix, meta.initialDeposit);
  return { trades: out.trades, meta, warnings: out.warnings };
}
