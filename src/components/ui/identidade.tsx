import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { urlDoAvatar } from '@/lib/fotos';
import { colors, font, radius } from '@/theme/tokens';

/** Marca. O ponto é a bola. */
export function Wordmark({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const c = tone === 'light' ? colors.chalk : colors.ink;
  return (
    <View style={styles.wordmark}>
      <View style={styles.ballDot} />
      <Text style={[styles.wordmarkText, { color: c }]}>BORA UM TÊNIS</Text>
    </View>
  );
}

/** Avatar circular: foto de perfil quando existe, iniciais quando não. */
export function Avatar({
  nome,
  foto,
  size = 40,
  aro,
}: {
  nome?: string | null;
  /** Caminho no bucket `avatares` ou URL pronta. */
  foto?: string | null;
  size?: number;
  /** Aro claro em volta — usado sobre fundos coloridos. */
  aro?: boolean;
}) {
  const url = urlDoAvatar(foto);
  const base = [
    styles.avatar,
    { width: size, height: size, borderRadius: size / 2 },
    aro && { borderWidth: 2, borderColor: colors.card },
  ];

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={base as never}
        contentFit="cover"
        transition={150}
        accessibilityLabel={nome ? `Foto de ${nome}` : 'Foto de perfil'}
      />
    );
  }

  const iniciais = (nome ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <View style={base as never}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{iniciais || '?'}</Text>
    </View>
  );
}

/** Etiqueta de status. */
export function Pill({ label, tone = 'clay' }: { label: string; tone?: 'clay' | 'ok' | 'muted' | 'ball' }) {
  const map = {
    clay: { bg: colors.clayWash, fg: colors.clayDeep },
    ok: { bg: '#E4F1EA', fg: colors.ok },
    ball: { bg: colors.ball, fg: colors.ink },
    muted: { bg: colors.chalk, fg: colors.inkSoft },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: map.bg }]}>
      <Text style={[styles.pillText, { color: map.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  ballDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.ball },
  wordmarkText: { fontFamily: font.display, fontWeight: '700', fontSize: 13, letterSpacing: 2 },

  avatar: { backgroundColor: colors.court, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.display, fontWeight: '700', color: colors.courtText },

  pill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.xs },
  pillText: { fontFamily: font.mono, fontSize: 9.5, letterSpacing: 1, fontWeight: '600', textTransform: 'uppercase' },
});
