import { useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius } from '@/theme/tokens';

/**
 * Mini-mapa estático usando os tiles do OpenStreetMap (sem API key).
 * Monta um mosaico de tiles centralizado exatamente no ponto e desenha um
 * pino no centro. Funciona na web e no nativo (usa <Image>).
 */
export function MiniMap({
  lat,
  lng,
  zoom = 15,
  height = 180,
}: {
  lat: number;
  lng: number;
  zoom?: number;
  height?: number;
}) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));

  const n = 2 ** zoom;
  const xf = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yf = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const cx = Math.floor(xf);
  const cy = Math.floor(yf);
  const px = (xf - cx) * 256; // posição do ponto dentro do tile central
  const py = (yf - cy) * 256;

  const tiles: React.ReactNode[] = [];
  if (w > 0) {
    const iRange = Math.ceil(w / 2 / 256) + 1;
    const jRange = Math.ceil(height / 2 / 256) + 1;
    for (let i = -iRange; i <= iRange; i++) {
      for (let j = -jRange; j <= jRange; j++) {
        const tx = ((cx + i) % n + n) % n;
        const ty = cy + j;
        if (ty < 0 || ty >= n) continue;
        tiles.push(
          <Image
            key={`${i},${j}`}
            source={{ uri: `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png` }}
            style={{
              position: 'absolute',
              width: 256,
              height: 256,
              left: w / 2 - px + i * 256,
              top: height / 2 - py + j * 256,
            }}
          />,
        );
      }
    }
  }

  return (
    <View onLayout={onLayout} style={[styles.wrap, { height }]}>
      {tiles}
      {/* pino no centro exato */}
      <View style={[styles.pinWrap, { left: w / 2, top: height / 2 }]} pointerEvents="none">
        <View style={styles.pin} />
        <View style={styles.pinStem} />
      </View>
      <Text style={styles.attr}>© OpenStreetMap</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.net,
    overflow: 'hidden',
    backgroundColor: '#e8e4da',
  },
  pinWrap: { position: 'absolute', alignItems: 'center', marginLeft: -11, marginTop: -26 },
  pin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.clay,
    borderWidth: 3,
    borderColor: '#fff',
  },
  pinStem: {
    width: 3,
    height: 8,
    backgroundColor: colors.clay,
    marginTop: -1,
  },
  attr: {
    position: 'absolute',
    right: 4,
    bottom: 2,
    fontFamily: font.mono,
    fontSize: 9,
    color: colors.ink,
    backgroundColor: 'rgba(251,247,239,0.7)',
    paddingHorizontal: 4,
    borderRadius: 3,
  },
});
