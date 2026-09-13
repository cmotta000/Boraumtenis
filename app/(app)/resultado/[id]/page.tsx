'use client';

import { Check, ImageIcon } from 'lucide-react';
import type { Route } from 'next';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Avatar, Btn, CourtLine, Pagina, ScreenHeader, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { quando } from '@/lib/datas';
import type { MatchTipo, SetPlacar } from '@/lib/database.types';
import { descartarPreview, escolherFotos, enviarFotos, MAX_FOTOS, type FotoLocal } from '@/lib/fotos';
import { supabase } from '@/lib/supabase';

import estilos from './resultado.module.css';

type Jogador = { id: string; nome: string };
type Match = { id: string; local_texto: string | null; data_hora: string; tipo: MatchTipo };

type LinhaSet = { v: string; p: string };

/**
 * Quantos pontos a vitória vale, pela regra do produto:
 * 2 sets a 0 = 50 · 2 sets a 1 = 35 · derrota = 0.
 */
function pontosDaVitoria(sets: SetPlacar[]): number | null {
  const v = sets.filter((s) => s.v > s.p).length;
  const p = sets.filter((s) => s.p > s.v).length;
  if (v !== 2) return null;
  return p === 0 ? 50 : 35;
}

export default function RegistrarResultado() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const me = session?.user.id;

  const [match, setMatch] = useState<Match | null>(null);
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [vencedores, setVencedores] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<LinhaSet[]>([
    { v: '', p: '' },
    { v: '', p: '' },
  ]);
  const [legenda, setLegenda] = useState('');
  const [fotos, setFotos] = useState<FotoLocal[]>([]);

  const carregar = useCallback(async () => {
    if (!id) return;
    const { data: m } = await supabase
      .from('matches')
      .select('id, local_texto, data_hora, tipo, criador_id')
      .eq('id', id)
      .maybeSingle();
    if (!m) {
      setErro('Partida não encontrada.');
      setLoading(false);
      return;
    }
    setMatch(m as Match);

    // Só quem de fato jogou entra na escolha do vencedor: o criador e os
    // confirmados. A RPC devolve também quem só pediu pra entrar.
    const { data: jog } = await supabase.rpc('perfis_da_partida', { p_match_id: id });
    setJogadores(
      (jog ?? [])
        .filter((j) => j.status === 'criador' || j.status === 'confirmado')
        .map((j) => ({ id: j.user_id, nome: j.nome })),
    );
    setLoading(false);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const simples = match?.tipo !== 'duplas';

  function alternarVencedor(uid: string) {
    setErro(null);
    if (simples) {
      setVencedores([uid]);
      return;
    }
    setVencedores((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  }

  function editarSet(i: number, campo: 'v' | 'p', texto: string) {
    const limpo = texto.replace(/[^0-9]/g, '').slice(0, 2);
    setLinhas((prev) => prev.map((l, idx) => (idx === i ? { ...l, [campo]: limpo } : l)));
  }

  const setsPreenchidos: SetPlacar[] = linhas
    .filter((l) => l.v !== '' && l.p !== '')
    .map((l) => ({ v: Number(l.v), p: Number(l.p) }));
  const pontos = pontosDaVitoria(setsPreenchidos);
  const setsV = setsPreenchidos.filter((s) => s.v > s.p).length;
  const setsP = setsPreenchidos.filter((s) => s.p > s.v).length;

  async function adicionarFotos() {
    setErro(null);
    try {
      const novas = await escolherFotos(MAX_FOTOS - fotos.length);
      setFotos((prev) => [...prev, ...novas].slice(0, MAX_FOTOS));
    } catch {
      setErro('Não foi possível abrir a galeria.');
    }
  }

  function removerFoto(i: number) {
    setFotos((prev) => {
      descartarPreview(prev[i]);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  async function publicar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!id || !me) return;
    if (vencedores.length === 0) return setErro('Marque quem venceu a partida.');
    if (setsPreenchidos.length < 2) return setErro('Preencha pelo menos 2 sets.');
    if (setsPreenchidos.some((s) => s.v === s.p)) return setErro('Um set não pode terminar empatado.');
    if (pontos === null) {
      return setErro('O placar não fecha: quem venceu precisa ter ganho exatamente 2 sets.');
    }

    setEnviando(true);
    try {
      const caminhos = fotos.length > 0 ? await enviarFotos(me, fotos) : [];
      const { error } = await supabase.rpc('registrar_resultado', {
        p_match_id: id,
        p_vencedores: vencedores,
        p_sets: setsPreenchidos,
        p_legenda: legenda.trim() || null,
        p_fotos: caminhos,
      });
      if (error) throw error;
      router.replace(`/partida/${id}`);
    } catch (e) {
      setErro(traduz(e instanceof Error ? e.message : undefined));
      setEnviando(false);
    }
  }

  if (loading) {
    return (
      <Pagina>
        <div className={estilos.carregando}>
          <Spinner size={24} />
        </div>
      </Pagina>
    );
  }

  return (
    <Pagina>
      <ScreenHeader title="Registrar placar" fallback={`/partida/${id}` as Route} />

      {match && (
        <div className={estilos.contexto}>
          <h2 className={estilos.contextoLocal}>{match.local_texto ?? 'Partida de tênis'}</h2>
          <p className={estilos.contextoQuando}>{quando(match.data_hora)}</p>
        </div>
      )}

      <CourtLine className={estilos.divisor} />

      <form onSubmit={publicar}>
        {/* 1 — quem venceu */}
        <h3 className={estilos.passo}>1 · QUEM VENCEU?</h3>
        <div className={estilos.jogadores}>
          {jogadores.map((j) => {
            const ativo = vencedores.includes(j.id);
            return (
              <button
                key={j.id}
                type="button"
                aria-pressed={ativo}
                onClick={() => alternarVencedor(j.id)}
                className={estilos.jogador}>
                <Avatar nome={j.nome} size={38} />
                <span className={estilos.jogadorNome}>
                  {j.nome}
                  {j.id === me ? ' (você)' : ''}
                </span>
                {ativo && <Check size={18} aria-hidden />}
              </button>
            );
          })}
        </div>
        {!simples && <p className={estilos.dica}>Duplas: marque os dois jogadores do lado vencedor.</p>}

        {/* 2 — placar */}
        <h3 className={`${estilos.passo} ${estilos.passoSeguinte}`}>2 · COMO FOI O PLACAR?</h3>
        <p className={estilos.dica}>Games de quem venceu à esquerda, de quem perdeu à direita.</p>

        <div className={estilos.sets}>
          {linhas.map((l, i) => (
            <div key={i} className={estilos.setLinha}>
              <span className={estilos.setLabel}>{i + 1}º set</span>
              <input
                value={l.v}
                onChange={(e) => editarSet(i, 'v', e.target.value)}
                placeholder="6"
                inputMode="numeric"
                aria-label={`Games de quem venceu no ${i + 1}º set`}
                className={estilos.setInput}
              />
              <span className={estilos.setX} aria-hidden>
                ×
              </span>
              <input
                value={l.p}
                onChange={(e) => editarSet(i, 'p', e.target.value)}
                placeholder="4"
                inputMode="numeric"
                aria-label={`Games de quem perdeu no ${i + 1}º set`}
                className={estilos.setInput}
              />
              {i === 2 && (
                <button
                  type="button"
                  onClick={() => setLinhas((prev) => prev.slice(0, 2))}
                  className={estilos.remover}>
                  remover
                </button>
              )}
            </div>
          ))}
        </div>

        {linhas.length < 3 && (
          <button
            type="button"
            onClick={() => setLinhas((prev) => [...prev, { v: '', p: '' }])}
            className={estilos.addSet}>
            + Teve 3º set
          </button>
        )}

        {/* Prévia da pontuação */}
        <div className={`${estilos.pontos} ${pontos === null ? estilos.pontosVazio : ''}`}>
          {pontos === null ? (
            <p className={estilos.pontosTextoVazio}>
              {setsPreenchidos.length < 2
                ? 'Preencha os sets para ver quantos pontos a vitória vale.'
                : 'Placar incoerente: quem venceu precisa ter ganho 2 sets.'}
            </p>
          ) : (
            <>
              <span className={estilos.pontosPlacar}>
                {setsV} × {setsP}
              </span>
              <div className={estilos.pontosCorpo}>
                <p className={estilos.pontosValor}>+{pontos} pontos</p>
                <p className={estilos.pontosNota}>para quem venceu · derrota não pontua</p>
              </div>
            </>
          )}
        </div>

        {/* 3 — post */}
        <h3 className={`${estilos.passo} ${estilos.passoSeguinte}`}>3 · CONTE COMO FOI (opcional)</h3>
        <textarea
          value={legenda}
          onChange={(e) => setLegenda(e.target.value)}
          placeholder="Vento forte, virada no 3º set, quadra nova…"
          maxLength={500}
          aria-label="Como foi o jogo"
          className={estilos.legenda}
        />

        <div className={estilos.fotosGrid}>
          {fotos.map((f, i) => (
            <div key={f.uri} className={estilos.fotoBox}>
              {/* eslint-disable-next-line @next/next/no-img-element -- preview local (blob:). */}
              <img src={f.uri} alt={`Foto ${i + 1} escolhida`} className={estilos.foto} />
              <button
                type="button"
                onClick={() => removerFoto(i)}
                aria-label={`Remover foto ${i + 1}`}
                className={estilos.fotoRemover}>
                ×
              </button>
            </div>
          ))}
          {fotos.length < MAX_FOTOS && (
            <button type="button" onClick={adicionarFotos} className={estilos.fotoAdd}>
              <ImageIcon size={18} aria-hidden />
              <span className={estilos.fotoAddText}>Adicionar</span>
            </button>
          )}
        </div>
        <p className={estilos.dica}>
          As fotos entram no feed junto com o resultado. Até {MAX_FOTOS} por partida.
        </p>

        {erro && <p className={estilos.erro}>{erro}</p>}

        <Btn
          type="submit"
          label={enviando ? 'Publicando…' : 'Publicar resultado'}
          loading={enviando}
          full
          className={estilos.publicar}
        />
      </form>

      <p className={estilos.rodape}>
        O outro jogador precisa confirmar o placar antes dos pontos entrarem no ranking.
      </p>
    </Pagina>
  );
}

function traduz(msg?: string): string {
  if (!msg) return 'Não foi possível registrar o placar. Tente de novo.';
  return msg.replace(/^.*?:\s*/, '');
}
