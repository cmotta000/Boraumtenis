'use client';

import { useParams } from 'next/navigation';

import { Avatar, Pagina, Pill, Placar, ScreenHeader, Spinner } from '@/components/ui';
import {
  dataDoConfronto,
  placarDoConfronto,
  resumoDoRetrospecto,
  useRetrospecto,
} from '@/lib/confrontos';

import estilos from './confronto.module.css';

/**
 * Retrospecto contra um adversário — a resposta para "eu já joguei com esse
 * cara?", que é a pergunta que vem antes de aceitar uma partida.
 *
 * Nenhuma conta acontece aqui: tudo que esta tela mostra sai pronto de
 * `historico_confrontos()`, inclusive a decisão do que pode ou não ser
 * mostrado. Quando o adversário não abre o perfil, o local dos jogos chega
 * `null` do banco — a tela diz isso em voz alta em vez de deixar um espaço
 * vazio sem explicação.
 */
export default function Confronto() {
  const { id } = useParams<{ id: string }>();
  const { retrospecto, carregando, erro } = useRetrospecto(id);

  if (carregando) {
    return (
      <Pagina>
        <div className={estilos.carregando}>
          <Spinner size={24} />
        </div>
      </Pagina>
    );
  }

  if (erro || !retrospecto) {
    return (
      <Pagina>
        <ScreenHeader title="Retrospecto" fallback="/partidas" />
        <p className={estilos.lede}>
          {erro
            ? 'Não foi possível carregar o retrospecto agora. Tente de novo daqui a pouco.'
            : 'Não encontramos esse jogador.'}
        </p>
      </Pagina>
    );
  }

  const nome = retrospecto.nome ?? 'Jogador';
  const nunca = retrospecto.jogos === 0;

  return (
    <Pagina>
      <ScreenHeader title="Retrospecto" fallback="/partidas" />

      {/* Cabeçalho: contra quem é este retrospecto */}
      <div className={estilos.card}>
        <div className={estilos.quem}>
          <Avatar nome={nome} foto={retrospecto.avatar} size={48} />
          <div className={estilos.quemTexto}>
            <p className={estilos.rotulo}>RETROSPECTO CONTRA</p>
            <h2 className={estilos.nome}>{nome}</h2>
          </div>
        </div>

        {nunca ? (
          <p className={estilos.vazio}>Vocês ainda não se enfrentaram.</p>
        ) : (
          <>
            {/* O número grande: vitórias minhas x vitórias dele */}
            <div className={estilos.confrontoNumero}>
              <div className={estilos.lado}>
                <span className={estilos.ladoNum}>{retrospecto.vitoriasMinhas}</span>
                <span className={estilos.ladoNome}>Você</span>
              </div>
              <span className={estilos.versus} aria-hidden>
                ×
              </span>
              <div className={estilos.lado}>
                <span className={estilos.ladoNum}>{retrospecto.vitoriasDele}</span>
                <span className={estilos.ladoNome}>{nome}</span>
              </div>
            </div>

            <p className={estilos.resumo}>{resumoDoRetrospecto(retrospecto, nome)}</p>

            <dl className={estilos.numeros}>
              <div className={estilos.numero}>
                <dt className={estilos.numeroRotulo}>JOGOS</dt>
                <dd className={estilos.numeroValor}>{retrospecto.jogos}</dd>
              </div>
              <div className={estilos.numero}>
                <dt className={estilos.numeroRotulo}>SETS</dt>
                <dd className={estilos.numeroValor}>
                  {retrospecto.setsAFavor}–{retrospecto.setsContra}
                </dd>
              </div>
              <div className={estilos.numero}>
                <dt className={estilos.numeroRotulo}>SALDO</dt>
                <dd className={estilos.numeroValor}>
                  {retrospecto.saldoSets > 0 ? `+${retrospecto.saldoSets}` : retrospecto.saldoSets}
                </dd>
              </div>
            </dl>
          </>
        )}
      </div>

      {nunca ? (
        <p className={estilos.lede}>
          Quando vocês jogarem e o placar for confirmado pelos dois, o histórico do confronto aparece aqui.
        </p>
      ) : (
        <section className={estilos.bloco}>
          <h3 className={estilos.section}>
            {retrospecto.confrontos.length < retrospecto.jogos ? 'ÚLTIMOS JOGOS' : 'OS JOGOS'}
          </h3>

          {!retrospecto.perfilAberto && (
            <p className={estilos.aviso}>
              {nome} não abre o perfil para você, então o local dos jogos não aparece. O placar sim — você
              estava lá.
            </p>
          )}

          <div className={estilos.lista}>
            {retrospecto.confrontos.map((c, i) => {
              const { vencedores, perdedores, sets } = placarDoConfronto(c, nome);
              return (
                <article key={c.match_id ?? i} className={estilos.jogo}>
                  <div className={estilos.jogoTopo}>
                    <span className={estilos.jogoData}>{dataDoConfronto(c.data_hora)}</span>
                    <Pill
                      label={c.eu_venci ? 'vitória' : 'derrota'}
                      tone={c.eu_venci ? 'ok' : 'muted'}
                    />
                  </div>

                  <Placar vencedores={vencedores} perdedores={perdedores} sets={sets} compacto />

                  <p className={estilos.jogoLocal}>
                    {c.local ?? 'Local não disponível'}
                    {c.tipo === 'duplas' ? ' · duplas' : ''}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </Pagina>
  );
}
