import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GaleriaFotos } from '@/components/galeria';
import { Avatar, Btn, CourtLine, Pill, Placar, ScreenHeader } from '@/components/ui';
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
import { useAuth } from '@/lib/auth';
import { escolherFotos, MAX_FOTOS } from '@/lib/fotos';
import { adicionarFotosNaPartida, postsDaPartida } from '@/lib/posts';
import { supabase } from '@/lib/supabase';
import { colors, font, maxW, radius } from '@/theme/tokens';

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

const MAO_LABEL: Record<MaoDominante, string> = { destro: 'Destro', canhoto: 'Canhoto', ambidestro: 'Ambidestro' };
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

export default function DetalhePartida() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
  const chatRef = useRef<ScrollView>(null);

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

    const { data: mp } = await supabase
      .from('match_players')
      .select('user_id, status')
      .eq('match_id', id);
    const players = (mp ?? []) as { user_id: string; status: PlayerStatus }[];

    const ids = Array.from(new Set([m.criador_id, ...players.map((p) => p.user_id)]));
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, nome, elo_rating, idade, anos_jogando, mao_dominante, golpe_preferido, cidade, uf')
      .in('id', ids);
    const semNome: Perfil = { nome: 'Jogador', elo: 1200, idade: null, anos: null, mao: null, golpe: null, cidade: null, uf: null };
    const map = new Map<string, Perfil>(
      (profs ?? []).map((p) => [
        p.id,
        {
          nome: p.nome,
          elo: p.elo_rating,
          idade: p.idade,
          anos: p.anos_jogando,
          mao: p.mao_dominante,
          golpe: p.golpe_preferido,
          cidade: p.cidade,
          uf: p.uf,
        },
      ]),
    );

    setCriador(map.get(m.criador_id) ?? semNome);
    setJogadores(players.map((p) => ({ user_id: p.user_id, status: p.status, ...(map.get(p.user_id) ?? semNome) })));

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
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível enviar as fotos.');
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
            prev.some((x) => x.id === (payload.new as Mensagem).id) ? prev : [...prev, payload.new as Mensagem],
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

  async function rpc(nome: 'solicitar_entrada' | 'sair_partida' | 'cancelar_partida', chave: string) {
    setErro(null);
    setAcao(chave);
    try {
      const { error } = await supabase.rpc(nome, { p_match_id: id });
      if (error) throw error;
      await carregar();
    } catch (e: any) {
      setErro(traduz(e?.message));
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
    } catch (e: any) {
      setErro(traduz(e?.message));
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
    } catch (e: any) {
      setErro(traduz(e?.message));
    } finally {
      setAcao(null);
    }
  }

  async function enviar() {
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
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator color={colors.clay} />
      </View>
    );
  }
  if (naoAchou || !match) {
    return (
      <ScrollView style={styles.fill} contentContainerStyle={styles.scroll}>
        <View style={[styles.container, { maxWidth: maxW }]}>
          <ScreenHeader title="Partida" fallback="/partidas" />
          <Text style={styles.lede}>Esta partida não existe mais.</Text>
        </View>
      </ScrollView>
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
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={chatRef}
        contentContainerStyle={styles.scroll}
        onContentSizeChange={() => souParticipante && chatRef.current?.scrollToEnd({ animated: true })}>
        <View style={[styles.container, { maxWidth: maxW }]}>
          <ScreenHeader title="Partida" fallback="/partidas" />

          {/* Cartão principal */}
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Pill label={pill.label} tone={pill.tone} />
              <Text style={styles.tipo}>{match.tipo === 'duplas' ? 'Duplas' : 'Simples'}</Text>
            </View>
            <Text style={styles.local}>{match.local_texto ?? 'Partida de tênis'}</Text>
            <Text style={styles.quando}>{quando(match.data_hora)}</Text>
            <View style={styles.host}>
              <Avatar nome={criador?.nome} size={34} />
              <Text style={styles.hostText}>
                Criada por <Text style={{ fontWeight: '700', color: colors.ink }}>{criador?.nome}</Text>
              </Text>
            </View>
            {match.observacoes ? <Text style={styles.obs}>“{match.observacoes}”</Text> : null}
            <View style={styles.vagasRow}>
              <Text style={styles.vagasNum}>
                {confirmados.length}/{match.vagas_total}
              </Text>
              <Text style={styles.vagasLabel}>
                {vagasRestantes > 0 ? `${vagasRestantes} vaga(s) aberta(s)` : 'partida completa'}
              </Text>
            </View>
          </View>

          {erro && <Text style={styles.erro}>{erro}</Text>}

          {/* Placar da partida */}
          {mostrarPlacar && (
            <View style={{ marginTop: 20 }}>
              <Text style={styles.section}>PLACAR</Text>

              {!resultado || resultado.status === 'contestado' ? (
                <View style={styles.placarBox}>
                  <Text style={styles.placarTitulo}>
                    {resultado ? 'Placar contestado' : 'Como terminou o jogo?'}
                  </Text>
                  <Text style={styles.placarTexto}>
                    {resultado
                      ? 'O outro jogador não concordou com o placar. Registre de novo com o resultado correto.'
                      : 'Qualquer um dos jogadores pode registrar. Vitória por 2 a 0 vale 50 pontos; por 2 a 1, 35. Quem perde não pontua.'}
                  </Text>
                  <Btn
                    label={resultado ? 'Registrar de novo' : 'Registrar placar'}
                    onPress={() => router.push(`/resultado/${match.id}` as never)}
                    full
                    style={{ marginTop: 16 }}
                  />
                </View>
              ) : (
                <View style={styles.placarBox}>
                  <Placar
                    vencedores={resultado.vencedores.map(nomeDe)}
                    perdedores={resultado.perdedores.map(nomeDe)}
                    sets={resultado.sets}
                    pontos={resultado.pontos}
                  />

                  {resultado.status === 'confirmado' ? (
                    <Text style={styles.placarOk}>✓ Confirmado — os pontos já entraram no ranking.</Text>
                  ) : resultado.reporter_id === me ? (
                    <Text style={styles.placarTexto}>
                      Aguardando {jogadores.find((j) => j.user_id !== me)?.nome ?? 'o outro jogador'} confirmar.
                    </Text>
                  ) : (
                    <>
                      <Text style={styles.placarTexto}>
                        {nomeDe(resultado.reporter_id)} registrou este placar. Está certo?
                      </Text>
                      <View style={styles.reqActions}>
                        <Pressable
                          onPress={() => responderPlacar(false)}
                          disabled={!!acao}
                          style={({ hovered }: any) => [
                            styles.miniBtn,
                            styles.miniGhost,
                            { flex: 1 },
                            hovered && { opacity: 0.8 },
                          ]}>
                          <Text style={styles.miniGhostText}>
                            {acao === 'contestar-placar' ? '…' : 'Está errado'}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => responderPlacar(true)}
                          disabled={!!acao}
                          style={({ hovered }: any) => [
                            styles.miniBtn,
                            styles.miniOk,
                            { flex: 1 },
                            hovered && { opacity: 0.9 },
                          ]}>
                          <Text style={styles.miniOkText}>
                            {acao === 'confirmar-placar' ? '…' : 'Confirmar placar'}
                          </Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Fotos da partida */}
          {mostrarPlacar && (
            <View style={{ marginTop: 22 }}>
              <Text style={styles.section}>FOTOS DA PARTIDA</Text>
              {fotos.length > 0 ? (
                <GaleriaFotos fotos={fotos} />
              ) : (
                <Text style={styles.lede}>
                  Ninguém publicou fotos ainda. Suba as melhores do jogo — elas entram no feed junto do placar.
                </Text>
              )}
              <Btn
                label={subindoFotos ? 'Enviando…' : fotos.length > 0 ? 'Adicionar mais fotos' : 'Adicionar fotos'}
                variant="outline"
                icone="image"
                onPress={adicionarFotosDaPartida}
                loading={subindoFotos}
                style={{ alignSelf: 'flex-start', marginTop: 14 }}
              />
            </View>
          )}

          {/* Ação do visitante */}
          {!souCriador && !encerrada && (
            <View style={{ marginTop: 16 }}>
              {!meu || meu.status === 'recusado' ? (
                match.status === 'aberta' ? (
                  <Btn
                    label="Pedir pra entrar"
                    onPress={() => rpc('solicitar_entrada', 'entrar')}
                    loading={acao === 'entrar'}
                    full
                  />
                ) : (
                  <Text style={styles.lede}>Esta partida já está completa.</Text>
                )
              ) : meu.status === 'convidado' ? (
                <View style={styles.waitBox}>
                  <Text style={styles.waitTitle}>⏳ Solicitação enviada</Text>
                  <Text style={styles.waitText}>Aguardando {criador?.nome} confirmar você.</Text>
                  <Pressable onPress={() => rpc('sair_partida', 'sair')} disabled={acao === 'sair'}>
                    <Text style={styles.linkDanger}>{acao === 'sair' ? 'Cancelando…' : 'Cancelar solicitação'}</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.okBox}>
                  <Text style={styles.okTitle}>✓ Você está confirmado!</Text>
                  <Text style={styles.okText}>Combine os detalhes no chat abaixo.</Text>
                  <Pressable onPress={() => rpc('sair_partida', 'sair')} disabled={acao === 'sair'}>
                    <Text style={styles.linkDanger}>{acao === 'sair' ? 'Saindo…' : 'Sair da partida'}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* Painel do criador: solicitações pendentes */}
          {souCriador && !encerrada && (
            <View style={{ marginTop: 22 }}>
              <Text style={styles.section}>SOLICITAÇÕES {pendentes.length ? `(${pendentes.length})` : ''}</Text>
              {pendentes.length === 0 ? (
                <Text style={styles.lede}>Ninguém pediu pra entrar ainda. Compartilhe sua partida!</Text>
              ) : (
                <View style={{ gap: 12 }}>
                  {pendentes.map((p) => {
                    const cheia = vagasRestantes <= 0;
                    const tags = qualificacoes(p);
                    return (
                      <View key={p.user_id} style={styles.reqCard}>
                        <View style={styles.reqHead}>
                          <Avatar nome={p.nome} size={44} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.reqNome}>{p.nome}</Text>
                            <Text style={styles.reqElo}>ELO {p.elo}</Text>
                          </View>
                        </View>
                        {tags.length > 0 ? (
                          <View style={styles.tags}>
                            {tags.map((t) => (
                              <View key={t} style={styles.tag}>
                                <Text style={styles.tagText}>{t}</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.reqSemPerfil}>Ainda não preencheu o perfil de jogador.</Text>
                        )}
                        <View style={styles.reqActions}>
                          <Pressable
                            onPress={() => responder(p.user_id, false)}
                            disabled={!!acao}
                            style={({ hovered }: any) => [
                              styles.miniBtn,
                              styles.miniGhost,
                              { flex: 1 },
                              hovered && { opacity: 0.8 },
                            ]}>
                            <Text style={styles.miniGhostText}>Recusar</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => responder(p.user_id, true)}
                            disabled={!!acao || cheia}
                            style={({ hovered }: any) => [
                              styles.miniBtn,
                              styles.miniOk,
                              { flex: 1 },
                              cheia && { opacity: 0.4 },
                              hovered && !cheia && { opacity: 0.9 },
                            ]}>
                            <Text style={styles.miniOkText}>
                              {acao === `resp-${p.user_id}-true` ? '…' : cheia ? 'Sem vaga' : 'Confirmar'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Jogadores confirmados */}
          <View style={{ marginTop: 22 }}>
            <Text style={styles.section}>NA PARTIDA ({confirmados.length})</Text>
            <View style={{ gap: 8 }}>
              {confirmados.map((p) => {
                const tags = qualificacoes(p);
                return (
                  <View key={p.user_id} style={styles.playerRow}>
                    <View style={styles.reqHead}>
                      <Avatar nome={p.nome} size={38} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reqNome}>
                          {p.nome} {p.user_id === match.criador_id ? '· anfitrião' : ''}
                        </Text>
                        <Text style={styles.reqElo}>ELO {p.elo}</Text>
                      </View>
                      {p.user_id === me && <Pill label="você" tone="ball" />}
                    </View>
                    {tags.length > 0 && (
                      <View style={styles.tags}>
                        {tags.map((t) => (
                          <View key={t} style={styles.tag}>
                            <Text style={styles.tagText}>{t}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Chat */}
          {souParticipante && !encerrada && (
            <View style={{ marginTop: 26 }}>
              <CourtLine color={colors.net} style={{ marginBottom: 18 }} />
              <Text style={styles.section}>CHAT DA PARTIDA</Text>
              <View style={styles.chatBox}>
                {msgs.length === 0 ? (
                  <Text style={styles.chatEmpty}>Ainda sem mensagens. Manda o primeiro “bora!”.</Text>
                ) : (
                  msgs.map((msg) => {
                    const meu = msg.user_id === me;
                    const nome =
                      jogadores.find((j) => j.user_id === msg.user_id)?.nome ??
                      (msg.user_id === match.criador_id ? criador?.nome : 'Jogador');
                    return (
                      <View key={msg.id} style={[styles.bubbleWrap, meu && styles.bubbleWrapMe]}>
                        <View style={[styles.bubble, meu && styles.bubbleMe]}>
                          {!meu && <Text style={styles.bubbleAutor}>{nome}</Text>}
                          <Text style={[styles.bubbleText, meu && { color: colors.chalk }]}>{msg.texto}</Text>
                          <Text style={[styles.bubbleTime, meu && { color: colors.line }]}>{faz(msg.created_at)}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
              <View style={styles.chatInputRow}>
                <TextInput
                  value={texto}
                  onChangeText={setTexto}
                  placeholder="Escreva uma mensagem…"
                  placeholderTextColor={colors.inkSoft}
                  style={styles.chatInput}
                  onSubmitEditing={enviar}
                  returnKeyType="send"
                  maxLength={1000}
                />
                <Pressable
                  onPress={enviar}
                  disabled={!texto.trim()}
                  style={({ hovered }: any) => [
                    styles.sendBtn,
                    !texto.trim() && { opacity: 0.4 },
                    hovered && texto.trim() && { opacity: 0.9 },
                  ]}>
                  <Text style={styles.sendGlyph}>↑</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Cancelar (criador) */}
          {souCriador && !encerrada && (
            <Pressable onPress={() => rpc('cancelar_partida', 'cancelar')} disabled={acao === 'cancelar'}>
              <Text style={[styles.linkDanger, { textAlign: 'center', marginTop: 30 }]}>
                {acao === 'cancelar' ? 'Cancelando…' : 'Cancelar esta partida'}
              </Text>
            </Pressable>
          )}
          {encerrada && (
            <Text style={[styles.lede, { textAlign: 'center', marginTop: 24 }]}>
              {match.status === 'cancelada' ? 'Esta partida foi cancelada.' : 'Esta partida já foi jogada.'}
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function traduz(msg?: string): string {
  if (!msg) return 'Algo deu errado. Tente de novo.';
  return msg.replace(/^.*?:\s*/, '');
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.chalk },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { alignItems: 'center', padding: 22, paddingTop: 34, paddingBottom: 56 },
  container: { width: '100%' },
  lede: { color: colors.inkSoft, fontFamily: font.body, fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.net,
    padding: 22,
    marginTop: 8,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tipo: { fontFamily: font.mono, fontSize: 13, fontWeight: '700', color: colors.clay },
  local: { fontFamily: font.display, fontWeight: '800', fontSize: 24, color: colors.ink, marginTop: 14 },
  quando: { fontFamily: font.body, fontSize: 15, color: colors.inkSoft, marginTop: 4 },
  host: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  hostText: { fontFamily: font.body, fontSize: 14, color: colors.inkSoft },
  obs: { fontFamily: font.body, fontSize: 15, fontStyle: 'italic', color: colors.ink, marginTop: 16, lineHeight: 22 },
  vagasRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 18 },
  vagasNum: { fontFamily: font.display, fontWeight: '800', fontSize: 22, color: colors.clay },
  vagasLabel: { fontFamily: font.body, fontSize: 14, color: colors.inkSoft },
  erro: { color: colors.danger, fontFamily: font.body, fontSize: 14, marginTop: 14 },
  section: {
    fontFamily: font.mono,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  placarBox: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.net,
    padding: 16,
  },
  placarTitulo: { fontFamily: font.display, fontWeight: '600', fontSize: 17, color: colors.ink },
  placarTexto: { fontFamily: font.body, fontSize: 13.5, lineHeight: 20, color: colors.inkSoft, marginTop: 6 },
  placarOk: { fontFamily: font.body, fontWeight: '600', fontSize: 13.5, color: colors.ok, marginTop: 14 },
  waitBox: { backgroundColor: colors.court, borderRadius: radius.lg, padding: 18 },
  waitTitle: { fontFamily: font.display, fontWeight: '700', fontSize: 17, color: colors.ball },
  waitText: { fontFamily: font.body, fontSize: 14, color: colors.line, marginTop: 4 },
  okBox: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.ok,
    padding: 18,
  },
  okTitle: { fontFamily: font.display, fontWeight: '700', fontSize: 17, color: colors.ok },
  okText: { fontFamily: font.body, fontSize: 14, color: colors.inkSoft, marginTop: 4 },
  linkDanger: { fontFamily: font.body, fontWeight: '600', fontSize: 14, color: colors.danger, marginTop: 12 },
  reqCard: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.net,
    padding: 14,
    gap: 12,
  },
  reqHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reqNome: { fontFamily: font.body, fontWeight: '700', fontSize: 15, color: colors.ink },
  reqElo: { fontFamily: font.mono, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  reqSemPerfil: { fontFamily: font.body, fontSize: 13, fontStyle: 'italic', color: colors.inkSoft },
  reqActions: { flexDirection: 'row', gap: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: colors.chalk,
    borderWidth: 1,
    borderColor: colors.net,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: { fontFamily: font.body, fontWeight: '600', fontSize: 12.5, color: colors.ink },
  playerRow: {
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.net,
    padding: 12,
  },
  miniBtn: { paddingHorizontal: 14, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  miniOk: { backgroundColor: colors.ok },
  miniOkText: { fontFamily: font.body, fontWeight: '700', fontSize: 13, color: '#fff' },
  miniGhost: { borderWidth: 1.5, borderColor: colors.net },
  miniGhostText: { fontFamily: font.body, fontWeight: '600', fontSize: 13, color: colors.inkSoft },
  chatBox: {
    backgroundColor: colors.chalk,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.net,
    padding: 14,
    gap: 10,
    minHeight: 120,
  },
  chatEmpty: { fontFamily: font.body, fontSize: 14, color: colors.inkSoft, textAlign: 'center', paddingVertical: 24 },
  bubbleWrap: { alignItems: 'flex-start' },
  bubbleWrapMe: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.net,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMe: { backgroundColor: colors.clay, borderColor: colors.clay },
  bubbleAutor: { fontFamily: font.mono, fontSize: 11, fontWeight: '700', color: colors.clay, marginBottom: 3 },
  bubbleText: { fontFamily: font.body, fontSize: 15, color: colors.ink, lineHeight: 21 },
  bubbleTime: { fontFamily: font.mono, fontSize: 10, color: colors.inkSoft, marginTop: 4, alignSelf: 'flex-end' },
  chatInputRow: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' },
  chatInput: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.net,
    paddingHorizontal: 18,
    fontFamily: font.body,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: '#fff',
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.clay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendGlyph: { color: colors.chalk, fontSize: 22, fontWeight: '800', marginTop: -2 },
});
