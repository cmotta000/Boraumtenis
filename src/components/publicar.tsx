import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui';
import { escolherFotos, MAX_FOTOS, type FotoLocal } from '@/lib/fotos';
import { publicarFotos } from '@/lib/posts';
import { colors, elev, font, radius } from '@/theme/tokens';

/**
 * Caixa de publicação do feed: escolhe fotos, escreve uma legenda e publica.
 * Fica recolhida até o primeiro toque para não roubar a atenção do feed.
 */
export function Compositor({
  userId,
  nome,
  avatar,
  matchId,
  onPublicado,
}: {
  userId: string;
  nome?: string | null;
  avatar?: string | null;
  /** Amarra a publicação a uma partida (usado na tela da partida). */
  matchId?: string | null;
  onPublicado: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [legenda, setLegenda] = useState('');
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const vazio = fotos.length === 0 && !legenda.trim();

  async function adicionar() {
    setErro(null);
    try {
      const novas = await escolherFotos(MAX_FOTOS - fotos.length);
      if (novas.length > 0) setAberto(true);
      setFotos((prev) => [...prev, ...novas].slice(0, MAX_FOTOS));
    } catch {
      setErro('Não foi possível abrir a galeria.');
    }
  }

  async function publicar() {
    if (vazio) return;
    setErro(null);
    setEnviando(true);
    try {
      await publicarFotos({ userId, fotos, legenda, matchId });
      setFotos([]);
      setLegenda('');
      setAberto(false);
      onPublicado();
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível publicar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  function cancelar() {
    setFotos([]);
    setLegenda('');
    setErro(null);
    setAberto(false);
  }

  return (
    <View style={styles.box}>
      <View style={styles.linha}>
        <Avatar nome={nome} foto={avatar} size={42} />
        {aberto ? (
          <TextInput
            value={legenda}
            onChangeText={setLegenda}
            placeholder={matchId ? 'Como foi o jogo?' : 'Como foi o treino de hoje?'}
            placeholderTextColor={colors.inkSoft}
            multiline
            autoFocus
            maxLength={600}
            style={styles.campo}
          />
        ) : (
          <Pressable
            onPress={() => setAberto(true)}
            style={({ hovered }: any) => [styles.gatilho, hovered && { borderColor: colors.clay }]}>
            <Text style={styles.gatilhoText}>
              {matchId ? 'Publique as fotos dessa partida…' : 'Compartilhe um momento da quadra…'}
            </Text>
          </Pressable>
        )}
      </View>

      {fotos.length > 0 && (
        <View style={styles.grid}>
          {fotos.map((f, i) => (
            <View key={f.uri + i} style={styles.thumbBox}>
              <Image source={{ uri: f.uri }} style={styles.thumb} contentFit="cover" />
              <Pressable
                onPress={() => setFotos((prev) => prev.filter((_, idx) => idx !== i))}
                style={styles.remover}>
                <Text style={styles.removerText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {erro && <Text style={styles.erro}>{erro}</Text>}

      <View style={styles.acoes}>
        <Pressable
          onPress={adicionar}
          disabled={fotos.length >= MAX_FOTOS || enviando}
          style={({ hovered }: any) => [
            styles.addFoto,
            fotos.length >= MAX_FOTOS && { opacity: 0.45 },
            hovered && { borderColor: colors.clay },
          ]}>
          <Feather name="image" size={15} color={colors.inkSoft} />
          <Text style={styles.addFotoText}>
            {fotos.length > 0 ? `${fotos.length}/${MAX_FOTOS} fotos` : 'Adicionar fotos'}
          </Text>
        </Pressable>

        <View style={{ flex: 1 }} />

        {aberto && (
          <>
            <Pressable onPress={cancelar} disabled={enviando} style={styles.cancelar}>
              <Text style={styles.cancelarText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={publicar}
              disabled={vazio || enviando}
              style={({ hovered }: any) => [
                styles.publicar,
                (vazio || enviando) && { opacity: 0.45 },
                hovered && { opacity: 0.92 },
              ]}>
              {enviando ? (
                <ActivityIndicator color={colors.card} size="small" />
              ) : (
                <Text style={styles.publicarText}>Publicar</Text>
              )}
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.net,
    padding: 16,
    ...elev.card,
  },
  linha: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  gatilho: {
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.net,
    backgroundColor: colors.chalk,
    paddingHorizontal: 14,
  },
  gatilhoText: { fontFamily: font.body, fontSize: 14.5, color: colors.inkSoft },
  campo: {
    flex: 1,
    minHeight: 62,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.net,
    padding: 12,
    fontFamily: font.body,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  thumbBox: { width: 84, height: 84, borderRadius: radius.sm, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%', backgroundColor: colors.net },
  remover: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(36,22,17,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removerText: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: -2 },
  erro: { fontFamily: font.body, fontSize: 13.5, color: colors.danger, marginTop: 10 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  addFoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.net,
  },
  addFotoText: { fontFamily: font.body, fontWeight: '500', fontSize: 13, color: colors.inkSoft },
  cancelar: { height: 38, paddingHorizontal: 10, justifyContent: 'center' },
  cancelarText: { fontFamily: font.body, fontSize: 13, color: colors.inkSoft },
  publicar: {
    height: 38,
    minWidth: 96,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
    backgroundColor: colors.clay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publicarText: { fontFamily: font.body, fontWeight: '600', fontSize: 13.5, color: colors.card },
});
