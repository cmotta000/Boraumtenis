'use client';

import Link from 'next/link';

import { quando } from '@/lib/datas';
import type { MatchTipo, PlayerStatus } from '@/lib/database.types';

import { Pill } from './identidade';
import estilos from './card-partida.module.css';

/**
 * O cartão de uma partida numa lista: onde, quando, com quem, quantas vagas
 * sobraram e qual é o meu vínculo com ela.
 *
 * Não confundir com o `Card` de `superficie.tsx`: aquele é uma SUPERFÍCIE
 * branca genérica, que serve para qualquer conteúdo. Este aqui sabe o que é
 * uma partida — ele decide como a distância é escrita, quando a etiqueta de
 * vaga vira "completa" e o que significa cada `meu_status`. Enquanto isso
 * morava dentro de uma tela, a próxima lista de partidas ia nascer com um
 * cartão parecido, mas não igual.
 *
 * O cartão inteiro é o link para a partida, então por dentro só há `span`:
 * bloco dentro de `<a>` é HTML inválido.
 */

/** Etiqueta do meu vínculo com a partida — só quando já existe algum. */
function meuVinculo(s: MeuStatus): { label: string; tone: 'clay' | 'ok' | 'ball' } | null {
  switch (s) {
    case 'criador':
      return { label: 'sua partida', tone: 'clay' };
    case 'confirmado':
      return { label: 'você está dentro', tone: 'ok' };
    case 'convidado':
      return { label: 'aguardando', tone: 'ball' };
    default:
      return null;
  }
}

/** Como eu apareço nesta partida: dono, dentro, convidado — ou nada disso. */
export type MeuStatus = 'criador' | PlayerStatus | null;

export type CardPartidaProps = {
  id: string;
  /** Nome do local. Sem ele o cartão continua de pé com um rótulo genérico. */
  local: string | null;
  /** ISO do horário marcado. */
  dataHora: string;
  tipo: MatchTipo;
  /** Distância até a origem da busca, em metros. Omita em listas sem raio. */
  distanciaM?: number | null;
  anfitriao?: string | null;
  vagasTotal: number;
  confirmados: number;
  meuStatus?: MeuStatus;
};

export function CardPartida({
  id,
  local,
  dataHora,
  tipo,
  distanciaM,
  anfitriao,
  vagasTotal,
  confirmados,
  meuStatus = null,
}: CardPartidaProps) {
  const restantes = Math.max(0, vagasTotal - confirmados);
  const vinculo = meuVinculo(meuStatus);

  return (
    <Link href={`/partida/${id}`} className={estilos.card}>
      <span className={estilos.cardTop}>
        <span className={estilos.cardPlace}>{local ?? 'Partida de tênis'}</span>
        {distanciaM !== null && distanciaM !== undefined && (
          <span className={estilos.cardDist}>{(distanciaM / 1000).toFixed(1)} km</span>
        )}
      </span>
      <span className={estilos.cardWhen}>
        {quando(dataHora)} · {tipo === 'duplas' ? 'duplas' : 'simples'}
      </span>
      {anfitriao && <span className={estilos.cardHost}>Anfitrião: {anfitriao}</span>}
      <span className={estilos.cardFoot}>
        <span className={estilos.cardPills}>
          {restantes > 0 ? (
            <Pill label={`${restantes} vaga${restantes > 1 ? 's' : ''}`} tone="ok" />
          ) : (
            <Pill label="completa" tone="muted" />
          )}
          {vinculo && <Pill label={vinculo.label} tone={vinculo.tone} />}
        </span>
        <span className={estilos.cardGo}>Ver partida →</span>
      </span>
    </Link>
  );
}
