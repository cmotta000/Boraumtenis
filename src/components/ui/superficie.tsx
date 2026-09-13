import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, elev, font, radius } from '@/theme/tokens';

/** Linha de quadra (giz). Divisor estrutural da identidade. */
export function CourtLine({ color = colors.net, style }: { color?: string; style?: ViewStyle }) {
  return <View style={[{ height: 1, backgroundColor: color }, style]} />;
}

/** Rótulo de seção: mono, versalete, discreto. */
export function Secao({ children, style }: { children: string; style?: ViewStyle }) {
  return <Text style={[styles.secao, style as never]}>{children}</Text>;
}

/** Cartão branco padrão do conteúdo. */
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Volta para a rota anterior. O título da tela vive na barra de topo. */
export function ScreenHeader({ title, fallback = '/inicio' }: { title: string; fallback?: string }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as never))}
      accessibilityRole="button"
      accessibilityLabel={`Voltar de ${title}`}
      style={({ hovered }: any) => [styles.voltar, hovered && { borderColor: colors.ink }]}>
      <Feather name="arrow-left" size={15} color={colors.inkSoft} />
      <Text style={styles.voltarTexto}>Voltar</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  secao: {
    fontFamily: font.mono,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.net,
    padding: 18,
    ...elev.card,
  },

  voltar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.net,
    backgroundColor: colors.card,
  },
  voltarTexto: { fontFamily: font.body, fontWeight: '500', fontSize: 13, color: colors.inkSoft },
});
