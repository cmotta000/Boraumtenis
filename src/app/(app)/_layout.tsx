import { Feather } from '@expo/vector-icons';
import { Redirect, Slot, usePathname, useRouter } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Avatar } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useNaoLidas } from '@/lib/notificacoes';
import { useMeuPerfil } from '@/lib/perfil';
import { colors, font, radius, shell, tabular } from '@/theme/tokens';

type IconName = React.ComponentProps<typeof Feather>['name'];
type Item = { rota: string; label: string; icone: IconName };

const NAV: Item[] = [
  { rota: '/inicio', label: 'Início', icone: 'home' },
  { rota: '/partidas', label: 'Partidas', icone: 'map-pin' },
  { rota: '/feed', label: 'Feed', icone: 'image' },
  { rota: '/ranking', label: 'Ranking', icone: 'bar-chart-2' },
];

/** Título que a barra de topo mostra para cada rota. */
const TITULOS: { prefixo: string; titulo: string }[] = [
  { prefixo: '/inicio', titulo: 'Início' },
  { prefixo: '/partidas', titulo: 'Partidas' },
  { prefixo: '/feed', titulo: 'Feed' },
  { prefixo: '/ranking', titulo: 'Ranking' },
  { prefixo: '/perfil', titulo: 'Perfil' },
  { prefixo: '/editar-perfil', titulo: 'Editar perfil' },
  { prefixo: '/criar-partida', titulo: 'Criar partida' },
  { prefixo: '/notificacoes', titulo: 'Notificações' },
  { prefixo: '/partida/', titulo: 'Partida' },
  { prefixo: '/resultado/', titulo: 'Registrar placar' },
];

