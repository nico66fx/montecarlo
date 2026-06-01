// Web Worker: ejecuta las miles de simulaciones sin bloquear la interfaz.

import { runMonteCarlo, type MCConfig, type MCResult } from './montecarlo';

export interface MCRequest {
  profits: number[];
  config: MCConfig;
}
export interface MCResponse {
  result: MCResult;
}

self.onmessage = (e: MessageEvent<MCRequest>) => {
  const { profits, config } = e.data;
  const result = runMonteCarlo(profits, config);
  (self as unknown as Worker).postMessage({ result } satisfies MCResponse);
};
