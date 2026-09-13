import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors, font, radius } from '@/theme/tokens';

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
});