export default function AppLayout() {
  const { session, loading } = useAuth();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const router = useRouter();
  const { perfil } = useMeuPerfil();
  const naoLidas = useNaoLidas();

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.ball} />
      </View>
    );
  }
  if (!session) return <Redirect href="/entrar" />;

  const lateral = width >= shell.breakLateral;
  const comRotulos = width >= shell.breakCompleta;
  const titulo = TITULOS.find((t) => pathname.startsWith(t.prefixo))?.titulo ?? 'Bora um Tênis';
  const ativo = (rota: string) => pathname === rota || pathname.startsWith(rota + '/');

  return (
    <View style={styles.app}>
      {lateral && (
        <View style={[styles.sidebar, { width: comRotulos ? shell.sidebar : shell.rail }]}>
          <Marca compacta={!comRotulos} />

          <View style={styles.nav}>
            {NAV.map((item) => (
              <ItemNav
                key={item.rota}
                item={item}
                ativo={ativo(item.rota)}
                comRotulo={comRotulos}
                onPress={() => router.push(item.rota as never)}
              />
            ))}
          </View>

          {comRotulos && (
            <View style={styles.temporada}>
              <Text style={styles.temporadaLabel}>TEMPORADA</Text>
              <View style={styles.temporadaLinha}>
                <Text style={styles.temporadaPontos}>{perfil?.pontos ?? 0}</Text>
                <Text style={styles.temporadaUnidade}>pts</Text>
              </View>
              <Text style={styles.temporadaSaldo}>
                {perfil?.vitorias ?? 0}V · {perfil?.derrotas ?? 0}D
              </Text>
            </View>
          )}

          <View style={{ flex: 1 }} />

          <Pressable
            onPress={() => router.push('/perfil' as never)}
            accessibilityRole="link"
            accessibilityLabel="Abrir meu perfil"
            style={({ hovered }: any) => [
              styles.usuario,
              !comRotulos && styles.usuarioCompacto,
              hovered && { backgroundColor: colors.courtRaise },
            ]}>
            <Avatar nome={perfil?.nome} foto={perfil?.avatar_url} size={comRotulos ? 32 : 30} />
            {comRotulos && (
              <>
                <View style={{ flex: 1 }}>
                  <Text style={styles.usuarioNome} numberOfLines={1}>
                    {perfil?.nome ?? '—'}
                  </Text>
                  <Text style={styles.usuarioLink}>Ver perfil</Text>
                </View>
                <Feather name="chevron-right" size={15} color={colors.courtMute} />
              </>
            )}
          </Pressable>
        </View>
      )}

      <View style={styles.principal}>
        <View style={styles.topbar}>
          <Text style={styles.topbarTitulo} numberOfLines={1}>
            {titulo}
          </Text>

          <View style={{ flex: 1 }} />

          <Pressable
            onPress={() => router.push('/notificacoes' as never)}
            accessibilityRole="button"
            accessibilityLabel={naoLidas > 0 ? `Notificações, ${naoLidas} não lidas` : 'Notificações'}
            style={({ hovered }: any) => [styles.iconeBtn, hovered && { backgroundColor: colors.chalk }]}>
            <Feather name="bell" size={18} color={colors.ink} />
            {naoLidas > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeTexto}>{naoLidas > 9 ? '9+' : naoLidas}</Text>
              </View>
            )}
          </Pressable>

          {/* Na própria tela de criar partida o atalho seria redundante. */}
          {!pathname.startsWith('/criar-partida') && (
            <Pressable
              onPress={() => router.push('/criar-partida' as never)}
              accessibilityRole="button"
              style={({ hovered }: any) => [styles.cta, hovered && { backgroundColor: colors.clayDeep }]}>
              <Feather name="plus" size={16} color={colors.card} />
              {lateral && <Text style={styles.ctaTexto}>Criar partida</Text>}
            </Pressable>
          )}
        </View>

        <View style={styles.conteudo}>
          <Slot />
        </View>

        {!lateral && (
          <View style={styles.barraInferior}>
            {NAV.map((item) => {
              const on = ativo(item.rota);
              return (
                <Pressable
                  key={item.rota}
                  onPress={() => router.push(item.rota as never)}
                  accessibilityRole="link"
                  accessibilityState={{ selected: on }}
                  style={styles.itemInferior}>
                  <Feather name={item.icone} size={19} color={on ? colors.ball : colors.courtMute} />
                  <Text style={[styles.rotuloInferior, on && { color: colors.courtText }]}>{item.label}</Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => router.push('/perfil' as never)}
              accessibilityRole="link"
              accessibilityState={{ selected: ativo('/perfil') }}
              style={styles.itemInferior}>
              <Avatar nome={perfil?.nome} foto={perfil?.avatar_url} size={19} />
              <Text style={[styles.rotuloInferior, ativo('/perfil') && { color: colors.courtText }]}>Perfil</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

/** Marca: a bola é o ponto da assinatura. */
function Marca({ compacta }: { compacta: boolean }) {
  return (
    <View style={[styles.marca, compacta && { justifyContent: 'center' }]}>
      <View style={styles.bola} />
      {!compacta && (
        <View>
          <Text style={styles.marcaTexto}>BORA UM</Text>
          <Text style={styles.marcaTexto}>TÊNIS</Text>
        </View>
      )}
    </View>
  );
}

/** Item de navegação: ativo = risco de giz da bola na borda. */
function ItemNav({
  item,
  ativo,
  comRotulo,
  onPress,
}: {
  item: Item;
  ativo: boolean;
  comRotulo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityState={{ selected: ativo }}
      accessibilityLabel={item.label}
      {...(Platform.OS === 'web' && !comRotulo ? { title: item.label } : null)}
      style={({ hovered }: any) => [
        styles.item,
        !comRotulo && styles.itemCompacto,
        hovered && !ativo && { backgroundColor: colors.courtRaise },
        ativo && styles.itemAtivo,
      ]}>
      {ativo && <View style={styles.marcador} />}
      <Feather name={item.icone} size={18} color={ativo ? colors.courtText : colors.courtMute} />
      {comRotulo && <Text style={[styles.itemTexto, ativo && styles.itemTextoAtivo]}>{item.label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: colors.court, alignItems: 'center', justifyContent: 'center' },
  app: { flex: 1, flexDirection: 'row', backgroundColor: colors.court },

  // — Barra lateral
  sidebar: { backgroundColor: colors.court, paddingVertical: 18, paddingHorizontal: 12 },
  marca: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, marginBottom: 26 },
  bola: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.ball,
  },
  marcaTexto: {
    fontFamily: font.display,
    fontWeight: '800',
    fontSize: 12.5,
    letterSpacing: 1.4,
    lineHeight: 15,
    color: colors.courtText,
  },
  nav: { gap: 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
  },
  itemCompacto: { justifyContent: 'center', paddingHorizontal: 0 },
  itemAtivo: { backgroundColor: colors.courtRaise },
  marcador: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.ball,
  },
  itemTexto: { fontFamily: font.body, fontWeight: '500', fontSize: 14.5, color: colors.courtMute },
  itemTextoAtivo: { color: colors.courtText, fontWeight: '600' },

  temporada: {
    marginTop: 22,
    marginHorizontal: 4,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: colors.courtLine,
    paddingHorizontal: 8,
  },
  temporadaLabel: { fontFamily: font.mono, fontSize: 9.5, letterSpacing: 1.4, color: colors.courtMute },
  temporadaLinha: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 6 },
  temporadaPontos: {
    fontFamily: font.mono,
    fontWeight: '600',
    fontSize: 26,
    color: colors.courtText,
    ...tabular,
  },
  temporadaUnidade: { fontFamily: font.mono, fontSize: 12, color: colors.courtMute },
  temporadaSaldo: { fontFamily: font.mono, fontSize: 11.5, color: colors.courtMute, marginTop: 2 },

  usuario: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.courtLine,
  },
  usuarioCompacto: { justifyContent: 'center', borderColor: 'transparent' },
  usuarioNome: { fontFamily: font.body, fontWeight: '600', fontSize: 13.5, color: colors.courtText },
  usuarioLink: { fontFamily: font.body, fontSize: 11.5, color: colors.courtMute, marginTop: 1 },

  // — Área principal
  principal: { flex: 1, backgroundColor: colors.chalk },
  topbar: {
    height: shell.topbar,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.net,
  },
  topbarTitulo: {
    fontFamily: font.display,
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  iconeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 1,
    right: 0,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 3.5,
    borderRadius: 7.5,
    backgroundColor: colors.clay,
    borderWidth: 1.5,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTexto: { fontFamily: font.mono, fontWeight: '600', fontSize: 9, color: colors.card, ...tabular },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.clay,
  },
  ctaTexto: { fontFamily: font.body, fontWeight: '600', fontSize: 13.5, color: colors.card },

  conteudo: { flex: 1, backgroundColor: colors.chalk },

  // — Navegação inferior (telas estreitas)
  barraInferior: {
    flexDirection: 'row',
    height: shell.bottomBar,
    backgroundColor: colors.court,
    paddingBottom: 4,
  },
  itemInferior: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 4 },
  rotuloInferior: { fontFamily: font.body, fontWeight: '500', fontSize: 10.5, color: colors.courtMute },
});
