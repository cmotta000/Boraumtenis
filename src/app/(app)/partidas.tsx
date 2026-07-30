import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Btn, CourtLine, Pill } from '@/components/ui';
import { quando } from '@/lib/datas';
import type { MatchTipo, PlayerStatus } from '@/lib/database.types';
import { origemDeBusca, type Origem } from '@/lib/location';
import { supabase } from '@/lib/supabase';
import { colors, elev, font, maxW, radius, tabular } from '@/theme/tokens';

type Partida = {
  id: string;
  criador_nome: string;
  local_texto: string | null;
  data_hora: string;
  tipo: MatchTipo;
  vagas_total: number;
  confirmados: number;
  distancia_m: number;
  meu_status: 'criador' | PlayerStatus | null;
};

const RAIOS = [10, 25, 50, 70];

/** Etiqueta do meu vínculo com a partida — só quando já existe algum. */
function meuVinculo(s: Partida['meu_status']): { label: string; tone: 'clay' | 'ok' | 'ball' } | null {
  switch (s) {
    case 'criador':
      return { label: 'sua partida', tone: 'clay' };
    case 'confirmado':
      return { label: 'você está dentro', tone: 'ok' };
    case 'convidado':
      return { label: 'aguardando', tone: 'ball' };
    default:
      return null;
  }
}

