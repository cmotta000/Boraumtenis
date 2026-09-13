'use client';

import { Minus, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Card, CourtLine, Pagina, Secao, Spinner } from '@/components/ui';
import { dataCurta } from '@/lib/datas';
import { supabase } from '@/lib/supabase';
import type { Database, Tendencia } from '@/lib/database.types';

import estilos from './liga.module.css';

type MinhaLiga = Database['public']['Functions']['minha_liga']['Returns'][number];
type LinhaLiga = Database['public']['Functions']['liga_classificacao']['Returns'][number];
type Divisao = Database['public']['Tables']['divisions']['Row'];

const ICONE_TENDENCIA = {
  subindo: TrendingUp,
  descendo: TrendingDown,
  estavel: Minus,
} as const satisfies Record<Tendencia, unknown>;

const TEXTO_TENDENCIA: Record<Tendencia, string> = {
  subindo: 'Subindo na tabela',
  descendo: 'Caindo na tabela',
  estavel: 'Sem mexer na tabela',
};

/**
 * Tamanho da faixa de promoção/rebaixamento: 20% da divisão, no mínimo 1.
 * Espelha `public.liga_faixa()` — quem manda é o banco, isto aqui só desenha
 * as linhas divisórias na tabela.
 */
function faixa(total: number): number {
  return Math.max(1, Math.floor(total * 0.2));
}

/** Dias que faltam até o fim da temporada. `fim` vem como 'AAAA-MM-DD'. */
function diasAte(fim: string): { dias: number; data: Date } {
  const [a, m, d] = fim.split('-').map(Number);
  const alvo = new Date(a, m - 1, d);
  const hoje = new Date();
  const zero = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return { dias: Math.round((zero(alvo) - zero(hoje)) / 86_400_000), data: alvo };
}

function prazoDaTemporada(fim: string): string {
  const { dias, data } = diasAte(fim);
  if (dias < 0) return `encerrada em ${dataCurta(data)}`;
  if (dias === 0) return 'termina hoje';
  if (dias === 1) return 'termina amanhã';
  return `termina em ${dias} dias`;
}

