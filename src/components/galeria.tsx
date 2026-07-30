import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { urlDaFoto } from '@/lib/fotos';
import { colors, font, radius } from '@/theme/tokens';

/**
 * Mosaico de fotos de um post, no espírito do feed do Strava: uma foto grande
 * quando é só uma, mosaico quando são várias. Tocar abre a foto inteira.
 */
export function GaleriaFotos({ fotos }: { fotos: string[] }) {
  const [aberta, setAberta] = useState<number | null>(null);
  if (fotos.length === 0) return null;

  const abrir = (i: number) => setAberta(i);
  const visiveis = fotos.slice(0, 4);
  const extras = fotos.length - visiveis.length;

  return (
    <>
      <View style={styles.mosaico}>
        {fotos.length === 1 && <Foto caminho={fotos[0]} onPress={() => abrir(0)} style={styles.hero} />}

        {fotos.length === 2 && (
          <View style={styles.linha}>
            {fotos.map((f, i) => (
              <Foto key={f} caminho={f} onPress={() => abrir(i)} style={styles.meio} />
            ))}
          </View>
        )}

        {fotos.length === 3 && (
          <View style={styles.linha}>
            <Foto caminho={fotos[0]} onPress={() => abrir(0)} style={styles.principal} />
            <View style={styles.coluna}>
              <Foto caminho={fotos[1]} onPress={() => abrir(1)} style={styles.secundaria} />
              <Foto caminho={fotos[2]} onPress={() => abrir(2)} style={styles.secundaria} />
            </View>
          </View>
        )}

        {fotos.length >= 4 && (
          <View style={styles.grade}>
            {visiveis.map((f, i) => (
              <Foto
                key={f}
                caminho={f}
                onPress={() => abrir(i)}
                style={styles.gradeItem}
                selo={i === 3 && extras > 0 ? `+${extras}` : undefined}
              />
            ))}
          </View>
        )}
      </View>

      <Lightbox fotos={fotos} indice={aberta} onIndice={setAberta} />
    </>
  );
}

/** Grade quadrada de fotos — usada na galeria do perfil. */
export function GradeFotos({ fotos, colunas = 3 }: { fotos: string[]; colunas?: number }) {
  const [aberta, setAberta] = useState<number | null>(null);
  if (fotos.length === 0) return null;
  const largura = `${100 / colunas}%` as const;

  return (
    <>
      <View style={styles.gradePerfil}>
        {fotos.map((f, i) => (
          <View key={f + i} style={{ width: largura, padding: 3 }}>
            <Foto caminho={f} onPress={() => setAberta(i)} style={styles.quadrada} />
          </View>
        ))}
      </View>
      <Lightbox fotos={fotos} indice={aberta} onIndice={setAberta} />
    </>
  );
}

function Foto({
  caminho,
  onPress,
  style,
  selo,
}: {
  caminho: string;
  onPress: () => void;
  style: object;
  selo?: string;
}) {
  return (
    <Pressable onPress={onPress} style={({ hovered }: any) => [style, hovered && { opacity: 0.92 }]}>
      <Image source={{ uri: urlDaFoto(caminho) }} style={styles.img} contentFit="cover" transition={150} />
      {selo && (
        <View style={styles.selo}>
          <Text style={styles.seloText}>{selo}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Foto em tela cheia, com navegação entre as fotos do post. */
function Lightbox({
  fotos,
  indice,
  onIndice,
}: {
  fotos: string[];
  indice: number | null;
  onIndice: (i: number | null) => void;
}) {
  if (indice === null) return null;
  const anterior = () => onIndice((indice - 1 + fotos.length) % fotos.length);
  const proxima = () => onIndice((indice + 1) % fotos.length);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onIndice(null)}>
      <Pressable style={styles.backdrop} onPress={() => onIndice(null)}>
        <Image source={{ uri: urlDaFoto(fotos[indice]) }} style={styles.cheia} contentFit="contain" />
      </Pressable>

      <Pressable onPress={() => onIndice(null)} style={[styles.circulo, { top: 20, right: 20 }]}>
        <Text style={styles.circuloText}>×</Text>
      </Pressable>

      {fotos.length > 1 && (
        <>
          <Pressable onPress={anterior} style={[styles.circulo, styles.seta, { left: 16 }]}>
            <Text style={styles.circuloText}>‹</Text>
          </Pressable>
          <Pressable onPress={proxima} style={[styles.circulo, styles.seta, { right: 16 }]}>
            <Text style={styles.circuloText}>›</Text>
          </Pressable>
          <View style={styles.contador}>
            <Text style={styles.contadorText}>
              {indice + 1} / {fotos.length}
            </Text>
          </View>
        </>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  mosaico: { marginTop: 14 },
  img: { width: '100%', height: '100%', backgroundColor: colors.net },
  hero: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md, overflow: 'hidden' },
  linha: { flexDirection: 'row', gap: 4, height: 300, borderRadius: radius.md, overflow: 'hidden' },
  coluna: { flex: 1, gap: 4 },
  meio: { flex: 1, height: '100%' },
  principal: { flex: 2, height: '100%' },
  secundaria: { flex: 1, width: '100%' },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  gradeItem: { width: '49%', aspectRatio: 1, borderRadius: radius.sm, overflow: 'hidden' },
  quadrada: { width: '100%', aspectRatio: 1, borderRadius: radius.sm, overflow: 'hidden' },
  gradePerfil: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  selo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(36,22,17,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seloText: { fontFamily: font.display, fontWeight: '800', fontSize: 26, color: colors.chalk },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,12,9,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  cheia: { width: '100%', height: '100%' },
  circulo: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seta: { top: '50%', marginTop: -22 },
  circuloText: { color: '#fff', fontSize: 26, fontWeight: '700', marginTop: -4 },
  contador: {
    position: 'absolute',
    bottom: 26,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  contadorText: { color: '#fff', fontFamily: font.mono, fontSize: 12, letterSpacing: 1 },
});
