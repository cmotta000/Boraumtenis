import { Feather } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GradeFotos } from '@/components/galeria';
import { Avatar, Btn, CourtLine, Secao } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { GolpePreferido, MaoDominante } from '@/lib/database.types';
import { escolherFotoDePerfil, trocarFotoDePerfil } from '@/lib/fotos';
import { carregarFeed } from '@/lib/posts';
import { supabase } from '@/lib/supabase';
import { colors, elev, font, maxW, radius, tabular } from '@/theme/tokens';

type Perfil = {
  nome: string;
  avatar_url: string | null;
  cidade: string | null;
  uf: string | null;
  pontos: number;
  vitorias: number;
  derrotas: number;
  mao_dominante: MaoDominante | null;
  idade: number | null;
  altura_cm: number | null;
  anos_jogando: number | null;
  golpe_preferido: GolpePreferido | null;
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

/** Quantas fotos do jogador mostramos na galeria do perfil. */
const FOTOS_NA_GALERIA = 12;

export default function PerfilScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const uid = session?.user.id;

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [fotos, setFotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saindo, setSaindo] = useState(false);
  const [trocandoFoto, setTrocandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase
      .from('profiles')
      .select(
        'nome, avatar_url, cidade, uf, pontos, vitorias, derrotas, mao_dominante, idade, altura_cm, anos_jogando, golpe_preferido',
      )
      .eq('id', uid)
      .single();
    setPerfil(data as Perfil);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Galeria: as fotos dos posts do jogador, das mais novas para as mais antigas.
  useEffect(() => {
    if (!uid) return;
    carregarFeed({ userId: uid, limite: 20 })
      .then((posts) => setFotos(posts.flatMap((p) => p.fotos).slice(0, FOTOS_NA_GALERIA)))
      .catch(() => setFotos([]));
  }, [uid]);

  async function trocarFoto() {
    if (!uid) return;
    setErroFoto(null);
    try {
      const foto = await escolherFotoDePerfil();
      if (!foto) return;
      setTrocandoFoto(true);
      const caminho = await trocarFotoDePerfil(uid, foto, perfil?.avatar_url ?? null);
      setPerfil((p) => (p ? { ...p, avatar_url: caminho } : p));
    } catch (e: any) {
      setErroFoto(e?.message ?? 'Não foi possível trocar a foto.');
    } finally {
      setTrocandoFoto(false);
    }
  }

  async function sair() {
    setSaindo(true);
    await supabase.auth.signOut();
    router.replace('/');
  }

  const detalhes = perfil
    ? [
        { label: 'Mão dominante', value: perfil.mao_dominante ? MAO_LABEL[perfil.mao_dominante] : null },
        { label: 'Idade', value: perfil.idade != null ? `${perfil.idade} anos` : null },
        { label: 'Altura', value: perfil.altura_cm != null ? `${perfil.altura_cm} cm` : null },
        { label: 'Golpe preferido', value: perfil.golpe_preferido ? GOLPE_LABEL[perfil.golpe_preferido] : null },
      ]
    : [];

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.scroll}>
      <View style={[styles.container, { maxWidth: maxW }]}>
        {loading ? (
          <ActivityIndicator color={colors.clay} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.head}>
              <Pressable
                onPress={trocarFoto}
                disabled={trocandoFoto}
                accessibilityLabel="Trocar foto de perfil"
                style={({ hovered }: any) => [styles.avatarBox, hovered && { opacity: 0.9 }]}>
                <Avatar nome={perfil?.nome} foto={perfil?.avatar_url} size={78} />
                <View style={styles.camera}>
                  {trocandoFoto ? (
                    <ActivityIndicator color={colors.card} size="small" />
                  ) : (
                    <Feather name="camera" size={13} color={colors.card} />
                  )}
                </View>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{perfil?.nome}</Text>
                <Text style={styles.email}>{session?.user.email}</Text>
                <Pressable onPress={trocarFoto} disabled={trocandoFoto}>
                  <Text style={styles.trocarFoto}>
                    {perfil?.avatar_url ? 'Trocar foto de perfil' : 'Adicionar foto de perfil'}
                  </Text>
                </Pressable>
              </View>
            </View>
            {erroFoto && <Text style={styles.erro}>{erroFoto}</Text>}

            <View style={styles.stats}>
              <Stat label="Pontos" value={String(perfil?.pontos ?? 0)} destaque />
              <Stat label="Vitórias" value={String(perfil?.vitorias ?? 0)} />
              <Stat label="Derrotas" value={String(perfil?.derrotas ?? 0)} />
            </View>
            <View style={[styles.stats, { marginTop: 12 }]}>
              <Stat
                label="Experiência"
                value={
                  perfil?.anos_jogando != null
                    ? `${perfil.anos_jogando} ${perfil.anos_jogando === 1 ? 'ano' : 'anos'}`
                    : 'a definir'
                }
              />
              <Stat
                label="Cidade"
                value={perfil?.cidade ? `${perfil.cidade}${perfil.uf ? '/' + perfil.uf : ''}` : 'a definir'}
              />
            </View>

            <CourtLine style={{ marginVertical: 24 }} />

            <Secao>Características</Secao>
            <View style={styles.detailCard}>
              {detalhes.map((d, i) => (
                <View key={d.label} style={[styles.detailRow, i > 0 && styles.detailDivider]}>
                  <Text style={styles.detailLabel}>{d.label}</Text>
                  <Text style={[styles.detailValue, !d.value && styles.detailEmpty]}>
                    {d.value ?? 'a definir'}
                  </Text>
                </View>
              ))}
            </View>

            <CourtLine style={{ marginVertical: 24 }} />

            <View style={styles.galeriaHead}>
              <Secao style={{ marginBottom: 0 }}>Suas fotos</Secao>
              <Link href="/feed" style={styles.verFeed}>
                Ver no feed
              </Link>
            </View>
            {fotos.length > 0 ? (
              <GradeFotos fotos={fotos} />
            ) : (
              <Text style={styles.semFotos}>
                Você ainda não publicou fotos. Depois do próximo jogo, publique os melhores momentos no feed.
              </Text>
            )}

            <View style={styles.acoes}>
              <Link href="/editar-perfil" asChild>
                <Btn label="Editar perfil" icone="edit-2" />
              </Link>
              <Btn
                label={saindo ? 'Saindo…' : 'Sair da conta'}
                variant="outline"
                icone="log-out"
                onPress={sair}
                loading={saindo}
              />
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

/** Números ganham a fonte mono (tabular); texto fica na fonte de leitura. */
const ehNumero = (v: string) => /^[\d.,%+\-–—\s]+$/.test(v);

function Stat({ label, value, destaque }: { label: string; value: string; destaque?: boolean }) {
  return (
    <View style={[styles.stat, destaque && styles.statDestaque]}>
      <Text style={[styles.statLabel, destaque && { color: colors.line }]}>{label}</Text>
      <Text
        style={[
          styles.statValue,
          !ehNumero(value) && styles.statValueTexto,
          destaque && { color: colors.card },
        ]}
        numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.chalk },
  scroll: { alignItems: 'center', paddingHorizontal: 22, paddingTop: 30, paddingBottom: 48 },
  container: { width: '100%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarBox: { width: 78, height: 78 },
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.clay,
    borderWidth: 2,
    borderColor: colors.chalk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nome: { fontFamily: font.display, fontWeight: '700', fontSize: 26, letterSpacing: -0.5, color: colors.ink },
  email: { fontFamily: font.body, fontSize: 13.5, color: colors.inkSoft, marginTop: 2 },
  trocarFoto: { fontFamily: font.body, fontWeight: '600', fontSize: 13, color: colors.clay, marginTop: 6 },
  erro: { fontFamily: font.body, fontSize: 13.5, color: colors.danger, marginTop: 10 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 24 },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.net,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...elev.card,
  },
  statDestaque: { backgroundColor: colors.clay, borderColor: colors.clay },
  statLabel: {
    fontFamily: font.mono,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: colors.inkSoft,
    textTransform: 'uppercase',
  },
  statValue: { fontFamily: font.mono, fontWeight: '600', fontSize: 22, color: colors.ink, marginTop: 6, ...tabular },
  statValueTexto: { fontFamily: font.display, fontWeight: '600', fontSize: 18 },
  detailCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.net,
    paddingHorizontal: 16,
    ...elev.card,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13 },
  detailDivider: { borderTopWidth: 1, borderTopColor: colors.net },
  detailLabel: { fontFamily: font.body, fontSize: 14, color: colors.inkSoft },
  detailValue: { fontFamily: font.body, fontWeight: '600', fontSize: 14, color: colors.ink },
  detailEmpty: { color: colors.inkSoft, fontWeight: '400' },
  galeriaHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  verFeed: { fontFamily: font.body, fontWeight: '600', fontSize: 13, color: colors.clay },
  semFotos: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: colors.inkSoft },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 26 },
});
