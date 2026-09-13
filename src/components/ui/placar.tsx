import type { LadoJogador, SetPlacar } from '@/lib/database.types';

import estilos from './placar.module.css';

/**
 * Placar de transmissão — o objeto característico do app.
 *
 * Uma linha por lado, sets em colunas de dígitos tabulares, e quem venceu
 * marcado pela bola e pelo risco de saibro na borda. É o mesmo desenho no
 * feed, na partida e em qualquer lugar que mostre um resultado.
 */
export function Placar({
  vencedores,
  perdedores,
  sets,
  pontos,
  compacto,
}: {
  vencedores: LadoJogador[] | string[];
  perdedores: LadoJogador[] | string[];
  sets: SetPlacar[];
  pontos?: number | null;
  compacto?: boolean;
}) {
  const nome = (x: LadoJogador | string) => (typeof x === 'string' ? x : x.nome);
  const linhaV = vencedores.map(nome).join(' e ') || 'Vencedor';
  const linhaP = perdedores.map(nome).join(' e ') || 'Adversário';

  return (
    <div className={`${estilos.placar} ${compacto ? estilos.compacto : ''}`}>
      <div className={estilos.linha}>
        <span className={estilos.risco} aria-hidden />
        <span className={estilos.bola} aria-hidden />
        <span className={`${estilos.nome} ${estilos.nomeV}`}>{linhaV}</span>
        {sets.map((s, i) => (
          <span key={i} className={`${estilos.game} ${estilos.gameV}`}>
            {s.v}
          </span>
        ))}
      </div>

      <div className={`${estilos.linha} ${estilos.linhaP}`}>
        <span className={estilos.bolaVazia} aria-hidden />
        <span className={estilos.nome}>{linhaP}</span>
        {sets.map((s, i) => (
          <span key={i} className={estilos.game}>
            {s.p}
          </span>
        ))}
      </div>

      {pontos != null && <p className={estilos.pontos}>+{pontos} pts</p>}
    </div>
  );
}
