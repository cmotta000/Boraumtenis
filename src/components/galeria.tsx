'use client';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { prefetchFotos, useFotoUrl } from '@/lib/fotos';

import estilos from './galeria.module.css';

/**
 * Mosaico de fotos de um post, no espírito do feed do Strava: uma foto grande
 * quando é só uma, mosaico quando são várias. Clicar abre a foto inteira.
 */
export function GaleriaFotos({ fotos }: { fotos: string[] }) {
  const [aberta, setAberta] = useState<number | null>(null);
  // Um pedido de assinatura para o post inteiro, em vez de um por miniatura.
  useEffect(() => {
    prefetchFotos(fotos);
  }, [fotos]);
  if (fotos.length === 0) return null;

  const visiveis = fotos.slice(0, 4);
  const extras = fotos.length - visiveis.length;

  return (
    <>
      <div className={estilos.mosaico}>
        {fotos.length === 1 && (
          <Foto caminho={fotos[0]} onClick={() => setAberta(0)} classe={estilos.hero} indice={0} />
        )}

        {fotos.length === 2 && (
          <div className={estilos.linha}>
            {fotos.map((f, i) => (
              <Foto key={f} caminho={f} onClick={() => setAberta(i)} classe={estilos.meio} indice={i} />
            ))}
          </div>
        )}

        {fotos.length === 3 && (
          <div className={estilos.linha}>
            <Foto caminho={fotos[0]} onClick={() => setAberta(0)} classe={estilos.principal} indice={0} />
            <div className={estilos.coluna}>
              <Foto caminho={fotos[1]} onClick={() => setAberta(1)} classe={estilos.secundaria} indice={1} />
              <Foto caminho={fotos[2]} onClick={() => setAberta(2)} classe={estilos.secundaria} indice={2} />
            </div>
          </div>
        )}

        {fotos.length >= 4 && (
          <div className={estilos.grade}>
            {visiveis.map((f, i) => (
              <Foto
                key={f}
                caminho={f}
                onClick={() => setAberta(i)}
                classe={estilos.gradeItem}
                indice={i}
                selo={i === 3 && extras > 0 ? `+${extras}` : undefined}
              />
            ))}
          </div>
        )}
      </div>

      <Lightbox fotos={fotos} indice={aberta} onIndice={setAberta} />
    </>
  );
}

/** Grade quadrada de fotos — usada na galeria do perfil. */
export function GradeFotos({ fotos, colunas = 3 }: { fotos: string[]; colunas?: number }) {
  const [aberta, setAberta] = useState<number | null>(null);
  useEffect(() => {
    prefetchFotos(fotos);
  }, [fotos]);
  if (fotos.length === 0) return null;

  return (
    <>
      <div
        className={estilos.gradePerfil}
        style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}>
        {fotos.map((f, i) => (
          <Foto key={f + i} caminho={f} onClick={() => setAberta(i)} classe={estilos.quadrada} indice={i} />
        ))}
      </div>
      <Lightbox fotos={fotos} indice={aberta} onIndice={setAberta} />
    </>
  );
}

function Foto({
  caminho,
  onClick,
  classe,
  indice,
  selo,
}: {
  caminho: string;
  onClick: () => void;
  classe: string;
  indice: number;
  selo?: string;
}) {
  const url = useFotoUrl(caminho);

  return (
    <button type="button" onClick={onClick} className={`${estilos.foto} ${classe}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada, de vida curta. */}
      {url && <img src={url} alt={`Foto ${indice + 1}`} loading="lazy" className={estilos.img} />}
      {selo && <span className={estilos.selo}>{selo}</span>}
    </button>
  );
}

/** Foto em tela cheia, com navegação entre as fotos do post. */
function Lightbox({
  fotos,
  indice,
  onIndice,
}: {
  fotos: string[];
  indice: number | null;
  onIndice: (i: number | null) => void;
}) {
  const aberto = indice !== null;

  // Teclado: Esc fecha, setas navegam. E o fundo não rola enquanto está aberto.
  useEffect(() => {
    if (!aberto) return;
    const onTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onIndice(null);
      if (e.key === 'ArrowLeft') onIndice((indice! - 1 + fotos.length) % fotos.length);
      if (e.key === 'ArrowRight') onIndice((indice! + 1) % fotos.length);
    };
    document.addEventListener('keydown', onTecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onTecla);
      document.body.style.overflow = antes;
    };
  }, [aberto, indice, fotos.length, onIndice]);

  if (!aberto) return null;

  const anterior = () => onIndice((indice - 1 + fotos.length) % fotos.length);
  const proxima = () => onIndice((indice + 1) % fotos.length);

  return createPortal(
    <div className={estilos.backdrop} role="dialog" aria-modal="true" aria-label="Foto ampliada">
      {/* Clicar no fundo fecha; o clique na foto não sobe. */}
      <button
        type="button"
        aria-label="Fechar"
        onClick={() => onIndice(null)}
        style={{ position: 'absolute', inset: 0, cursor: 'default' }}
      />
      <FotoCheia caminho={fotos[indice]} alt={`Foto ${indice + 1} de ${fotos.length}`} />

      <button
        type="button"
        onClick={() => onIndice(null)}
        aria-label="Fechar"
        className={`${estilos.circulo} ${estilos.fechar}`}>
        <X size={22} />
      </button>

      {fotos.length > 1 && (
        <>
          <button
            type="button"
            onClick={anterior}
            aria-label="Foto anterior"
            className={`${estilos.circulo} ${estilos.seta}`}
            style={{ left: 16 }}>
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={proxima}
            aria-label="Próxima foto"
            className={`${estilos.circulo} ${estilos.seta}`}
            style={{ right: 16 }}>
            <ChevronRight size={24} />
          </button>
          <span className={estilos.contador}>
            {indice + 1} / {fotos.length}
          </span>
        </>
      )}
    </div>,
    document.body,
  );
}

/** A foto ampliada: a assinatura chega por hook, então vive no próprio componente. */
function FotoCheia({ caminho, alt }: { caminho: string; alt: string }) {
  const url = useFotoUrl(caminho);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element -- URL assinada, de vida curta.
  return <img src={url} alt={alt} className={estilos.cheia} />;
}
