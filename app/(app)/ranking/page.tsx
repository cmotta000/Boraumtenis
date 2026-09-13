'use client';

import { useCallback, useEffect, useState } from 'react';

import { CourtLine, Pagina, Segmented, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

import estilos from './ranking.module.css';

type Linha = {
  user_id: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  pontos: number;
  vitorias: number;
  derrotas: number;
};

type Aba = 'temporada' | 'geral';

const ABAS: { label: string; value: Aba }[] = [
  { label: 'Temporada', value: 'temporada' },
  { label: 'Geral', value: 'geral' },
];

export default function Ranking() {
  const { session } = useAuth();
  const [aba, setAba] = useState<Aba>('temporada');
  const [loading, setLoading] = useState(true);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [temporada, setTemporada] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    if (aba === 'temporada') {
      const [{ data }, { data: nome }] = await Promise.all([
        supabase.rpc('ranking_temporada', { p_limite: 50 }),
        supabase.rpc('temporada_nome'),
      ]);
      setLinhas((data as Linha[]) ?? []);
      setTemporada((nome as string | null) ?? null);
    } else {
      const { data } = await supabase.rpc('ranking_geral', { p_limite: 50 });
      setLinhas((data as Linha[]) ?? []);
    }
    setLoading(false);
  }, [aba]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const comPontos = linhas.filter((l) => l.pontos > 0 || l.vitorias > 0 || l.derrotas > 0);

  return (
    <Pagina>
      <div className={estilos.cabecalho}>
        <p className={estilos.subtitle}>
          {aba === 'temporada'
            ? (temporada ?? 'Temporada em aberto')
            : 'Pontos acumulados de todas as temporadas'}
        </p>
        <div className={estilos.abas}>
          <Segmented options={ABAS} value={aba} onChange={setAba} label="Recorte do ranking" />
        </div>
      </div>

      <p className={estilos.regra}>
        <strong className={estilos.regraForte}>50 pts</strong> por vitória de 2 sets a 0 ·{' '}
        <strong className={estilos.regraForte}>35 pts</strong> por 2 a 1 · derrota não pontua
      </p>

      <CourtLine className={estilos.divisor} />

      {loading ? (
        <div className={estilos.carregando}>
          <Spinner size={24} />
        </div>
      ) : comPontos.length === 0 ? (
        <p className={estilos.empty}>
          Ninguém pontuou ainda. Jogue uma partida e registre o placar — o ranking começa aí.
        </p>
      ) : (
        <div className={estilos.table}>
          <div className={`${estilos.row} ${estilos.rowHead}`}>
            <span className={estilos.pos}>#</span>
            <span className={estilos.nome}>Jogador</span>
            <span className={estilos.vd}>V–D</span>
            <span className={estilos.pts}>PTS</span>
          </div>
          {comPontos.map((l, i) => {
            const eu = l.user_id === session?.user.id;
            return (
              <div key={l.user_id} className={`${estilos.row} ${eu ? estilos.rowEu : ''}`}>
                <span className={`${estilos.pos} ${i < 3 ? estilos.posTop : ''}`}>{i + 1}</span>
                <div className={estilos.jogador}>
                  <p className={`${estilos.nome} ${eu ? estilos.nomeEu : ''}`}>
                    {l.nome} {eu ? '(você)' : ''}
                  </p>
                  {l.cidade ? (
                    <p className={estilos.cidade}>
                      {l.cidade}
                      {l.uf ? `/${l.uf}` : ''}
                    </p>
                  ) : null}
                </div>
                <span className={estilos.vd}>
                  {l.vitorias}–{l.derrotas}
                </span>
                <span className={estilos.pts}>{l.pontos}</span>
              </div>
            );
          })}
        </div>
      )}
    </Pagina>
  );
}
