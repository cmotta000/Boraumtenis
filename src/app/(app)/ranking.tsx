import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CourtLine, Segmented } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, elev, font, maxW, radius, tabular } from '@/theme/tokens';

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
      const { data } = await supabase
        .from('profiles')
        .select('id, nome, cidade, uf, pontos, vitorias, derrotas')
        .order('pontos', { ascending: false })
        .order('vitorias', { ascending: false })
        .limit(50);
      setLinhas(
        ((data ?? []) as any[]).map((p) => ({
          user_id: p.id,
          nome: p.nome,
          cidade: p.cidade,
          uf: p.uf,
          pontos: p.pontos,
          vitorias: p.vitorias,
          derrotas: p.derrotas,
        })),
      );
    }
    setLoading(false);
  }, [aba]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const comPontos = linhas.filter((l) => l.pontos > 0 || l.vitorias > 0 || l.derrotas > 0);

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.scroll}>
      <View style={[styles.container, { maxWidth: maxW }]}>
        <View style={styles.cabecalho}>
          <Text style={styles.subtitle}>
            {aba === 'temporada' ? (temporada ?? 'Temporada em aberto') : 'Pontos acumulados de todas as temporadas'}
          </Text>
          <View style={styles.abas}>
            <Segmented options={ABAS} value={aba} onChange={setAba} />
          </View>
        </View>

        <View style={styles.regra}>
          <Text style={styles.regraText}>
            <Text style={styles.regraForte}>50 pts</Text> por vitória de 2 sets a 0 ·{' '}
            <Text style={styles.regraForte}>35 pts</Text> por 2 a 1 · derrota não pontua
          </Text>
        </View>

        <CourtLine style={{ marginVertical: 20 }} />

        {loading ? (
          <ActivityIndicator color={colors.clay} style={{ marginTop: 40 }} />
        ) : comPontos.length === 0 ? (
          <Text style={styles.empty}>
            Ninguém pontuou ainda. Jogue uma partida e registre o placar — o ranking começa aí.
          </Text>
        ) : (
          <View style={styles.table}>
            <View style={[styles.row, styles.rowHead]}>
              <Text style={[styles.pos, styles.headText]}>#</Text>
              <Text style={[styles.nome, styles.headText]}>Jogador</Text>
              <Text style={[styles.vd, styles.headText]}>V–D</Text>
              <Text style={[styles.pts, styles.headText]}>PTS</Text>
            </View>
            {comPontos.map((l, i) => {
              const eu = l.user_id === session?.user.id;
              return (
                <View key={l.user_id} style={[styles.row, eu && styles.rowEu]}>
                  <Text style={[styles.pos, i < 3 && styles.posTop]}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.nome, eu && { color: colors.clay, fontWeight: '700' }]}>
                      {l.nome} {eu ? '(você)' : ''}
                    </Text>
                    {l.cidade ? (
                      <Text style={styles.cidade}>
                        {l.cidade}
                        {l.uf ? `/${l.uf}` : ''}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.vd}>
                    {l.vitorias}–{l.derrotas}
                  </Text>
                  <Text style={styles.pts}>{l.pontos}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.chalk },
  scroll: { alignItems: 'center', paddingHorizontal: 22, paddingTop: 30, paddingBottom: 48 },
  container: { width: '100%' },
  cabecalho: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 },
  subtitle: { flex: 1, fontFamily: font.mono, fontSize: 12, color: colors.inkSoft, minWidth: 200 },
  abas: { width: 260 },
  regra: {
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.net,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  regraText: { fontFamily: font.body, fontSize: 13, lineHeight: 19, color: colors.inkSoft },
  regraForte: { fontWeight: '600', color: colors.clay },
  empty: { fontFamily: font.body, fontSize: 14.5, lineHeight: 21, color: colors.inkSoft, marginTop: 20 },
  table: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.net,
    overflow: 'hidden',
    ...elev.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.chalk,
  },
  rowHead: { backgroundColor: colors.chalk, paddingVertical: 9 },
  headText: { fontFamily: font.mono, fontSize: 10, letterSpacing: 1, color: colors.inkSoft },
  rowEu: { backgroundColor: 'rgba(180,71,42,0.06)' },
  pos: { width: 26, fontFamily: font.mono, fontSize: 14, fontWeight: '600', color: colors.inkSoft, ...tabular },
  posTop: { color: colors.clay },
  nome: { flex: 1, fontFamily: font.body, fontSize: 15, color: colors.ink },
  cidade: { fontFamily: font.body, fontSize: 12.5, color: colors.inkSoft, marginTop: 1 },
  vd: { width: 52, textAlign: 'right', fontFamily: font.mono, fontSize: 12.5, color: colors.inkSoft, ...tabular },
  pts: {
    width: 44,
    textAlign: 'right',
    fontFamily: font.mono,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
    ...tabular,
  },
});
