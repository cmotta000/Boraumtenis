import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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

import { Avatar, Btn, CourtLine, ScreenHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { quando } from '@/lib/datas';
import type { MatchTipo, SetPlacar } from '@/lib/database.types';
import { escolherFotos, enviarFotos, MAX_FOTOS, type FotoLocal } from '@/lib/fotos';
import { supabase } from '@/lib/supabase';
import { colors, font, maxW, radius } from '@/theme/tokens';

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
  const { id } = useLocalSearchParams<{ id: string }>();
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

    const { data: mp } = await supabase
      .from('match_players')
      .select('user_id')
      .eq('match_id', id)
      .eq('status', 'confirmado');

    const ids = Array.from(new Set([m.criador_id, ...(mp ?? []).map((x) => x.user_id)]));
    const { data: profs } = await supabase.from('profiles').select('id, nome').in('id', ids);
    setJogadores((profs ?? []) as Jogador[]);
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

  async function publicar() {
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
      router.replace(`/partida/${id}` as never);
    } catch (e: any) {
      setErro(traduz(e?.message));
      setEnviando(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator color={colors.clay} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.container, { maxWidth: maxW }]}>
          <ScreenHeader title="Registrar placar" fallback={`/partida/${id}`} />

          {match && (
            <View style={styles.contexto}>
              <Text style={styles.contextoLocal}>{match.local_texto ?? 'Partida de tênis'}</Text>
              <Text style={styles.contextoQuando}>{quando(match.data_hora)}</Text>
            </View>
          )}

          <CourtLine color={colors.net} style={{ marginVertical: 22 }} />

          {/* 1 — quem venceu */}
          <Text style={styles.passo}>1 · QUEM VENCEU?</Text>
          <View style={{ gap: 10 }}>
            {jogadores.map((j) => {
              const ativo = vencedores.includes(j.id);
              return (
                <Pressable
                  key={j.id}
                  onPress={() => alternarVencedor(j.id)}
                  style={({ hovered }: any) => [
                    styles.jogador,
                    ativo && styles.jogadorAtivo,
                    hovered && !ativo && { borderColor: colors.clay },
                  ]}>
                  <Avatar nome={j.nome} size={38} />
                  <Text style={[styles.jogadorNome, ativo && { color: colors.chalk }]}>
                    {j.nome}
                    {j.id === me ? ' (você)' : ''}
                  </Text>
                  {ativo && <Feather name="check" size={18} color={colors.ball} />}
                </Pressable>
              );
            })}
          </View>
          {!simples && <Text style={styles.dica}>Duplas: marque os dois jogadores do lado vencedor.</Text>}

          {/* 2 — placar */}
          <Text style={[styles.passo, { marginTop: 28 }]}>2 · COMO FOI O PLACAR?</Text>
          <Text style={styles.dica}>Games de quem venceu à esquerda, de quem perdeu à direita.</Text>

          <View style={styles.sets}>
            {linhas.map((l, i) => (
              <View key={i} style={styles.setLinha}>
                <Text style={styles.setLabel}>{i + 1}º set</Text>
                <TextInput
                  value={l.v}
                  onChangeText={(t) => editarSet(i, 'v', t)}
                  placeholder="6"
                  placeholderTextColor={colors.inkSoft}
                  keyboardType="number-pad"
                  style={styles.setInput}
                />
                <Text style={styles.setX}>×</Text>
                <TextInput
                  value={l.p}
                  onChangeText={(t) => editarSet(i, 'p', t)}
                  placeholder="4"
                  placeholderTextColor={colors.inkSoft}
                  keyboardType="number-pad"
                  style={styles.setInput}
                />
                {i === 2 && (
                  <Pressable onPress={() => setLinhas((prev) => prev.slice(0, 2))}>
                    <Text style={styles.remover}>remover</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>

          {linhas.length < 3 && (
            <Pressable
              onPress={() => setLinhas((prev) => [...prev, { v: '', p: '' }])}
              style={({ hovered }: any) => [styles.addSet, hovered && { opacity: 0.75 }]}>
              <Text style={styles.addSetText}>+ Teve 3º set</Text>
            </Pressable>
          )}

          {/* Prévia da pontuação */}
          <View style={[styles.pontos, pontos === null && styles.pontosVazio]}>
            {pontos === null ? (
              <Text style={styles.pontosTextoVazio}>
                {setsPreenchidos.length < 2
                  ? 'Preencha os sets para ver quantos pontos a vitória vale.'
                  : 'Placar incoerente: quem venceu precisa ter ganho 2 sets.'}
              </Text>
            ) : (
              <>
                <Text style={styles.pontosPlacar}>
                  {setsV} × {setsP}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pontosValor}>+{pontos} pontos</Text>
                  <Text style={styles.pontosNota}>para quem venceu · derrota não pontua</Text>
                </View>
              </>
            )}
          </View>

          {/* 3 — post */}
          <Text style={[styles.passo, { marginTop: 28 }]}>3 · CONTE COMO FOI (opcional)</Text>
          <TextInput
            value={legenda}
            onChangeText={setLegenda}
            placeholder="Vento forte, virada no 3º set, quadra nova…"
            placeholderTextColor={colors.inkSoft}
            multiline
            maxLength={500}
            style={styles.legenda}
          />

          <View style={styles.fotosGrid}>
            {fotos.map((f, i) => (
              <View key={f.uri + i} style={styles.fotoBox}>
                <Image source={{ uri: f.uri }} style={styles.foto} contentFit="cover" />
                <Pressable
                  onPress={() => setFotos((prev) => prev.filter((_, idx) => idx !== i))}
                  style={styles.fotoRemover}>
                  <Text style={styles.fotoRemoverText}>×</Text>
                </Pressable>
              </View>
            ))}
            {fotos.length < MAX_FOTOS && (
              <Pressable
                onPress={adicionarFotos}
                style={({ hovered }: any) => [styles.fotoAdd, hovered && { borderColor: colors.clay }]}>
                <Feather name="image" size={18} color={colors.inkSoft} />
                <Text style={styles.fotoAddText}>Adicionar</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.dica}>
            As fotos entram no feed junto com o resultado. Até {MAX_FOTOS} por partida.
          </Text>

          {erro && <Text style={styles.erro}>{erro}</Text>}

          <Btn
            label={enviando ? 'Publicando…' : 'Publicar resultado'}
            onPress={publicar}
            loading={enviando}
            full
            style={{ marginTop: 24 }}
          />
          <Text style={styles.rodape}>
            O outro jogador precisa confirmar o placar antes dos pontos entrarem no ranking.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function traduz(msg?: string): string {
  if (!msg) return 'Não foi possível registrar o placar. Tente de novo.';
  return msg.replace(/^.*?:\s*/, '');
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.chalk },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { alignItems: 'center', padding: 22, paddingTop: 34, paddingBottom: 56 },
  container: { width: '100%' },
  contexto: { marginTop: 14 },
  contextoLocal: { fontFamily: font.display, fontWeight: '800', fontSize: 22, color: colors.ink },
  contextoQuando: { fontFamily: font.body, fontSize: 14, color: colors.inkSoft, marginTop: 3 },
  passo: {
    fontFamily: font.mono,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.clay,
    fontWeight: '700',
    marginBottom: 12,
  },
  dica: { fontFamily: font.body, fontSize: 13.5, color: colors.inkSoft, marginTop: 8, lineHeight: 19 },
  jogador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.net,
    padding: 12,
  },
  jogadorAtivo: { backgroundColor: colors.clay, borderColor: colors.clay },
  jogadorNome: { flex: 1, fontFamily: font.body, fontWeight: '700', fontSize: 16, color: colors.ink },
  jogadorMarca: { fontSize: 18 },
  sets: { gap: 10, marginTop: 14 },
  setLinha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  setLabel: { width: 64, fontFamily: font.mono, fontSize: 12, color: colors.inkSoft },
  setInput: {
    width: 62,
    height: 52,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.net,
    backgroundColor: '#fff',
    textAlign: 'center',
    fontFamily: font.mono,
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  setX: { fontFamily: font.body, fontSize: 16, color: colors.inkSoft },
  remover: { fontFamily: font.body, fontSize: 13, color: colors.danger, marginLeft: 6 },
  addSet: { alignSelf: 'flex-start', marginTop: 12 },
  addSetText: { fontFamily: font.body, fontWeight: '700', fontSize: 14, color: colors.clay },
  pontos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 20,
    backgroundColor: colors.court,
    borderRadius: radius.lg,
    padding: 18,
  },
  pontosVazio: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.net },
  pontosTextoVazio: { fontFamily: font.body, fontSize: 14, color: colors.inkSoft, lineHeight: 20 },
  pontosPlacar: { fontFamily: font.display, fontWeight: '800', fontSize: 30, color: colors.ball },
  pontosValor: { fontFamily: font.display, fontWeight: '800', fontSize: 20, color: colors.chalk },
  pontosNota: { fontFamily: font.body, fontSize: 12.5, color: colors.line, marginTop: 2 },
  legenda: {
    minHeight: 92,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.net,
    backgroundColor: '#fff',
    padding: 14,
    fontFamily: font.body,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  fotosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  fotoBox: { width: 96, height: 96, borderRadius: radius.sm, overflow: 'hidden' },
  foto: { width: '100%', height: '100%' },
  fotoRemover: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoRemoverText: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: -2 },
  fotoAdd: {
    width: 96,
    height: 96,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.net,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  fotoAddIcon: { fontSize: 22 },
  fotoAddText: { fontFamily: font.body, fontSize: 12, color: colors.inkSoft, marginTop: 4 },
  erro: { color: colors.danger, fontFamily: font.body, fontSize: 14, marginTop: 18 },
  rodape: {
    fontFamily: font.body,
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 19,
  },
});
