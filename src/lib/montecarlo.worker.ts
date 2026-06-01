// Web Worker: ejecuta las miles de simulaciones sin bloquear la interfaz.

import { runMonteCarlo, type MCConfig, type MCResult } from './montecarlo';

export interface MCRequest {
  profits: number[];
  lots: number[];
  config: MCConfig;
}
export interface MCResponse {
  result: MCResult;
}

self.onmessage = (e: MessageEvent<MCRequest>) => {
  const { profits, lots, config } = e.data;
  const result = runMonteCarlo(profits, lots, config);
  (self as unknown as Worker).postMessage({ result } satisfies MCResponse);
};
