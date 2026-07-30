import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import type { LadoJogador, SetPlacar } from '@/lib/database.types';
import { urlDoAvatar } from '@/lib/fotos';
import { colors, elev, font, radius, tabular } from '@/theme/tokens';

type Variante = 'primary' | 'ink' | 'ball' | 'ghost' | 'outline';

type BtnProps = {
  label: string;
  onPress?: () => void;
  /** `primary` saibro (padrão) · `ink` escuro · `ball` e `ghost` para fundos escuros · `outline` no claro. */
  variant?: Variante;
  icone?: React.ComponentProps<typeof Feather>['name'];
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  style?: ViewStyle;
};

const TEXTO_DO_BOTAO: Record<Variante, string> = {
  primary: colors.card,
  ink: colors.courtText,
  ball: colors.ink,
  ghost: colors.chalk,
  outline: colors.ink,
};

export function Btn({ label, onPress, variant = 'primary', icone, disabled, loading, full, style }: BtnProps) {
  const cor = TEXTO_DO_BOTAO[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed, hovered }: any) => [
        styles.btn,
        variant === 'primary' && styles.btnPrimary,
        variant === 'ink' && styles.btnInk,
        variant === 'ball' && styles.btnBall,
        variant === 'ghost' && styles.btnGhost,
        variant === 'outline' && styles.btnOutline,
        full && { alignSelf: 'stretch' },
        (pressed || hovered) && !disabled && styles.btnHover,
        disabled && styles.btnDisabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={cor} size="small" />
      ) : (
        <>
          {icone && <Feather name={icone} size={16} color={cor} />}
          <Text style={[styles.btnLabel, { color: cor }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

type Opt<T extends string> = { label: string; value: T };

/** Seletor segmentado (uma escolha), bom para 2–3 opções lado a lado. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Opt<T>[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={({ hovered }: any) => [
              styles.segment,
              hovered && !active && { backgroundColor: colors.chalk },
              active && styles.segmentActive,
            ]}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Grupo de chips (uma escolha) que quebram linha — bom para muitas opções. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Opt<T>[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={({ hovered }: any) => [
              styles.chip,
              hovered && !active && styles.chipHover,
              active && styles.chipActive,
            ]}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

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

/**
 * Placar de transmissão — o objeto característico do app.
 *
 * Uma linha por lado, sets em colunas de dígitos tabulares, e quem venceu
 * marcado pela bola e pelo risco de saibro na borda. É o mesmo desenho no
 * feed, na partida e em qualquer lugar que mostre um resultado.
 */
export function Placar({
  vencedores,
  perdedores,
  sets,
  pontos,
  compacto,
}: {
  vencedores: LadoJogador[] | string[];
  perdedores: LadoJogador[] | string[];
  sets: SetPlacar[];
  pontos?: number | null;
  compacto?: boolean;
}) {
  const nome = (x: LadoJogador | string) => (typeof x === 'string' ? x : x.nome);
  const linhaV = vencedores.map(nome).join(' e ') || 'Vencedor';
  const linhaP = perdedores.map(nome).join(' e ') || 'Adversário';

  return (
    <View style={[styles.placar, compacto && { padding: 12 }]}>
      <View style={styles.placarLinha}>
        <View style={styles.placarRisco} />
        <View style={styles.placarBola} />
        <Text style={[styles.placarNome, styles.placarNomeV]} numberOfLines={1}>
          {linhaV}
        </Text>
        {sets.map((s, i) => (
          <Text key={i} style={[styles.placarGame, styles.placarGameV]}>
            {s.v}
          </Text>
        ))}
      </View>

      <View style={[styles.placarLinha, { marginTop: 6 }]}>
        <View style={styles.placarBolaVazia} />
        <Text style={styles.placarNome} numberOfLines={1}>
          {linhaP}
        </Text>
        {sets.map((s, i) => (
          <Text key={i} style={styles.placarGame}>
            {s.p}
          </Text>
        ))}
      </View>

      {pontos != null && (
        <View style={styles.placarPontos}>
          <Text style={styles.placarPontosTexto}>+{pontos} pts</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  btnPrimary: { backgroundColor: colors.clay },
  btnInk: { backgroundColor: colors.court },
  btnBall: { backgroundColor: colors.ball },
  btnGhost: { borderWidth: 1, borderColor: 'rgba(241,243,241,0.35)' },
  btnOutline: { borderWidth: 1, borderColor: colors.net, backgroundColor: colors.card },
  btnHover: { opacity: 0.9 },
  btnDisabled: { opacity: 0.45 },
  btnLabel: { fontFamily: font.body, fontWeight: '600', fontSize: 14.5 },

  // segmented
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.net,
    borderRadius: radius.sm,
    padding: 3,
    gap: 3,
  },
  segment: { flex: 1, height: 36, borderRadius: radius.xs, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.court },
  segmentText: { fontFamily: font.body, fontWeight: '500', fontSize: 13.5, color: colors.inkSoft },
  segmentTextActive: { color: colors.courtText, fontWeight: '600' },

  // chips
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 13,
    height: 36,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.net,
    backgroundColor: colors.card,
  },
  chipHover: { borderColor: colors.inkSoft },
  chipActive: { backgroundColor: colors.court, borderColor: colors.court },
  chipText: { fontFamily: font.body, fontWeight: '500', fontSize: 13.5, color: colors.ink },
  chipTextActive: { color: colors.courtText, fontWeight: '600' },

  // seções e cartões
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

  // voltar
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

  // avatar
  avatar: { backgroundColor: colors.court, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.display, fontWeight: '700', color: colors.courtText },

  // pill
  pill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.xs },
  pillText: { fontFamily: font.mono, fontSize: 9.5, letterSpacing: 1, fontWeight: '600', textTransform: 'uppercase' },

  // marca
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  ballDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.ball },
  wordmarkText: { fontFamily: font.display, fontWeight: '700', fontSize: 13, letterSpacing: 2 },

  // placar
  placar: {
    backgroundColor: colors.chalk,
    borderRadius: radius.sm,
    padding: 14,
    paddingLeft: 16,
  },
  placarLinha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  placarRisco: {
    position: 'absolute',
    left: -16,
    top: -2,
    bottom: -2,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.clay,
  },
  placarBola: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.ball },
  placarBolaVazia: { width: 7, height: 7 },
  placarNome: {
    flex: 1,
    fontFamily: font.body,
    fontSize: 14.5,
    color: colors.inkSoft,
  },
  placarNomeV: { fontWeight: '600', color: colors.ink },
  placarGame: {
    width: 26,
    textAlign: 'center',
    fontFamily: font.mono,
    fontSize: 15,
    color: colors.inkSoft,
    ...tabular,
  },
  placarGameV: { fontWeight: '600', color: colors.ink },
  placarPontos: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.net, paddingTop: 10 },
  placarPontosTexto: { fontFamily: font.mono, fontSize: 11.5, color: colors.clayDeep, letterSpacing: 0.4 },
});
