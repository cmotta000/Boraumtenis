'use client';

import { ImageIcon } from 'lucide-react';
import { useState } from 'react';

import { Avatar } from '@/components/ui';
import { descartarPreview, escolherFotos, MAX_FOTOS, type FotoLocal } from '@/lib/fotos';
import { publicarFotos } from '@/lib/posts';

import estilos from './publicar.module.css';

/**
 * Caixa de publicação do feed: escolhe fotos, escreve uma legenda e publica.
 * Fica recolhida até o primeiro clique para não roubar a atenção do feed.
 */
export function Compositor({
  userId,
  nome,
  avatar,
  matchId,
  onPublicado,
}: {
  userId: string;
  nome?: string | null;
  avatar?: string | null;
  /** Amarra a publicação a uma partida (usado na tela da partida). */
  matchId?: string | null;
  onPublicado: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [legenda, setLegenda] = useState('');
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const vazio = fotos.length === 0 && !legenda.trim();

  async function adicionar() {
    setErro(null);
    try {
      const novas = await escolherFotos(MAX_FOTOS - fotos.length);
      if (novas.length > 0) setAberto(true);
      setFotos((prev) => [...prev, ...novas].slice(0, MAX_FOTOS));
    } catch {
      setErro('Não foi possível abrir a galeria.');
    }
  }

  function remover(i: number) {
    setFotos((prev) => {
      descartarPreview(prev[i]);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  /** Limpa o rascunho e devolve as URLs de preview ao navegador. */
  function limpar() {
    fotos.forEach(descartarPreview);
    setFotos([]);
    setLegenda('');
    setAberto(false);
  }

  async function publicar() {
    if (vazio) return;
    setErro(null);
    setEnviando(true);
    try {
      await publicarFotos({ userId, fotos, legenda, matchId });
      limpar();
      onPublicado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível publicar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  function cancelar() {
    setErro(null);
    limpar();
  }

  const convite = matchId ? 'Publique as fotos dessa partida…' : 'Compartilhe um momento da quadra…';

  return (
    <div className={estilos.box}>
      <div className={estilos.linha}>
        <Avatar nome={nome} foto={avatar} size={42} />
        {aberto ? (
          <textarea
            value={legenda}
            onChange={(e) => setLegenda(e.target.value)}
            placeholder={matchId ? 'Como foi o jogo?' : 'Como foi o treino de hoje?'}
            autoFocus
            maxLength={600}
            className={estilos.campo}
          />
        ) : (
          <button type="button" onClick={() => setAberto(true)} className={estilos.gatilho}>
            {convite}
          </button>
        )}
      </div>

      {fotos.length > 0 && (
        <div className={estilos.grid}>
          {fotos.map((f, i) => (
            <div key={f.uri} className={estilos.thumbBox}>
              {/* eslint-disable-next-line @next/next/no-img-element -- preview local (blob:). */}
              <img src={f.uri} alt={`Foto ${i + 1} escolhida`} className={estilos.thumb} />
              <button
                type="button"
                onClick={() => remover(i)}
                aria-label={`Remover foto ${i + 1}`}
                className={estilos.remover}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {erro && <p className={estilos.erro}>{erro}</p>}

      <div className={estilos.acoes}>
        <button
          type="button"
          onClick={adicionar}
          disabled={fotos.length >= MAX_FOTOS || enviando}
          className={estilos.addFoto}>
          <ImageIcon size={15} aria-hidden />
          {fotos.length > 0 ? `${fotos.length}/${MAX_FOTOS} fotos` : 'Adicionar fotos'}
        </button>

        <span className={estilos.espaco} />

        {aberto && (
          <>
            <button type="button" onClick={cancelar} disabled={enviando} className={estilos.cancelar}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={publicar}
              disabled={vazio || enviando}
              aria-busy={enviando || undefined}
              className={estilos.publicar}>
              {enviando ? <span className={estilos.girando} role="status" aria-label="Publicando" /> : 'Publicar'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
