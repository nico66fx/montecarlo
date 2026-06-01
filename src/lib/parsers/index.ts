// Punto de entrada de los parsers: detecta el formato del archivo y enruta.

import type { ParseResult } from '../../types';
import { parseCsv } from './csv';
import { parseHtml } from './html';
import { parseXlsx } from './xlsx';
import { parseXml } from './xml';

const HTML_EXT = /\.(html?|htm)$/i;
const XML_EXT = /\.xml$/i;
const CSV_EXT = /\.(csv|tsv|txt)$/i;
const XLSX_EXT = /\.(xlsx|xls)$/i;

/** Lee un File y lo enruta al parser adecuado. */
export async function parseFile(file: File): Promise<ParseResult> {
  const name = file.name;

  // Binarios (XLSX) primero, por extensión.
  if (XLSX_EXT.test(name)) {
    const buf = await file.arrayBuffer();
    return await parseXlsx(buf, name);
  }

  const text = await file.text();
  return parseText(text, name);
}

/** Enruta a partir de texto + nombre (útil para datos de ejemplo o tests). */
export function parseText(text: string, fileName: string): ParseResult {
  const head = text.slice(0, 4000).toLowerCase();

  if (XML_EXT.test(fileName) || head.includes('<?xml') || head.includes('spreadsheet')) {
    // Excel SpreadsheetML o XML genérico.
    if (head.includes('urn:schemas-microsoft-com:office:spreadsheet') || head.includes('<workbook') || head.includes('<worksheet')) {
      return parseXml(text, fileName);
    }
  }

  if (HTML_EXT.test(fileName) || head.includes('<html') || head.includes('<table')) {
    return parseHtml(text, fileName);
  }

  if (XML_EXT.test(fileName) || head.includes('<workbook') || head.includes('<worksheet')) {
    return parseXml(text, fileName);
  }

  if (CSV_EXT.test(fileName) || /[;,\t].*[;,\t]/.test(text.split(/\r?\n/)[0] ?? '')) {
    return parseCsv(text, fileName);
  }

  // Último recurso: intentar HTML (muchos statements vienen sin extensión clara).
  if (head.includes('<')) {
    return parseHtml(text, fileName);
  }

  return {
    trades: [],
    meta: { source: 'csv', fileName },
    warnings: [
      'Formato no reconocido. Formatos soportados: reporte MT4 (.htm), reporte MT5 (.html/.xml), CSV y XLSX de operaciones.',
    ],
  };
}
