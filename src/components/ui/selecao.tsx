import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius } from '@/theme/tokens';

type Opt<T extends string> = { label: string; value: T };

type SelecaoProps<T extends string> = {
  options: Opt<T>[];
  value: T | null;
  onChange: (v: T) => void;
};

/** Seletor segmentado (uma escolha), bom para 2–3 opções lado a lado. */
export function Segmented<T extends string>({ options, value, onChange }: SelecaoProps<T>) {
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
export function Chips<T extends string>({ options, value, onChange }: SelecaoProps<T>) {
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

const styles = StyleSheet.create({
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
});
