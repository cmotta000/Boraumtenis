'use client';

import { useEffect, useRef, useState } from 'react';

import estilos from './mini-map.module.css';

/**
 * Mini-mapa estático usando os tiles do OpenStreetMap (sem API key).
 * Monta um mosaico de tiles centralizado exatamente no ponto e desenha um
 * pino no centro.
 */
export function MiniMap({
  lat,
  lng,
  zoom = 15,
  height = 180,
}: {
  lat: number;
  lng: number;
  zoom?: number;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const w = useLargura(ref);

  const n = 2 ** zoom;
  const xf = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yf = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const cx = Math.floor(xf);
  const cy = Math.floor(yf);
  const px = (xf - cx) * 256; // posição do ponto dentro do tile central
  const py = (yf - cy) * 256;

  const tiles: React.ReactNode[] = [];
  if (w > 0) {
    const iRange = Math.ceil(w / 2 / 256) + 1;
    const jRange = Math.ceil(height / 2 / 256) + 1;
    for (let i = -iRange; i <= iRange; i++) {
      for (let j = -jRange; j <= jRange; j++) {
        const tx = (((cx + i) % n) + n) % n;
        const ty = cy + j;
        if (ty < 0 || ty >= n) continue;
        tiles.push(
          // eslint-disable-next-line @next/next/no-img-element -- tile do OSM, montado no cliente.
          <img
            key={`${i},${j}`}
            src={`https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`}
            alt=""
            aria-hidden
            className={estilos.tile}
            style={{ left: w / 2 - px + i * 256, top: height / 2 - py + j * 256 }}
          />,
        );
      }
    }
  }

  return (
    <div ref={ref} className={estilos.wrap} style={{ height }} role="img" aria-label="Mapa do local">
      {tiles}
      {/* pino no centro exato */}
      <div className={estilos.pinWrap} style={{ left: w / 2, top: height / 2 }}>
        <span className={estilos.pin} />
        <span className={estilos.pinStem} />
      </div>
      <span className={estilos.attr}>© OpenStreetMap</span>
    </div>
  );
}

/** Largura atual do elemento — o mosaico depende dela para saber quantos tiles montar. */
function useLargura(ref: React.RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(([entrada]) => setW(Math.round(entrada.contentRect.width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);

  return w;
}
