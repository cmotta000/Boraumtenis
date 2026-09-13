'use client';

import { ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { GaleriaFotos } from '@/components/galeria';
import { Avatar, Btn, CourtLine, Pagina, Pill, Placar, ScreenHeader, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { faz, quando } from '@/lib/datas';
import type {
  GolpePreferido,
  MaoDominante,
  MatchStatus,
  MatchTipo,
  PlayerStatus,
  ResultStatus,
  SetPlacar,
} from '@/lib/database.types';
import { escolherFotos, MAX_FOTOS } from '@/lib/fotos';
import { adicionarFotosNaPartida, postsDaPartida } from '@/lib/posts';
import { supabase } from '@/lib/supabase';

import estilos from './partida.module.css';

type Match = {
  id: string;
  criador_id: string;
  tipo: MatchTipo;
  local_texto: string | null;
  data_hora: string;
  vagas_total: number;
  status: MatchStatus;
  observacoes: string | null;
};
type Perfil = {
  nome: string;
  elo: number;
  idade: number | null;
  anos: number | null;
  mao: MaoDominante | null;
  golpe: GolpePreferido | null;
  cidade: string | null;
  uf: string | null;
};
type Jogador = Perfil & { user_id: string; status: PlayerStatus };
type Mensagem = { id: string; user_id: string; texto: string; created_at: string };
type Resultado = {
  id: string;
  reporter_id: string;
  vencedores: string[];
  perdedores: string[];
  sets: SetPlacar[];
  sets_vencedor: number;
  sets_perdedor: number;
  pontos: number;
  status: ResultStatus;
};

const MAO_LABEL: Record<MaoDominante, string> = {
  destro: 'Destro',
  canhoto: 'Canhoto',
  ambidestro: 'Ambidestro',
};
const GOLPE_LABEL: Record<GolpePreferido, string> = {
  forehand: 'Forehand',
  backhand: 'Backhand',
  saque: 'Saque',
  voleio: 'Voleio',
  smash: 'Smash',
};

/** Tags de qualificação tenística de um jogador, para exibir no card. */
function qualificacoes(j: Perfil): string[] {
  const tags: string[] = [];
  if (j.anos != null) tags.push(`${j.anos} ${j.anos === 1 ? 'ano' : 'anos'} de jogo`);
  if (j.mao) tags.push(MAO_LABEL[j.mao]);
  if (j.golpe) tags.push(GOLPE_LABEL[j.golpe]);
  if (j.idade != null) tags.push(`${j.idade} anos`);
  if (j.cidade) tags.push(`${j.cidade}${j.uf ? '/' + j.uf : ''}`);
  return tags;
}

const STATUS_PILL: Record<MatchStatus, { label: string; tone: 'ok' | 'clay' | 'muted' }> = {
  aberta: { label: 'Aberta', tone: 'ok' },
  cheia: { label: 'Completa', tone: 'clay' },
  jogada: { label: 'Jogada', tone: 'muted' },
  cancelada: { label: 'Cancelada', tone: 'muted' },
};

const SEM_NOME: Perfil = {
  nome: 'Jogador',
  elo: 1200,
  idade: null,
  anos: null,
  mao: null,
  golpe: null,
  cidade: null,
  uf: null,
};

export default function DetalhePartida() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const me = session?.user.id;

  const [match, setMatch] = useState<Match | null>(null);
  const [criador, setCriador] = useState<Perfil | null>(null);
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [fotos, setFotos] = useState<string[]>([]);
  const [subindoFotos, setSubindoFotos] = useState(false);
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [naoAchou, setNaoAchou] = useState(false);
  const [acao, setAcao] = useState<string | null>(null); // id da ação em curso
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    const { data: m } = await supabase
      .from('matches')
      .select('id, criador_id, tipo, local_texto, data_hora, vagas_total, status, observacoes')
      .eq('id', id)
      .maybeSingle();
    if (!m) {
      setNaoAchou(true);
      setLoading(false);
      return;
    }
    setMatch(m as Match);

    const { data: mp } = await supabase.from('match_players').select('user_id, status').eq('match_id', id);
    const players = (mp ?? []) as { user_id: string; status: PlayerStatus }[];

    // Os perfis vêm por RPC: é ela que decide o que cada um pode ver de quem,
    // conforme a privacidade do dono do perfil.
    const { data: profs } = await supabase.rpc('perfis_da_partida', { p_match_id: id });
    const map = new Map<string, Perfil>(
      (profs ?? []).map((p) => [
        p.user_id,
        {
          nome: p.nome,
          elo: p.elo_rating,
          idade: p.idade,
          anos: p.anos_jogando,
          mao: p.mao_dominante as MaoDominante | null,
          golpe: p.golpe_preferido as GolpePreferido | null,
          cidade: p.cidade,
          uf: p.uf,
        },
      ]),
    );

    setCriador(map.get(m.criador_id) ?? SEM_NOME);
    setJogadores(
      players.map((p) => ({ user_id: p.user_id, status: p.status, ...(map.get(p.user_id) ?? SEM_NOME) })),
    );

    const { data: res } = await supabase
      .from('match_results')
      .select('id, reporter_id, vencedores, perdedores, sets, sets_vencedor, sets_perdedor, pontos, status')
      .eq('match_id', id)
      .maybeSingle();
    setResultado((res as Resultado) ?? null);

    setFotos((await postsDaPartida(id)).flatMap((p) => p.fotos));

    setLoading(false);
  }, [id]);

  /** Fotos tiradas depois do jogo — entram no post do resultado, se houver. */
  async function adicionarFotosDaPartida() {
    if (!id || !me) return;
    setErro(null);
    try {
      const novas = await escolherFotos(MAX_FOTOS);
      if (novas.length === 0) return;
      setSubindoFotos(true);
      await adicionarFotosNaPartida(id, me, novas);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar as fotos.');
    } finally {
      setSubindoFotos(false);
    }
  }

  const carregarMsgs = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('match_messages')
      .select('id, user_id, texto, created_at')
      .eq('match_id', id)
      .order('created_at', { ascending: true });
    setMsgs((data ?? []) as Mensagem[]);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Realtime: novas mensagens e mudanças nos jogadores.
  useEffect(() => {
    if (!id) return;
    carregarMsgs();
    const ch = supabase
      .channel(`match-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'match_messages', filter: `match_id=eq.${id}` },
        (payload) => {
          setMsgs((prev) =>
            prev.some((x) => x.id === (payload.new as Mensagem).id)
              ? prev
              : [...prev, payload.new as Mensagem],
          );
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_players', filter: `match_id=eq.${id}` },
        () => carregar(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, carregar, carregarMsgs]);

  // O chat acompanha a última mensagem (rola só a caixa, não a página).
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  async function rpc(nome: 'solicitar_entrada' | 'sair_partida' | 'cancelar_partida', chave: string) {
    setErro(null);
    setAcao(chave);
    try {
      const { error } = await supabase.rpc(nome, { p_match_id: id });
      if (error) throw error;
      await carregar();
    } catch (e) {
      setErro(traduz(e instanceof Error ? e.message : undefined));
    } finally {
      setAcao(null);
    }
  }

  async function responder(userId: string, aceitar: boolean) {
    setErro(null);
    setAcao(`resp-${userId}-${aceitar}`);
    try {
      const { error } = await supabase.rpc('responder_solicitacao', {
        p_match_id: id!,
        p_user_id: userId,
        p_aceitar: aceitar,
      });
      if (error) throw error;
      await carregar();
    } catch (e) {
      setErro(traduz(e instanceof Error ? e.message : undefined));
    } finally {
      setAcao(null);
    }
  }

  /** Confirma ou contesta o placar registrado pelo outro jogador. */
  async function responderPlacar(aceitar: boolean) {
    if (!resultado) return;
    setErro(null);
    setAcao(aceitar ? 'confirmar-placar' : 'contestar-placar');
    try {
      const { error } = await supabase.rpc(aceitar ? 'confirmar_resultado' : 'contestar_resultado', {
        p_result_id: resultado.id,
      });
      if (error) throw error;
      await carregar();
    } catch (e) {
      setErro(traduz(e instanceof Error ? e.message : undefined));
    } finally {
      setAcao(null);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const t = texto.trim();
    if (!t || !id || !me) return;
    setTexto('');
    const { error } = await supabase.from('match_messages').insert({ match_id: id, user_id: me, texto: t });
    if (error) {
      setTexto(t);
      setErro('Não foi possível enviar a mensagem.');
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
  if (naoAchou || !match) {
    return (
      <Pagina>
        <ScreenHeader title="Partida" fallback="/partidas" />
        <p className={estilos.lede}>Esta partida não existe mais.</p>
      </Pagina>
    );
  }

  const souCriador = match.criador_id === me;
  const meu = jogadores.find((j) => j.user_id === me);
  const confirmados = jogadores.filter((j) => j.status === 'confirmado');
  const pendentes = jogadores.filter((j) => j.status === 'convidado');
  const souParticipante = souCriador || meu?.status === 'confirmado';
  const vagasRestantes = Math.max(0, match.vagas_total - confirmados.length);
  const encerrada = match.status === 'cancelada' || match.status === 'jogada';
  const pill = STATUS_PILL[match.status];

  // O placar só entra em cena depois da hora marcada, e só para quem jogou.
  const jaAconteceu = new Date(match.data_hora) <= new Date();
  const mostrarPlacar = souParticipante && jaAconteceu && match.status !== 'cancelada';
  const nomeDe = (uid: string) =>
    (uid === match.criador_id ? criador?.nome : jogadores.find((j) => j.user_id === uid)?.nome) ?? 'Jogador';

  return (
    <Pagina>
      <ScreenHeader title="Partida" fallback="/partidas" />

      {/* Cartão principal */}
      <div className={estilos.card}>
        <div className={estilos.cardTop}>
          <Pill label={pill.label} tone={pill.tone} />
          <span className={estilos.tipo}>{match.tipo === 'duplas' ? 'Duplas' : 'Simples'}</span>
        </div>
        <h2 className={estilos.local}>{match.local_texto ?? 'Partida de tênis'}</h2>
        <p className={estilos.quando}>{quando(match.data_hora)}</p>
        <div className={estilos.host}>
          <Avatar nome={criador?.nome} size={34} />
          <p className={estilos.hostText}>
            Criada por <span className={estilos.hostNome}>{criador?.nome}</span>
          </p>
        </div>
        {match.observacoes ? <p className={estilos.obs}>“{match.observacoes}”</p> : null}
        <p className={estilos.vagasRow}>
          <span className={estilos.vagasNum}>
            {confirmados.length}/{match.vagas_total}
          </span>
          <span className={estilos.vagasLabel}>
            {vagasRestantes > 0 ? `${vagasRestantes} vaga(s) aberta(s)` : 'partida completa'}
          </span>
        </p>
      </div>

      {erro && <p className={estilos.erro}>{erro}</p>}

      {/* Placar da partida */}
      {mostrarPlacar && (
        <section className={estilos.bloco}>
          <h3 className={estilos.section}>PLACAR</h3>

          {!resultado || resultado.status === 'contestado' ? (
            <div className={estilos.placarBox}>
              <p className={estilos.placarTitulo}>
                {resultado ? 'Placar contestado' : 'Como terminou o jogo?'}
              </p>
              <p className={estilos.placarTexto}>
                {resultado
                  ? 'O outro jogador não concordou com o placar. Registre de novo com o resultado correto.'
                  : 'Qualquer um dos jogadores pode registrar. Vitória por 2 a 0 vale 50 pontos; por 2 a 1, 35. Quem perde não pontua.'}
              </p>
              <Btn
                label={resultado ? 'Registrar de novo' : 'Registrar placar'}
                onClick={() => router.push(`/resultado/${match.id}`)}
                full
                className={estilos.registrar}
              />
            </div>
          ) : (
            <div className={estilos.placarBox}>
              <Placar
                vencedores={resultado.vencedores.map(nomeDe)}
                perdedores={resultado.perdedores.map(nomeDe)}
                sets={resultado.sets}
                pontos={resultado.pontos}
              />

              {resultado.status === 'confirmado' ? (
                <>
                  <p className={estilos.placarOk}>✓ Confirmado — os pontos já entraram no ranking.</p>
                  <Link
                    href={`/atividades?partida=${match.id}`}
                    className={estilos.placarTexto}
                    style={{ display: 'inline-block', color: 'var(--clay-ink)', fontWeight: 600 }}>
                    Registrar atividade desta partida
                  </Link>
                </>
              ) : resultado.reporter_id === me ? (
                <p className={estilos.placarTexto}>
                  Aguardando {jogadores.find((j) => j.user_id !== me)?.nome ?? 'o outro jogador'} confirmar.
                </p>
              ) : (
                <>
                  <p className={estilos.placarTexto}>
                    {nomeDe(resultado.reporter_id)} registrou este placar. Está certo?
                  </p>
                  <div className={estilos.reqActions}>
                    <button
                      type="button"
                      onClick={() => responderPlacar(false)}
                      disabled={!!acao}
                      className={`${estilos.miniBtn} ${estilos.miniGhost}`}>
                      {acao === 'contestar-placar' ? '…' : 'Está errado'}
                    </button>
                    <button
                      type="button"
                      onClick={() => responderPlacar(true)}
                      disabled={!!acao}
                      className={`${estilos.miniBtn} ${estilos.miniOk}`}>
                      {acao === 'confirmar-placar' ? '…' : 'Confirmar placar'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* Fotos da partida */}
      {mostrarPlacar && (
        <section className={estilos.bloco}>
          <h3 className={estilos.section}>FOTOS DA PARTIDA</h3>
          {fotos.length > 0 ? (
            <GaleriaFotos fotos={fotos} />
          ) : (
            <p className={estilos.lede}>
              Ninguém publicou fotos ainda. Suba as melhores do jogo — elas entram no feed junto do placar.
            </p>
          )}
          <div className={estilos.fotosBtn}>
            <Btn
              label={subindoFotos ? 'Enviando…' : fotos.length > 0 ? 'Adicionar mais fotos' : 'Adicionar fotos'}
              variant="outline"
              icone={ImageIcon}
              onClick={adicionarFotosDaPartida}
              loading={subindoFotos}
            />
          </div>
        </section>
      )}

      {/* Ação do visitante */}
      {!souCriador && !encerrada && (
        <div className={estilos.blocoCurto}>
          {!meu || meu.status === 'recusado' ? (
            match.status === 'aberta' ? (
              <Btn
                label="Pedir pra entrar"
                onClick={() => rpc('solicitar_entrada', 'entrar')}
                loading={acao === 'entrar'}
                full
              />
            ) : (
              <p className={estilos.lede}>Esta partida já está completa.</p>
            )
          ) : meu.status === 'convidado' ? (
            <div className={estilos.waitBox}>
              <p className={estilos.waitTitle}>⏳ Solicitação enviada</p>
              <p className={estilos.waitText}>Aguardando {criador?.nome} confirmar você.</p>
              <button
                type="button"
                onClick={() => rpc('sair_partida', 'sair')}
                disabled={acao === 'sair'}
                className={estilos.linkDanger}>
                {acao === 'sair' ? 'Cancelando…' : 'Cancelar solicitação'}
              </button>
            </div>
          ) : (
            <div className={estilos.okBox}>
              <p className={estilos.okTitle}>✓ Você está confirmado!</p>
              <p className={estilos.okText}>Combine os detalhes no chat abaixo.</p>
              <button
                type="button"
                onClick={() => rpc('sair_partida', 'sair')}
                disabled={acao === 'sair'}
                className={estilos.linkDanger}>
                {acao === 'sair' ? 'Saindo…' : 'Sair da partida'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Painel do criador: solicitações pendentes */}
      {souCriador && !encerrada && (
        <section className={estilos.bloco}>
          <h3 className={estilos.section}>
            SOLICITAÇÕES {pendentes.length ? `(${pendentes.length})` : ''}
          </h3>
          {pendentes.length === 0 ? (
            <p className={estilos.lede}>Ninguém pediu pra entrar ainda. Compartilhe sua partida!</p>
          ) : (
            <div className={estilos.lista}>
              {pendentes.map((p) => {
                const cheia = vagasRestantes <= 0;
                const tags = qualificacoes(p);
                return (
                  <div key={p.user_id} className={estilos.reqCard}>
                    <div className={estilos.reqHead}>
                      <Avatar nome={p.nome} size={44} />
                      <div className={estilos.reqCorpo}>
                        <p className={estilos.reqNome}>{p.nome}</p>
                        <p className={estilos.reqElo}>ELO {p.elo}</p>
                      </div>
                    </div>
                    {tags.length > 0 ? (
                      <div className={estilos.tags}>
                        {tags.map((t) => (
                          <span key={t} className={estilos.tag}>
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className={estilos.reqSemPerfil}>Ainda não preencheu o perfil de jogador.</p>
                    )}
                    <div className={estilos.reqActions}>
                      <button
                        type="button"
                        onClick={() => responder(p.user_id, false)}
                        disabled={!!acao}
                        className={`${estilos.miniBtn} ${estilos.miniGhost}`}>
                        Recusar
                      </button>
                      <button
                        type="button"
                        onClick={() => responder(p.user_id, true)}
                        disabled={!!acao || cheia}
                        className={`${estilos.miniBtn} ${estilos.miniOk}`}>
                        {acao === `resp-${p.user_id}-true` ? '…' : cheia ? 'Sem vaga' : 'Confirmar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Jogadores confirmados */}
      <section className={estilos.bloco}>
        <h3 className={estilos.section}>NA PARTIDA ({confirmados.length})</h3>
        <div className={estilos.listaCurta}>
          {confirmados.map((p) => {
            const tags = qualificacoes(p);
            return (
              <div key={p.user_id} className={estilos.playerRow}>
                <div className={estilos.reqHead}>
                  <Avatar nome={p.nome} size={38} />
                  <div className={estilos.reqCorpo}>
                    <p className={estilos.reqNome}>
                      {p.nome} {p.user_id === match.criador_id ? '· anfitrião' : ''}
                    </p>
                    <p className={estilos.reqElo}>ELO {p.elo}</p>
                  </div>
                  {p.user_id === me && <Pill label="você" tone="ball" />}
                </div>
                {tags.length > 0 && (
                  <div className={estilos.tags}>
                    {tags.map((t) => (
                      <span key={t} className={estilos.tag}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Chat */}
      {souParticipante && !encerrada && (
        <section className={estilos.chat}>
          <CourtLine className={estilos.chatDivisor} />
          <h3 className={estilos.section}>CHAT DA PARTIDA</h3>
          <div ref={chatRef} className={estilos.chatBox}>
            {msgs.length === 0 ? (
              <p className={estilos.chatEmpty}>Ainda sem mensagens. Manda o primeiro “bora!”.</p>
            ) : (
              msgs.map((msg) => {
                const daMinhaVez = msg.user_id === me;
                const nome =
                  jogadores.find((j) => j.user_id === msg.user_id)?.nome ??
                  (msg.user_id === match.criador_id ? criador?.nome : 'Jogador');
                return (
                  <div
                    key={msg.id}
                    className={`${estilos.bubbleWrap} ${daMinhaVez ? estilos.bubbleWrapMe : ''}`}>
                    <div className={`${estilos.bubble} ${daMinhaVez ? estilos.bubbleMe : ''}`}>
                      {!daMinhaVez && <p className={estilos.bubbleAutor}>{nome}</p>}
                      <p className={estilos.bubbleText}>{msg.texto}</p>
                      <p className={estilos.bubbleTime}>{faz(msg.created_at)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <form onSubmit={enviar} className={estilos.chatInputRow}>
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escreva uma mensagem…"
              maxLength={1000}
              aria-label="Mensagem para o chat da partida"
              className={estilos.chatInput}
            />
            <button
              type="submit"
              disabled={!texto.trim()}
              aria-label="Enviar mensagem"
              className={estilos.sendBtn}>
              ↑
            </button>
          </form>
        </section>
      )}

      {/* Cancelar (criador) */}
      {souCriador && !encerrada && (
        <button
          type="button"
          onClick={() => rpc('cancelar_partida', 'cancelar')}
          disabled={acao === 'cancelar'}
          className={`${estilos.linkDanger} ${estilos.cancelarPartida}`}>
          {acao === 'cancelar' ? 'Cancelando…' : 'Cancelar esta partida'}
        </button>
      )}
      {encerrada && (
        <p className={`${estilos.lede} ${estilos.centralizado}`}>
          {match.status === 'cancelada' ? 'Esta partida foi cancelada.' : 'Esta partida já foi jogada.'}
        </p>
      )}
    </Pagina>
  );
}

function traduz(msg?: string): string {
  if (!msg) return 'Algo deu errado. Tente de novo.';
  return msg.replace(/^.*?:\s*/, '');
}