export default function Partidas() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [origem, setOrigem] = useState<Origem | null>(null);
  const [raio, setRaio] = useState(70);
  const [soComVaga, setSoComVaga] = useState(false);
  const [itens, setItens] = useState<Partida[]>([]);

  const carregar = useCallback(
    async (pedirGps = false) => {
      const o = await origemDeBusca(pedirGps);
      setOrigem(o);
      const { data } = await supabase.rpc('partidas_proximas', {
        lat: o.lat,
        lng: o.lng,
        raio_m: raio * 1000,
        apenas_com_vaga: soComVaga,
      });
      setItens((data as Partida[]) ?? []);
      setLoading(false);
    },
    [raio, soComVaga],
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function onRefresh() {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.clay} />}>
      <View style={[styles.container, { maxWidth: maxW }]}>
        <Text style={styles.title}>Partidas por perto</Text>
        <View style={styles.localLinha}>
          <Feather name="map-pin" size={13} color={colors.inkSoft} />
          <Text style={styles.subtitle}>{origem?.rotulo ?? 'localizando…'}</Text>
        </View>

        {origem && origem.fonte !== 'gps' && (
          <Pressable
            onPress={() => carregar(true)}
            style={({ hovered }: any) => [styles.gpsLink, hovered && { opacity: 0.75 }]}>
            <Text style={styles.gpsLinkText}>Usar minha localização exata →</Text>
          </Pressable>
        )}

        <Btn
          label="Criar partida"
          icone="plus"
          onPress={() => router.push('/criar-partida' as never)}
          style={{ alignSelf: 'flex-start', marginTop: 18 }}
        />

        <CourtLine style={{ marginVertical: 20 }} />

        {/* Filtros */}
        <View style={styles.filtros}>
          <Text style={styles.filtroLabel}>RAIO</Text>
          <View style={styles.filtroChips}>
            {RAIOS.map((r) => {
              const ativo = r === raio;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRaio(r)}
                  style={({ hovered }: any) => [
                    styles.filtroChip,
                    ativo && styles.filtroChipAtivo,
                    hovered && !ativo && { borderColor: colors.clay },
                  ]}>
                  <Text style={[styles.filtroChipText, ativo && styles.filtroChipTextAtivo]}>{r} km</Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setSoComVaga((v) => !v)}
              style={({ hovered }: any) => [
                styles.filtroChip,
                soComVaga && styles.filtroChipAtivo,
                hovered && !soComVaga && { borderColor: colors.clay },
              ]}>
              <Text style={[styles.filtroChipText, soComVaga && styles.filtroChipTextAtivo]}>só com vaga</Text>
            </Pressable>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.clay} style={{ marginTop: 40 }} />
        ) : itens.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="search" size={22} color={colors.inkSoft} />
            <Text style={styles.emptyTitle}>Nenhuma partida aberta em {raio} km</Text>
            <Text style={styles.emptyText}>
              {raio < 70
                ? 'Aumente o raio da busca ou crie a sua — a galera aparece.'
                : 'Seja o primeiro da sua região: crie uma partida e deixe a galera pedir pra entrar.'}
            </Text>
            <Btn
              label="Criar a primeira partida"
              onPress={() => router.push('/criar-partida' as never)}
              style={{ marginTop: 18 }}
            />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {itens.map((p) => {
              const restantes = Math.max(0, p.vagas_total - p.confirmados);
              const vinculo = meuVinculo(p.meu_status);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/partida/${p.id}` as never)}
                  style={({ hovered, pressed }: any) => [styles.card, (hovered || pressed) && styles.cardHover]}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardPlace} numberOfLines={1}>
                      {p.local_texto ?? 'Partida de tênis'}
                    </Text>
                    <Text style={styles.cardDist}>{(p.distancia_m / 1000).toFixed(1)} km</Text>
                  </View>
                  <Text style={styles.cardWhen}>
                    {quando(p.data_hora)} · {p.tipo === 'duplas' ? 'duplas' : 'simples'}
                  </Text>
                  <Text style={styles.cardHost}>Anfitrião: {p.criador_nome}</Text>
                  <View style={styles.cardFoot}>
                    <View style={styles.cardPills}>
                      {restantes > 0 ? (
                        <Pill label={`${restantes} vaga${restantes > 1 ? 's' : ''}`} tone="ok" />
                      ) : (
                        <Pill label="completa" tone="muted" />
                      )}
                      {vinculo && <Pill label={vinculo.label} tone={vinculo.tone} />}
                    </View>
                    <Text style={styles.cardGo}>Ver partida →</Text>
                  </View>
                </Pressable>
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
  scroll: { alignItems: 'center', paddingHorizontal: 22, paddingTop: 30, paddingBottom: 44 },
  container: { width: '100%' },
  title: { fontFamily: font.display, fontWeight: '700', fontSize: 28, letterSpacing: -0.6, color: colors.ink },
  localLinha: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  subtitle: { fontFamily: font.mono, fontSize: 12, color: colors.inkSoft },
  gpsLink: { alignSelf: 'flex-start', marginTop: 8 },
  gpsLinkText: { fontFamily: font.body, fontWeight: '600', fontSize: 13, color: colors.clay },
  filtros: { marginBottom: 18 },
  filtroLabel: {
    fontFamily: font.mono,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: colors.inkSoft,
    marginBottom: 10,
  },
  filtroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filtroChip: {
    paddingHorizontal: 13,
    height: 34,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.net,
    backgroundColor: colors.card,
  },
  filtroChipAtivo: { backgroundColor: colors.court, borderColor: colors.court },
  filtroChipText: { fontFamily: font.body, fontWeight: '500', fontSize: 13, color: colors.ink },
  filtroChipTextAtivo: { color: colors.courtText, fontWeight: '600' },
  empty: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.net,
  },
  emptyTitle: {
    fontFamily: font.display,
    fontWeight: '600',
    fontSize: 18,
    color: colors.ink,
    marginTop: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: font.body,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 420,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.net,
    padding: 16,
    ...elev.card,
  },
  cardHover: { borderColor: colors.clay },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  cardPlace: { flex: 1, fontFamily: font.display, fontWeight: '600', fontSize: 16.5, color: colors.ink },
  cardDist: { fontFamily: font.mono, fontSize: 13, fontWeight: '500', color: colors.clay, ...tabular },
  cardWhen: { fontFamily: font.body, fontSize: 13.5, color: colors.inkSoft, marginTop: 4 },
  cardHost: { fontFamily: font.body, fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 10 },
  cardPills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 },
  cardGo: { fontFamily: font.body, fontWeight: '600', fontSize: 13, color: colors.clay },
});