export default function Liga() {
  const [carregando, setCarregando] = useState(true);
  const [indisponivel, setIndisponivel] = useState(false);
  const [minha, setMinha] = useState<MinhaLiga | null>(null);
  const [divisoes, setDivisoes] = useState<Divisao[]>([]);
  const [divisaoVista, setDivisaoVista] = useState<number | null>(null);
  const [linhas, setLinhas] = useState<LinhaLiga[]>([]);
  const [carregandoTabela, setCarregandoTabela] = useState(false);

  // Minha situação + catálogo de divisões. Enquanto a migration da liga não
  // for aplicada, as duas chamadas falham juntas e a tela cai no estado vazio.
  useEffect(() => {
    let vivo = true;

    (async () => {
      const [{ data: minhaData, error }, { data: divs }] = await Promise.all([
        supabase.rpc('minha_liga'),
        supabase.from('divisions').select('*').order('ordem'),
      ]);
      if (!vivo) return;

      const eu = minhaData?.[0] ?? null;
      setMinha(eu);
      setDivisoes(divs ?? []);
      setIndisponivel(Boolean(error) || !eu);
      setDivisaoVista(eu?.division_id ?? null);
      setCarregando(false);
    })();

    return () => {
      vivo = false;
    };
  }, []);

  const carregarTabela = useCallback(async (divisao: number | null) => {
    if (divisao === null) return;
    setCarregandoTabela(true);
    const { data } = await supabase.rpc('liga_classificacao', {
      p_division_id: divisao,
      p_limite: 50,
    });
    setLinhas(data ?? []);
    setCarregandoTabela(false);
  }, []);

  useEffect(() => {
    carregarTabela(divisaoVista);
  }, [carregarTabela, divisaoVista]);

  if (carregando) {
    return (
      <Pagina>
        <div className={estilos.carregando}>
          <Spinner size={24} />
        </div>
      </Pagina>
    );
  }

  // A liga ainda não está no banco (ou o jogador ainda não tem temporada).
  // Isso não é um erro do usuário, então não tem cara de erro.
  if (indisponivel || !minha) {
    return (
      <Pagina>
        <Card className={estilos.vazio}>
          <Trophy size={22} aria-hidden className={estilos.vazioIcone} />
          <h2 className={estilos.vazioTitulo}>A liga ainda não abriu</h2>
          <p className={estilos.vazioTexto}>
            As divisões entram no ar quando a temporada nova começar. Até lá o ranking normal
            continua valendo — e todo jogo que você registrar agora conta.
          </p>
          <Link href="/ranking" className={estilos.vazioLink}>
            Ver o ranking
          </Link>
        </Card>
      </Pagina>
    );
  }

  const cor = minha.division_cor ?? 'var(--clay)';
  const noTopo = minha.division_ordem >= 5;
  const naFaixa = minha.pontos_para_promocao === 0;
  const alvo = minha.pontos + minha.pontos_para_promocao;
  const progresso = noTopo ? 100 : alvo > 0 ? Math.round((minha.pontos / alvo) * 100) : 0;
  const proxima = divisoes.find((d) => d.ordem === minha.division_ordem + 1);
  const IconeTendencia = ICONE_TENDENCIA[minha.tendencia];

  const total = linhas.length;
  const corte = faixa(total);
  const divisaoAtual = divisoes.find((d) => d.id === divisaoVista);
  // O Saibro não tem degrau abaixo e os Mestres não têm degrau acima: marcar
  // "zona de rebaixamento" na divisão de entrada é assustar à toa.
  const ordemVista = divisaoAtual?.ordem ?? 1;
  const rotuloDaTabela =
    (divisaoAtual?.nome ?? 'Classificação') +
    (divisaoVista === minha.division_id ? ' · sua divisão' : '');

  return (
    <Pagina>
      {/* (a) Onde eu estou. É o elemento mais forte da tela. */}
      <Card className={estilos.cartao} style={{ borderTopColor: cor }}>
        <div className={estilos.cartaoTopo}>
          <span className={estilos.selo} style={{ background: cor }} aria-hidden />
          <div className={estilos.cartaoIdentidade}>
            <h2 className={estilos.divisaoNome}>{minha.division_nome}</h2>
            <p className={estilos.divisaoApelido}>{minha.division_apelido}</p>
          </div>
          <div className={estilos.posicaoBloco}>
            <span className={estilos.posicaoNumero}>{minha.posicao}º</span>
            <span className={estilos.posicaoDe}>de {minha.total_na_divisao}</span>
          </div>
        </div>

        <div className={estilos.numeros}>
          <div className={estilos.numero}>
            <span className={estilos.numeroValor}>{minha.pontos}</span>
            <span className={estilos.numeroRotulo}>pontos</span>
          </div>
          <div className={estilos.numero}>
            <span className={estilos.numeroValor}>
              {minha.vitorias}–{minha.derrotas}
            </span>
            <span className={estilos.numeroRotulo}>V–D</span>
          </div>
          <div className={estilos.numero}>
            <span className={estilos.numeroValor}>{minha.jogos}</span>
            <span className={estilos.numeroRotulo}>jogos</span>
          </div>
          <div className={estilos.numero}>
            <span className={estilos.numeroValor}>{minha.elo}</span>
            <span className={estilos.numeroRotulo}>ELO</span>
          </div>
        </div>

        <p className={estilos.temporada}>
          {minha.temporada_nome} · {prazoDaTemporada(minha.temporada_fim)}
        </p>

        {/* (b) O que falta pra subir. */}
        <div className={estilos.promocao}>
          <div
            className={estilos.barra}
            role="progressbar"
            aria-valuenow={progresso}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso até a zona de promoção">
            <span
              className={estilos.barraCheia}
              style={{ width: `${progresso}%`, background: cor }}
            />
          </div>

          {noTopo ? (
            <p className={estilos.promocaoTexto}>Não tem andar acima. Só dá pra cair.</p>
          ) : naFaixa ? (
            <p className={estilos.promocaoTexto}>
              <strong className={estilos.promocaoForte}>Você está na zona de promoção.</strong>{' '}
              Terminando a temporada aí, sobe para {proxima?.nome ?? 'a divisão de cima'}.
            </p>
          ) : (
            <p className={estilos.promocaoTexto}>
              Faltam{' '}
              <strong className={estilos.promocaoForte}>{minha.pontos_para_promocao} pts</strong>{' '}
              para alcançar a zona de promoção
              {proxima ? ` e subir para ${proxima.nome}` : ''}.
            </p>
          )}

          {minha.rebaixando && (
            <p className={estilos.rebaixando}>
              Você está na zona de rebaixamento. Falta temporada — dá pra virar.
            </p>
          )}
        </div>

        {/* (c) Pra onde eu estou indo. */}
        <p className={estilos.tendencia}>
          <IconeTendencia size={15} aria-hidden className={estilos[minha.tendencia]} />
          {TEXTO_TENDENCIA[minha.tendencia]}
        </p>
      </Card>

      {/* (e) Espiar as outras divisões. */}
      {divisoes.length > 0 && (
        <div className={estilos.seletor} role="radiogroup" aria-label="Divisão">
          {divisoes.map((d) => {
            const ativa = d.id === divisaoVista;
            return (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={ativa}
                onClick={() => setDivisaoVista(d.id)}
                className={`${estilos.chip} ${ativa ? estilos.chipAtivo : ''}`}>
                <span
                  className={estilos.chipPonto}
                  style={{ background: d.cor ?? 'var(--clay)' }}
                  aria-hidden
                />
                {d.nome}
              </button>
            );
          })}
        </div>
      )}

      {/* `Secao` recebe uma string só, então o rótulo é montado antes. */}
      <Secao className={estilos.secao}>{rotuloDaTabela}</Secao>

      <CourtLine className={estilos.divisor} />

      {/* (d) A tabela da divisão. */}
      {carregandoTabela ? (
        <div className={estilos.carregando}>
          <Spinner size={24} />
        </div>
      ) : linhas.length === 0 ? (
        <p className={estilos.empty}>
          Ninguém pontuou nesta divisão ainda. Quem registrar o primeiro placar abre a tabela.
        </p>
      ) : (
        <div className={estilos.table}>
          <div className={`${estilos.row} ${estilos.rowHead}`}>
            <span className={estilos.pos}>#</span>
            <span className={estilos.nome}>Jogador</span>
            <span className={estilos.tend} aria-hidden />
            <span className={estilos.vd}>V–D</span>
            <span className={estilos.pts}>PTS</span>
          </div>

          {linhas.map((l, i) => {
            const Icone = ICONE_TENDENCIA[l.tendencia];
            // A linha divisória cai DEPOIS do último promovido e ANTES do
            // primeiro rebaixado — o mesmo corte que a rotina do banco usa.
            const fimDaPromocao = ordemVista < 5 && i + 1 === corte && total > corte * 2;
            const inicioDoRebaixamento =
              ordemVista > 1 && i === total - corte && total > corte * 2;

            return (
              <div key={l.user_id}>
                {inicioDoRebaixamento && (
                  <p className={`${estilos.zona} ${estilos.zonaQueda}`}>zona de rebaixamento</p>
                )}
                <div className={`${estilos.row} ${l.eu ? estilos.rowEu : ''}`}>
                  <span className={`${estilos.pos} ${i < corte ? estilos.posTop : ''}`}>
                    {l.posicao}
                  </span>
                  <div className={estilos.jogador}>
                    <p className={`${estilos.nome} ${l.eu ? estilos.nomeEu : ''}`}>
                      {l.nome} {l.eu ? '(você)' : ''}
                    </p>
                    {l.cidade ? (
                      <p className={estilos.cidade}>
                        {l.cidade}
                        {l.uf ? `/${l.uf}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <span className={estilos.tend}>
                    <Icone size={14} aria-label={TEXTO_TENDENCIA[l.tendencia]} className={estilos[l.tendencia]} />
                  </span>
                  <span className={estilos.vd}>
                    {l.vitorias}–{l.derrotas}
                  </span>
                  <span className={estilos.pts}>{l.pontos}</span>
                </div>
                {fimDaPromocao && (
                  <p className={`${estilos.zona} ${estilos.zonaSubida}`}>zona de promoção</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Pagina>
  );
}
