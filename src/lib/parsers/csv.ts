// Parser de CSV: detecta el separador (',' ';' o tab) y construye la matriz.

import type { ParseResult } from '../../types';
import { tradesFromTable } from './fromTable';

/** Divide una línea CSV respetando comillas dobles. */
function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function detectDelimiter(sample: string): string {
  const candidates = [',', ';', '\t', '|'];
  const firstLines = sample.split(/\r?\n/).slice(0, 5);
  let best = ',';
  let bestCount = 0;
  for (const d of candidates) {
    const counts = firstLines.map((l) => splitCsvLine(l, d).length);
    const min = Math.min(...counts);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    // Preferimos delimitadores que producen muchas columnas de forma consistente.
    if (min > 1 && avg > bestCount) {
      bestCount = avg;
      best = d;
    }
  }
  return best;
}

export function parseCsv(text: string, fileName: string): ParseResult {
  const clean = text.replace(/^﻿/, ''); // quitar BOM
  const delim = detectDelimiter(clean);
  const rows = clean
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => splitCsvLine(l, delim));

  const out = tradesFromTable(rows);
  return {
    trades: out.trades,
    meta: { source: 'csv', fileName },
    warnings: out.warnings,
  };
}
