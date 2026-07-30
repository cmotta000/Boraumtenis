import { Feather } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CourtLine, Secao } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, elev, font, maxW, radius, tabular } from '@/theme/tokens';

type IconName = React.ComponentProps<typeof Feather>['name'];
type Atalho = { rota: string; icone: IconName; titulo: string; desc: string; destaque?: boolean };

const ATALHOS: Atalho[] = [
  {
    rota: '/criar-partida',
    icone: 'plus-circle',
    titulo: 'Criar partida',
    desc: 'Abra um jogo no seu horário e escolha quem entra.',
    destaque: true,
  },
  { rota: '/partidas', icone: 'map-pin', titulo: 'Encontrar partidas', desc: 'Jogos abertos num raio de até 70 km.' },
  { rota: '/feed', icone: 'image', titulo: 'Feed', desc: 'Placares, fotos e histórias das quadras.' },
  { rota: '/ranking', icone: 'bar-chart-2', titulo: 'Ranking', desc: 'Sua posição na temporada por pontos.' },
];

export default function Inicio() {
  const { session } = useAuth();
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [stats, setStats] = useState({ pontos: 0, vitorias: 0, derrotas: 0 });
  const [incompleto, setIncompleto] = useState(false);

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    supabase
      .from('profiles')
      .select('nome, pontos, vitorias, derrotas, mao_dominante, idade, anos_jogando, golpe_preferido, cidade')
      .eq('id', uid)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setNome(data.nome);
        setStats({ pontos: data.pontos, vitorias: data.vitorias, derrotas: data.derrotas });
        // Perfil "completo" = tem as características principais preenchidas.
        setIncompleto(
          !data.mao_dominante ||
            data.idade == null ||
            data.anos_jogando == null ||
            !data.golpe_preferido ||
            !data.cidade,
        );
      });
  }, [session?.user.id]);

  const jogos = stats.vitorias + stats.derrotas;
  const aproveitamento = jogos > 0 ? `${Math.round((stats.vitorias / jogos) * 100)}%` : '—';
  const primeiroNome = (nome || 'tenista').split(' ')[0];

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.scroll}>
      <View style={[styles.container, { maxWidth: maxW }]}>
        <Text style={styles.hello}>Olá, {primeiroNome}</Text>
        <Text style={styles.sub}>Pronto pra marcar um jogo?</Text>

        <View style={styles.stats}>
          <Stat label="Pontos" valor={String(stats.pontos)} destaque />
          <Stat label="Vitórias" valor={String(stats.vitorias)} />
          <Stat label="Derrotas" valor={String(stats.derrotas)} />
          <Stat label="Aproveitamento" valor={aproveitamento} />
        </View>

        {incompleto && (
          <Link href="/editar-perfil" asChild>
            <Pressable
              style={({ hovered }: any) => [styles.aviso, hovered && { borderColor: colors.clay }]}>
              <Feather name="alert-circle" size={17} color={colors.clay} />
              <View style={{ flex: 1 }}>
                <Text style={styles.avisoTitulo}>Complete seu perfil de jogador</Text>
                <Text style={styles.avisoDesc}>
                  Mão dominante, nível e golpe preferido ajudam a te parear com gente do seu nível.
                </Text>
              </View>
              <Feather name="chevron-right" size={17} color={colors.inkSoft} />
            </Pressable>
          </Link>
        )}

        <CourtLine style={{ marginVertical: 26 }} />
        <Secao>Atalhos</Secao>

        <View style={styles.grid}>
          {ATALHOS.map((a) => (
            <Pressable
              key={a.rota}
              onPress={() => router.push(a.rota as never)}
              accessibilityRole="link"
              style={({ hovered }: any) => [
                styles.card,
                a.destaque && styles.cardDestaque,
                hovered && (a.destaque ? { opacity: 0.94 } : styles.cardHover),
              ]}>
              <Feather name={a.icone} size={19} color={a.destaque ? colors.ball : colors.clay} />
              <Text style={[styles.cardTitulo, a.destaque && { color: colors.courtText }]}>{a.titulo}</Text>
              <Text style={[styles.cardDesc, a.destaque && { color: colors.courtMute }]}>{a.desc}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function Stat({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <View style={[styles.stat, destaque && styles.statDestaque]}>
      <Text style={[styles.statLabel, destaque && { color: 'rgba(255,255,255,0.65)' }]}>{label}</Text>
      <Text style={[styles.statValor, destaque && { color: colors.card }]}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.chalk },
  scroll: { alignItems: 'center', paddingHorizontal: 22, paddingTop: 30, paddingBottom: 44 },
  container: { width: '100%' },
  hello: { fontFamily: font.display, fontWeight: '700', fontSize: 30, letterSpacing: -0.6, color: colors.ink },
  sub: { fontFamily: font.body, fontSize: 15, color: colors.inkSoft, marginTop: 4 },

  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 24 },
  stat: {
    flexGrow: 1,
    flexBasis: 130,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.net,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...elev.card,
  },
  statDestaque: { backgroundColor: colors.clay, borderColor: colors.clay },
  statLabel: {
    fontFamily: font.mono,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  statValor: {
    fontFamily: font.mono,
    fontWeight: '600',
    fontSize: 24,
    color: colors.ink,
    marginTop: 6,
    ...tabular,
  },

  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.net,
    backgroundColor: colors.clayWash,
  },
  avisoTitulo: { fontFamily: font.body, fontWeight: '600', fontSize: 14.5, color: colors.ink },
  avisoDesc: { fontFamily: font.body, fontSize: 13, lineHeight: 19, color: colors.inkSoft, marginTop: 2 },

  grid: { gap: 12, flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 210,
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.net,
    borderRadius: radius.md,
    padding: 18,
    ...elev.card,
  },
  cardDestaque: { backgroundColor: colors.court, borderColor: colors.court },
  cardHover: { borderColor: colors.inkSoft },
  cardTitulo: { fontFamily: font.display, fontWeight: '600', fontSize: 17, color: colors.ink },
  cardDesc: { fontFamily: font.body, fontSize: 13.5, lineHeight: 20, color: colors.inkSoft },
});
