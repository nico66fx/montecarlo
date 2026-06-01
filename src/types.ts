// Estructura interna común a la que se normalizan todos los formatos de reporte.

export type TradeSide = 'long' | 'short';

/** Una operación cerrada, normalizada desde cualquier formato. */
export interface Trade {
  /** Índice secuencial (orden de cierre). */
  index: number;
  openTime: Date | null;
  closeTime: Date | null;
  symbol: string;
  type: TradeSide;
  lots: number;
  openPrice: number | null;
  closePrice: number | null;
  sl: number | null;
  tp: number | null;
  commission: number;
  swap: number;
  /** Beneficio neto de la operación (incluye lo que el reporte ya incorpore). */
  profit: number;
  /** Balance acumulado tras la operación (si el reporte lo aporta o se recalcula). */
  balanceAfter: number;
  /** Nombre del backtest/bot de origen (solo en modo portfolio). */
  source?: string;
}

/** Metadatos del reporte de backtest. */
export interface ReportMeta {
  source: 'mt4-html' | 'mt5-html' | 'mt5-xml' | 'xlsx' | 'csv' | 'sample';
  fileName: string;
  symbol?: string;
  period?: string;
  initialDeposit?: number;
  leverage?: string;
  currency?: string;
  modelQuality?: string;
  /** Beneficios/ratios que el propio reporte ya trae (referencia/validación). */
  reported?: Record<string, string>;
}

/** Resultado de un parse: operaciones + metadatos + avisos. */
export interface ParseResult {
  trades: Trade[];
  meta: ReportMeta;
  warnings: string[];
}

/** Punto de la curva de equity/balance acumulada. */
export interface EquityPoint {
  index: number;
  time: Date | null;
  balance: number;
  /** Drawdown en valor absoluto respecto al pico previo (>= 0). */
  ddAbs: number;
  /** Drawdown en % respecto al pico previo (>= 0). */
  ddPct: number;
}
