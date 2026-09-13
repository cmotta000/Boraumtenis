import { StyleSheet, Text, View } from 'react-native';

import type { LadoJogador, SetPlacar } from '@/lib/database.types';
import { colors, font, radius, tabular } from '@/theme/tokens';

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
