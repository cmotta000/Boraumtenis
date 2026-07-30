import { Link, Redirect } from 'expo-router';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Btn, CourtLine, Wordmark } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors, elev, font, maxW, radius } from '@/theme/tokens';

const SCORE = [
  { k: '70', u: 'km de raio' },
  { k: 'ELO', u: 'ranking real' },
  { k: 'R$0', u: 'pra jogar' },
];

const FEATURES = [
  { t: 'Partidas por perto', d: 'Veja jogos abertos num raio de 70 km e entre com um toque.' },
  { t: 'Ranking que vale', d: 'Cada resultado mexe no seu ELO. Suba de nível jogando.' },
  { t: 'Temporadas', d: 'Dispute o pódio da sua região e colecione conquistas.' },
];

const STEPS = [
  { n: '1', t: 'Crie ou encontre', d: 'Abra uma partida no seu horário ou entre numa que já está de pé perto de você.' },
  { n: '2', t: 'Combine', d: 'Peça pra entrar, o criador confirma e vocês acertam os detalhes no chat da partida.' },
  { n: '3', t: 'Jogue e suba', d: 'Registrem o placar e o ELO faz o resto: você sobe no ranking da sua região.' },
];

export default function Landing() {
  const { session, loading } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= 860;

  if (loading) {
    return (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator color={colors.chalk} />
      </View>
    );
  }
  if (session) return <Redirect href="/inicio" />;

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.scroll}>
      <View style={[styles.container, { maxWidth: maxW }]}>
        {/* Topo */}
        <View style={styles.topbar}>
          <Wordmark tone="light" />
          <Link href="/entrar" style={styles.topLink}>
            Entrar
          </Link>
        </View>

        {/* Hero */}
        <View style={[styles.hero, wide && styles.heroWide]}>
          <View style={[styles.heroText, wide && { flex: 1.1 }]}>
            <Text style={styles.eyebrow}>TÊNIS AMADOR · ENCONTRE SEU JOGO</Text>
            <Text style={[styles.h1, { fontSize: wide ? 68 : 46, lineHeight: wide ? 66 : 46 }]}>
              Ache com quem{'\n'}jogar pertinho.
            </Text>
            <CourtLine style={{ width: 120, marginVertical: 18 }} />
            <Text style={styles.lede}>
              O ponto de encontro dos tenistas amadores. Marque partidas com gente do seu nível a até
              70 km de você, registre o placar e suba no ranking.
            </Text>
            <View style={styles.ctaRow}>
              <Link href="/entrar" asChild>
                <Btn label="Criar conta grátis" variant="ball" />
              </Link>
              <Link href="/entrar" asChild>
                <Btn label="Já tenho conta" variant="ghost" />
              </Link>
            </View>

            {/* Placar / scoreboard */}
            <View style={styles.score}>
              {SCORE.map((s, i) => (
                <View key={s.u} style={styles.scoreItem}>
                  {i > 0 && <View style={styles.scoreDiv} />}
                  <Text style={styles.scoreK}>{s.k}</Text>
                  <Text style={styles.scoreU}>{s.u}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Card de partida aberta — o objeto característico */}
          <View style={[styles.matchCard, wide && { flex: 0.9 }]}>
            <View style={styles.matchTop}>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.livePillText}>PARTIDA ABERTA</Text>
              </View>
              <Text style={styles.matchDist}>3,2 km</Text>
            </View>
            <Text style={styles.matchPlace}>Quadra de Saibro · Vila Madalena</Text>
            <Text style={styles.matchWhen}>hoje, 19:00 · simples</Text>
            <CourtLine color={colors.net} style={{ marginVertical: 16 }} />
            <View style={styles.matchRow}>
              <View>
                <Text style={styles.playerName}>Rafael</Text>
                <Text style={styles.playerElo}>ELO 1240</Text>
              </View>
              <Text style={styles.vs}>VS</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.playerName}>vaga aberta</Text>
                <Text style={[styles.playerElo, { color: colors.clay }]}>seu nível?</Text>
              </View>
            </View>
            <View style={styles.matchCta}>
              <Text style={styles.matchCtaText}>Entrar na partida</Text>
            </View>
          </View>
        </View>

        {/* Como funciona */}
        <View style={styles.howHead}>
          <Text style={styles.sectionEyebrow}>COMO FUNCIONA</Text>
          <Text style={styles.sectionTitle}>Do sofá pra quadra em 3 passos</Text>
        </View>
        <View style={[styles.steps, wide && { flexDirection: 'row' }]}>
          {STEPS.map((s, i) => (
            <View key={s.n} style={[styles.step, wide && { flex: 1 }]}>
              <View style={styles.stepNumWrap}>
                <Text style={styles.stepNum}>{s.n}</Text>
                {i < STEPS.length - 1 && <View style={styles.stepBar} />}
              </View>
              <Text style={styles.stepT}>{s.t}</Text>
              <Text style={styles.stepD}>{s.d}</Text>
            </View>
          ))}
        </View>

        {/* Features */}
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.t} style={[styles.feature, wide && { flex: 1 }]}>
              <Text style={styles.featureT}>{f.t}</Text>
              <Text style={styles.featureD}>{f.d}</Text>
            </View>
          ))}
        </View>

        {/* Faixa de CTA final */}
        <View style={[styles.ctaBand, wide && styles.ctaBandWide]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaBandTitle}>Sua próxima partida começa agora.</Text>
            <Text style={styles.ctaBandText}>
              Crie sua conta grátis e veja quem está jogando perto de você.
            </Text>
          </View>
          <Link href="/entrar" asChild>
            <Btn label="Começar a jogar" variant="ball" />
          </Link>
        </View>

        <Text style={styles.foot}>Feito para quem quer jogar mais.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.clay },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { alignItems: 'center', paddingBottom: 48 },
  container: { width: '100%', paddingHorizontal: 22 },
  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 22,
  },
  topLink: { color: colors.chalk, fontFamily: font.body, fontWeight: '600', fontSize: 15 },
  hero: { paddingTop: 24, gap: 32 },
  heroWide: { flexDirection: 'row', alignItems: 'center', gap: 48, paddingTop: 40 },
  heroText: {},
  eyebrow: {
    color: colors.ball,
    fontFamily: font.mono,
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 18,
  },
  h1: { color: colors.chalk, fontFamily: font.display, fontWeight: '800', letterSpacing: -1 },
  lede: { color: colors.line, fontFamily: font.body, fontSize: 17, lineHeight: 26, maxWidth: 460 },
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 26 },
  score: { flexDirection: 'row', marginTop: 34 },
  scoreItem: { flexDirection: 'row', alignItems: 'center' },
  scoreDiv: { width: 1, height: 34, backgroundColor: colors.line, opacity: 0.4, marginHorizontal: 18 },
  scoreK: { color: colors.chalk, fontFamily: font.mono, fontSize: 26, fontWeight: '700' },
  scoreU: { color: colors.line, fontFamily: font.body, fontSize: 13, marginLeft: 8, maxWidth: 70 },
  // match card
  matchCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 22,
    ...elev.raised,
  },
  matchTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.clay,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.ball },
  livePillText: { color: colors.chalk, fontFamily: font.mono, fontSize: 10, letterSpacing: 1 },
  matchDist: { color: colors.inkSoft, fontFamily: font.mono, fontSize: 14, fontWeight: '700' },
  matchPlace: { color: colors.ink, fontFamily: font.display, fontWeight: '700', fontSize: 21, marginTop: 14 },
  matchWhen: { color: colors.inkSoft, fontFamily: font.body, fontSize: 14, marginTop: 4 },
  matchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playerName: { color: colors.ink, fontFamily: font.body, fontWeight: '700', fontSize: 16 },
  playerElo: { color: colors.inkSoft, fontFamily: font.mono, fontSize: 13, marginTop: 2 },
  vs: { color: colors.clay, fontFamily: font.display, fontWeight: '800', fontSize: 15 },
  matchCta: {
    marginTop: 20,
    backgroundColor: colors.ball,
    borderRadius: radius.pill,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchCtaText: { color: colors.ink, fontFamily: font.body, fontWeight: '700', fontSize: 15 },
  // como funciona
  howHead: { marginTop: 72, marginBottom: 24 },
  sectionEyebrow: { color: colors.ball, fontFamily: font.mono, fontSize: 12, letterSpacing: 1.5, marginBottom: 10 },
  sectionTitle: { color: colors.chalk, fontFamily: font.display, fontWeight: '800', fontSize: 32, letterSpacing: -0.5 },
  steps: { gap: 20 },
  step: { flex: 1 },
  stepNumWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  stepNum: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.ball,
    color: colors.ink,
    fontFamily: font.display,
    fontWeight: '800',
    fontSize: 20,
    textAlign: 'center',
    lineHeight: 42,
  },
  stepBar: { flex: 1, height: 2, backgroundColor: colors.line, opacity: 0.35, marginLeft: 12 },
  stepT: { color: colors.chalk, fontFamily: font.display, fontWeight: '700', fontSize: 20 },
  stepD: { color: colors.line, fontFamily: font.body, fontSize: 15, lineHeight: 22, marginTop: 6, maxWidth: 300 },
  // cta band
  ctaBand: {
    marginTop: 64,
    backgroundColor: colors.clayDeep,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(241,233,219,0.18)',
    padding: 28,
    gap: 20,
  },
  ctaBandWide: { flexDirection: 'row', alignItems: 'center', gap: 32 },
  ctaBandTitle: { color: colors.chalk, fontFamily: font.display, fontWeight: '800', fontSize: 26, letterSpacing: -0.5 },
  ctaBandText: { color: colors.line, fontFamily: font.body, fontSize: 16, lineHeight: 23, marginTop: 6 },
  // features
  features: { marginTop: 56, gap: 16, flexDirection: 'row', flexWrap: 'wrap' },
  feature: {
    minWidth: 240,
    flexGrow: 1,
    flexBasis: 240,
    backgroundColor: colors.clayDeep,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(241,233,219,0.18)',
    padding: 20,
  },
  featureT: { color: colors.chalk, fontFamily: font.display, fontWeight: '700', fontSize: 19 },
  featureD: { color: colors.line, fontFamily: font.body, fontSize: 14.5, lineHeight: 21, marginTop: 8 },
  foot: { color: colors.line, fontFamily: font.body, fontSize: 14, textAlign: 'center', marginTop: 44 },
});
