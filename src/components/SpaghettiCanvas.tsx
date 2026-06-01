import { useEffect, useRef } from 'react';
import type { MCConfig, MCResult } from '../lib/montecarlo';

interface Props {
  result: MCResult;
  cfg: MCConfig;
  /** Ref al <canvas> para poder exportarlo a imagen desde el padre. */
  innerRef?: React.RefObject<HTMLCanvasElement>;
  height?: number;
}

/** Dibuja la "maraña" de curvas Monte Carlo + cono de percentiles + curva real. */
export function SpaghettiCanvas({ result, cfg, innerRef, height = 420 }: Props) {
  const localRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = innerRef ?? localRef;
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const draw = () => {
      const cssW = wrap.clientWidth;
      const cssH = height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const padL = 64,
        padR = 16,
        padT = 14,
        padB = 26;
      const plotW = cssW - padL - padR;
      const plotH = cssH - padT - padB;
      const n = result.numTrades;

      // Rango Y a partir del cono + curva real.
      let yMin = Infinity,
        yMax = -Infinity;
      for (const v of result.band.p5) yMin = Math.min(yMin, v);
      for (const v of result.band.p95) yMax = Math.max(yMax, v);
      for (const v of result.original) {
        yMin = Math.min(yMin, v);
        yMax = Math.max(yMax, v);
      }
      const floorStatic = result.account * (1 - cfg.maxDD / 100);
      const targetEq = result.account * (1 + cfg.target / 100);
      yMin = Math.min(yMin, floorStatic);
      yMax = Math.max(yMax, targetEq);
      const pad = (yMax - yMin) * 0.05 || 1;
      yMin -= pad;
      yMax += pad;

      const x = (i: number) => padL + (i / Math.max(1, n)) * plotW;
      const y = (v: number) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

      // Rejilla + etiquetas Y.
      ctx.font = '11px Inter, sans-serif';
      ctx.fillStyle = 'rgba(148,163,184,0.6)';
      ctx.strokeStyle = 'rgba(148,163,184,0.10)';
      ctx.lineWidth = 1;
      const ticks = 5;
      for (let t = 0; t <= ticks; t++) {
        const v = yMin + ((yMax - yMin) * t) / ticks;
        const yy = y(v);
        ctx.beginPath();
        ctx.moveTo(padL, yy);
        ctx.lineTo(cssW - padR, yy);
        ctx.stroke();
        ctx.fillText(Math.round(v).toLocaleString('es-ES'), 6, yy + 3);
      }

      // Maraña de curvas.
      ctx.lineWidth = 1;
      for (const p of result.paths) {
        ctx.beginPath();
        for (let i = 0; i < p.length; i++) {
          const xx = x(i),
            yy = y(p[i]);
          if (i === 0) ctx.moveTo(xx, yy);
          else ctx.lineTo(xx, yy);
        }
        ctx.strokeStyle = 'rgba(96,165,250,0.06)';
        ctx.stroke();
      }

      // Cono p5–p95.
      ctx.beginPath();
      for (let i = 0; i < result.band.p95.length; i++) {
        const xx = x(i),
          yy = y(result.band.p95[i]);
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      for (let i = result.band.p5.length - 1; i >= 0; i--) {
        ctx.lineTo(x(i), y(result.band.p5[i]));
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(34,211,238,0.10)';
      ctx.fill();

      // Líneas de referencia (inicio / objetivo / suelo max DD estático).
      const refLine = (v: number, color: string, label: string) => {
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(padL, y(v));
        ctx.lineTo(cssW - padR, y(v));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.fillText(label, cssW - padR - 70, y(v) - 4);
      };
      refLine(targetEq, 'rgba(52,211,153,0.8)', `Objetivo +${cfg.target}%`);
      if (cfg.ddType === 'static') refLine(floorStatic, 'rgba(248,113,113,0.8)', `Suelo -${cfg.maxDD}%`);
      refLine(result.account, 'rgba(148,163,184,0.5)', 'Inicio');

      // Mediana (p50).
      ctx.setLineDash([]);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < result.band.p50.length; i++) {
        const xx = x(i),
          yy = y(result.band.p50[i]);
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();

      // Curva real del backtest.
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < result.original.length; i++) {
        const xx = x(i),
          yy = y(result.original[i]);
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();

      // Eje X.
      ctx.fillStyle = 'rgba(148,163,184,0.6)';
      ctx.fillText('0', padL, cssH - 8);
      ctx.fillText(`${n} ops`, cssW - padR - 40, cssH - 8);

      // Marca de agua (para la imagen compartible).
      ctx.font = '600 12px Inter, sans-serif';
      ctx.fillStyle = 'rgba(96,165,250,0.55)';
      ctx.fillText('nico66fx.github.io/montecarlo', padL + 4, padT + 14);
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [result, cfg, height, canvasRef]);

  return (
    <div ref={wrapRef} className="w-full">
      <canvas ref={canvasRef} />
    </div>
  );
}
